import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { AIAnalysisResult, PhotoUploadProgress } from './types';
import type { Json } from '@/integrations/supabase/types';
import { compressImage, generateThumbnail, UPLOAD_PRESETS } from '@/lib/imageCompression';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { matchFilenameToVehicle, type MatchableVehicle } from '@/lib/filenameVehicleMatcher';
import { uploadMetrics } from '@/lib/uploadMetrics';

interface UsePhotoAnalysisOptions {
  onProgress?: (progress: PhotoUploadProgress[]) => void;
  onComplete?: (results: PhotoUploadProgress[]) => void;
  onError?: (error: string) => void;
}

/** Process items with a concurrency limit */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await processor(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export function usePhotoAnalysis(options: UsePhotoAnalysisOptions = {}) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<PhotoUploadProgress[]>([]);

  /**
   * Upload a single photo to Supabase storage and get a signed URL.
   * Optionally generates and uploads a thumbnail.
   */
  const uploadToStorage = useCallback(async (
    file: File,
    folder: string = 'unmatched',
    preset: keyof typeof UPLOAD_PRESETS = 'display'
  ): Promise<{ path: string; url: string; thumbnailUrl?: string; thumbnailPath?: string; compressedBytes: number; width: number; height: number }> => {
    if (!user) throw new Error('User not authenticated');

    // Get original dimensions before compression
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const bitmap = await createImageBitmap(file);
      imgWidth = bitmap.width;
      imgHeight = bitmap.height;
      bitmap.close();
    } catch (e) {
      console.warn('Could not read image dimensions:', e);
    }

    // Compress with preset
    const presetOptions = isFeatureEnabled('uploadPresets') ? UPLOAD_PRESETS[preset] : undefined;
    const compressedFile = await compressImage(file, presetOptions);

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = compressedFile.name.split('.').pop();
    const path = `${user.id}/${folder}/${timestamp}-${randomString}.${extension}`;

    const { data, error } = await supabase.storage
      .from('vehicle-photos')
      .upload(path, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const storedPath = data.path;

    // 1-year signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('vehicle-photos')
      .createSignedUrl(storedPath, 60 * 60 * 24 * 365);

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Failed to create signed URL');
    }

    const result: { path: string; url: string; thumbnailUrl?: string; thumbnailPath?: string; compressedBytes: number; width: number; height: number } = {
      path: storedPath,
      url: signedData.signedUrl,
      compressedBytes: compressedFile.size,
      width: imgWidth,
      height: imgHeight,
    };

    // Generate + upload thumbnail
    if (isFeatureEnabled('thumbnailGeneration')) {
      try {
        const thumbnail = await generateThumbnail(file);
        const thumbPath = storedPath.replace(/\.[^.]+$/, '_thumb.jpg');

        const { error: thumbErr } = await supabase.storage
          .from('vehicle-photos')
          .upload(thumbPath, thumbnail, { cacheControl: '3600', upsert: false });

        if (!thumbErr) {
          const { data: thumbSigned } = await supabase.storage
            .from('vehicle-photos')
            .createSignedUrl(thumbPath, 60 * 60 * 24 * 365);

          if (thumbSigned?.signedUrl) {
            result.thumbnailUrl = thumbSigned.signedUrl;
            result.thumbnailPath = thumbPath;
          }
        }
      } catch (e) {
        console.warn('Thumbnail generation failed:', e);
      }
    }

    return result;
  }, [user]);

  /**
   * Call the AI analysis Edge Function (Gemini-based vehicle identification)
   */
  const analyzePhoto = useCallback(async (
    imageUrl: string,
    filename?: string
  ): Promise<AIAnalysisResult> => {
    const { data, error } = await supabase.functions.invoke('identify-vehicle', {
      body: { imageUrl, filename }
    });

    if (error) throw error;
    return data as AIAnalysisResult;
  }, []);

  /**
   * Upload and analyze a single photo, optionally assigning to a vehicle
   */
  const uploadAndAnalyze = useCallback(async (
    file: File,
    vehicleId?: string
  ): Promise<{ 
    path: string; 
    url: string; 
    analysis: AIAnalysisResult;
    photoId?: string;
  }> => {
    if (!user) throw new Error('User not authenticated');

    const folder = vehicleId ? `vehicles/${vehicleId}` : 'unmatched';
    const { path, url, thumbnailUrl, compressedBytes, width, height } = await uploadToStorage(file, folder);

    const analysis = await analyzePhoto(url, file.name);

    if (vehicleId && analysis.isVehicle) {
      const getPhotoType = (angle: string | undefined): string => {
        if (!angle) return 'exterior';
        if (angle === 'interior' || angle.includes('interior')) return 'interior';
        if (angle === 'detail' || angle.includes('detail')) return 'detail';
        if (angle === 'engine') return 'engine';
        return 'exterior';
      };

      // Auto-hero: if this is the first photo for this vehicle, make it the hero
      const { count: existingCount } = await supabase
        .from('vehicle_photos')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', vehicleId);

      const photoType = (existingCount === 0 || existingCount === null) ? 'hero' : getPhotoType(analysis.angle);

      const { data: photoData, error: insertError } = await supabase
        .from('vehicle_photos')
        .insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          team_id: currentTeam?.id || null,
          storage_path: path,
          url: url,
          thumbnail_url: thumbnailUrl || null,
          photo_type: photoType,
          detected_angle: analysis.angle,
          ai_analysis: analysis as unknown as Json,
          is_vehicle_confirmed: analysis.isVehicle,
          quality_score: analysis.quality.score,
          quality_issues: analysis.quality.issues,
          original_filename: file.name,
          file_size_bytes: compressedBytes,
          mime_type: file.type,
          width: width || null,
          height: height || null,
          analyzed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      return { path, url, analysis, photoId: photoData?.id };
    } else {
      const { error: unmatchedError } = await supabase
        .from('unmatched_photos')
        .insert({
          user_id: user.id,
          team_id: currentTeam?.id || null,
          storage_path: path,
          url: url,
          original_filename: file.name,
          ai_analysis: analysis as unknown as Json,
          suggested_make: analysis.suggestedVehicleMatch?.make,
          suggested_color: analysis.suggestedVehicleMatch?.color,
          suggestion_confidence: analysis.confidence
        });

      if (unmatchedError) throw unmatchedError;
      
      return { path, url, analysis };
    }
  }, [user, currentTeam, uploadToStorage, analyzePhoto]);

  /**
   * Process multiple photos in batch with concurrency pool.
   * @param vehicles - Fleet inventory for filename-based auto-matching
   * @param skipAnalysis - If true, skip AI analysis (faster onboarding)
   */
  const processBatch = useCallback(async (
    files: File[],
    vehicleId?: string,
    options_?: { skipAnalysis?: boolean; vehicles?: MatchableVehicle[] }
  ): Promise<PhotoUploadProgress[]> => {
    if (!user) throw new Error('User not authenticated');

    const skipAnalysis = options_?.skipAnalysis ?? false;
    const fleetVehicles = options_?.vehicles ?? [];
    const useConcurrency = isFeatureEnabled('concurrentUploads');

    setIsProcessing(true);
    
    // Initialize progress tracking
    const progressArr: PhotoUploadProgress[] = files.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));
    setProgress([...progressArr]);
    options.onProgress?.([...progressArr]);

    const updateProgress = (index: number, update: Partial<PhotoUploadProgress>) => {
      Object.assign(progressArr[index], update);
      setProgress([...progressArr]);
      options.onProgress?.([...progressArr]);
    };

    const processFile = async (file: File, i: number): Promise<PhotoUploadProgress> => {
      const startTime = Date.now();
      const originalBytes = file.size;

      try {
        // Dedup guard: check if identical file already uploaded
        const dedupKey = `${file.name}_${file.size}_${file.lastModified}`;
        if (vehicleId) {
          const { data: existing } = await supabase
            .from('vehicle_photos')
            .select('id')
            .eq('vehicle_id', vehicleId)
            .eq('original_filename', file.name)
            .eq('file_size_bytes', file.size)
            .limit(1);
          if (existing && existing.length > 0) {
            const result: PhotoUploadProgress = {
              file,
              status: 'complete',
              progress: 100,
              matchResult: 'skipped',
              error: 'Duplicate detected — already uploaded',
            };
            updateProgress(i, result);
            return result;
          }
        }
        // Preprocessing: filename matching
        let resolvedVehicleId = vehicleId;
        let matchResult: PhotoUploadProgress['matchResult'] = vehicleId ? 'skipped' : 'unmatched';

        if (!vehicleId && fleetVehicles.length > 0) {
          updateProgress(i, { status: 'matching', progress: 10 });
          const match = matchFilenameToVehicle(file.name, fleetVehicles);
          if (match.confidence === 'high') {
            resolvedVehicleId = match.vehicleId!;
            matchResult = 'auto-matched';
          } else if (match.confidence === 'medium') {
            matchResult = 'suggested';
          }
        }

        // Upload
        updateProgress(i, { status: 'uploading', progress: 25 });
        const folder = resolvedVehicleId ? `vehicles/${resolvedVehicleId}` : 'unmatched';
        const { path, url, thumbnailUrl, compressedBytes, width, height } = await uploadToStorage(file, folder);

        // Default analysis
        let analysis: AIAnalysisResult = {
          isVehicle: true,
          confidence: 100,
          angle: 'unknown',
          angleConfidence: 0,
          quality: { score: 100, issues: [] },
          labels: [],
        };

        if (!skipAnalysis) {
          updateProgress(i, { status: 'analyzing', progress: 50 });
          try {
            analysis = await analyzePhoto(url, file.name);
          } catch (analysisError) {
            console.warn('AI analysis failed, using defaults:', analysisError);
          }
        }

        // Save to database
        let photoId: string | undefined;
        
        if (resolvedVehicleId && (matchResult === 'auto-matched' || matchResult === 'skipped')) {
          const getPhotoType = (angle: string | undefined): string => {
            if (!angle) return 'exterior';
            if (angle === 'interior' || angle.includes('interior')) return 'interior';
            if (angle === 'detail' || angle.includes('detail')) return 'detail';
            if (angle === 'engine') return 'engine';
            return 'exterior';
          };

          const { data } = await supabase
            .from('vehicle_photos')
            .insert({
              vehicle_id: resolvedVehicleId,
              user_id: user.id,
              team_id: currentTeam?.id || null,
              storage_path: path,
              url: url,
              thumbnail_url: thumbnailUrl || null,
              photo_type: getPhotoType(analysis.angle),
              detected_angle: analysis.angle,
              ai_analysis: analysis as unknown as Json,
              is_vehicle_confirmed: true,
              quality_score: analysis.quality.score,
              quality_issues: analysis.quality.issues,
              original_filename: file.name,
              file_size_bytes: compressedBytes,
              mime_type: file.type,
              width: width || null,
              height: height || null,
              analyzed_at: skipAnalysis ? null : new Date().toISOString()
            })
            .select()
            .single();
          
          photoId = data?.id;
        } else {
          // Save to unmatched queue (including suggested matches)
          const match = !vehicleId && fleetVehicles.length > 0
            ? matchFilenameToVehicle(file.name, fleetVehicles)
            : null;

          await supabase
            .from('unmatched_photos')
            .insert({
              user_id: user.id,
              team_id: currentTeam?.id || null,
              storage_path: path,
              url: url,
              original_filename: file.name,
              ai_analysis: analysis as unknown as Json,
              suggested_make: analysis.suggestedVehicleMatch?.make,
              suggested_color: analysis.suggestedVehicleMatch?.color,
              suggestion_confidence: analysis.confidence,
              ...(match?.confidence === 'medium' && match.vehicleId
                ? { suggested_vehicle_id: match.vehicleId }
                : {}),
            });
        }

        // Record metrics
        const durationMs = Date.now() - startTime;
        uploadMetrics.record({
          originalBytes,
          compressedBytes,
          durationMs,
          matchResult: matchResult || 'unmatched',
        });

        const result: PhotoUploadProgress = {
          file,
          status: 'complete',
          progress: 100,
          matchResult,
          compressionStats: { originalBytes, compressedBytes },
          result: { url, analysis, vehicleId: resolvedVehicleId, photoId }
        };
        updateProgress(i, result);
        return result;
      } catch (error) {
        let errorMessage = 'Upload failed';
        if (error instanceof Error) {
          if (error.message.includes('Payload too large') || 
              error.message.includes('exceeded the maximum') ||
              error.message.includes('413')) {
            errorMessage = 'File too large - max 50MB';
          } else {
            errorMessage = error.message;
          }
        }

        const durationMs = Date.now() - startTime;
        uploadMetrics.record({
          originalBytes,
          compressedBytes: 0,
          durationMs,
          matchResult: 'unmatched',
        });

        const result: PhotoUploadProgress = {
          file,
          status: 'error',
          progress: 0,
          error: errorMessage
        };
        updateProgress(i, result);
        return result;
      }
    };

    let results: PhotoUploadProgress[];
    if (useConcurrency) {
      results = await processWithConcurrency(files, 3, processFile);
    } else {
      results = [];
      for (let i = 0; i < files.length; i++) {
        results.push(await processFile(files[i], i));
      }
    }

    setIsProcessing(false);
    options.onComplete?.(results);
    
    return results;
  }, [user, currentTeam, uploadToStorage, analyzePhoto, options]);

  /**
   * Match an unmatched photo to a vehicle
   */
  const matchPhotoToVehicle = useCallback(async (
    unmatchedPhotoId: string,
    vehicleId: string
  ): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const { data: unmatchedPhoto, error: fetchError } = await supabase
      .from('unmatched_photos')
      .select('*')
      .eq('id', unmatchedPhotoId)
      .single();

    if (fetchError || !unmatchedPhoto) throw new Error('Photo not found');

    const aiAnalysis = unmatchedPhoto.ai_analysis as Record<string, unknown> | null;

    const { data: vehiclePhoto, error: insertError } = await supabase
      .from('vehicle_photos')
      .insert({
        vehicle_id: vehicleId,
        user_id: user.id,
        team_id: currentTeam?.id || null,
        storage_path: unmatchedPhoto.storage_path,
        url: unmatchedPhoto.url,
        photo_type: 'exterior',
        detected_angle: (aiAnalysis?.angle as string) || 'unknown',
        ai_analysis: unmatchedPhoto.ai_analysis,
        is_vehicle_confirmed: true,
        quality_score: (aiAnalysis?.quality as Record<string, unknown>)?.score as number || 100,
        quality_issues: (aiAnalysis?.quality as Record<string, unknown>)?.issues as string[] || [],
        original_filename: unmatchedPhoto.original_filename,
        analyzed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase
      .from('unmatched_photos')
      .update({
        status: 'matched',
        matched_vehicle_id: vehicleId,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id
      })
      .eq('id', unmatchedPhotoId);

    return vehiclePhoto?.id;
  }, [user, currentTeam]);

  /**
   * Set a photo as the hero photo for its vehicle
   */
  const setAsHero = useCallback(async (photoId: string): Promise<void> => {
    const { data: photo, error: fetchError } = await supabase
      .from('vehicle_photos')
      .select('vehicle_id, url')
      .eq('id', photoId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('vehicle_photos')
      .update({ photo_type: 'hero' })
      .eq('id', photoId);

    if (error) throw error;

    if (photo.url) {
      await supabase
        .from('vehicles')
        .update({ image_url: photo.url })
        .eq('id', photo.vehicle_id);
    }
  }, []);

  /**
   * Delete a photo and its thumbnail
   */
  const deletePhoto = useCallback(async (photoId: string): Promise<void> => {
    const { data: photo } = await supabase
      .from('vehicle_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (photo?.storage_path) {
      // Delete both main file and thumbnail
      const thumbPath = photo.storage_path.replace(/\.[^.]+$/, '_thumb.jpg');
      await supabase.storage
        .from('vehicle-photos')
        .remove([photo.storage_path, thumbPath]);
    }

    const { error } = await supabase
      .from('vehicle_photos')
      .delete()
      .eq('id', photoId);

    if (error) throw error;
  }, []);

  /**
   * Reorder photos for a vehicle
   */
  /**
   * Replace a photo's file in storage and update the DB row.
   * Used by the client-side photo editor — uploads new file, deletes old one.
   */
  const replacePhotoFile = useCallback(async (
    photoId: string,
    newFile: File
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    // Fetch current photo metadata
    const { data: photo, error: fetchErr } = await supabase
      .from('vehicle_photos')
      .select('storage_path, vehicle_id')
      .eq('id', photoId)
      .single();

    if (fetchErr || !photo) throw new Error('Photo not found');

    // Upload replacement
    const folder = photo.vehicle_id ? `vehicles/${photo.vehicle_id}` : 'unmatched';
    const { path, url, thumbnailUrl, thumbnailPath, compressedBytes, width, height } = await uploadToStorage(newFile, folder);

    // Update DB row
    const { error: updateErr } = await supabase
      .from('vehicle_photos')
      .update({
        storage_path: path,
        url,
        thumbnail_url: thumbnailUrl || null,
        file_size_bytes: compressedBytes,
        width: width || null,
        height: height || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', photoId);

    if (updateErr) throw updateErr;

    // Delete old storage files
    if (photo.storage_path) {
      const oldThumbPath = photo.storage_path.replace(/\.[^.]+$/, '_thumb.jpg');
      await supabase.storage
        .from('vehicle-photos')
        .remove([photo.storage_path, oldThumbPath]);
    }

    // Update vehicle hero image_url if this is the hero
    const { data: updatedPhoto } = await supabase
      .from('vehicle_photos')
      .select('photo_type, vehicle_id')
      .eq('id', photoId)
      .single();

    if (updatedPhoto?.photo_type === 'hero' && updatedPhoto.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ image_url: url })
        .eq('id', updatedPhoto.vehicle_id);
    }
  }, [user, uploadToStorage]);

  return {
    isProcessing,
    progress,
    uploadAndAnalyze,
    processBatch,
    matchPhotoToVehicle,
    setAsHero,
    deletePhoto,
    reorderPhotos,
    analyzePhoto,
    replacePhotoFile
  };
}
