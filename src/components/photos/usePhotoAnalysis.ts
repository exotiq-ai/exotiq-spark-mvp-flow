import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { AIAnalysisResult, PhotoUploadProgress } from './types';
import type { Json } from '@/integrations/supabase/types';

interface UsePhotoAnalysisOptions {
  onProgress?: (progress: PhotoUploadProgress[]) => void;
  onComplete?: (results: PhotoUploadProgress[]) => void;
  onError?: (error: string) => void;
}

export function usePhotoAnalysis(options: UsePhotoAnalysisOptions = {}) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<PhotoUploadProgress[]>([]);

  /**
   * Upload a single photo to Supabase storage and get a signed URL
   */
  const uploadToStorage = useCallback(async (
    file: File,
    folder: string = 'unmatched'
  ): Promise<{ path: string; url: string }> => {
    if (!user) throw new Error('User not authenticated');

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const path = `${user.id}/${folder}/${timestamp}-${randomString}.${extension}`;

    const { data, error } = await supabase.storage
      .from('vehicle-photos')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Use signed URL for private bucket access (valid for 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('vehicle-photos')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Failed to create signed URL');
    }

    return { path: data.path, url: signedData.signedUrl };
  }, [user]);

  /**
   * Call the AI analysis Edge Function
   */
  const analyzePhoto = useCallback(async (
    imageUrl: string,
    filename?: string
  ): Promise<AIAnalysisResult> => {
    const { data, error } = await supabase.functions.invoke('analyze-vehicle-photo', {
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

    // 1. Upload to storage
    const folder = vehicleId ? `vehicles/${vehicleId}` : 'unmatched';
    const { path, url } = await uploadToStorage(file, folder);

    // 2. Analyze with AI
    const analysis = await analyzePhoto(url, file.name);

    // 3. Save to database
    if (vehicleId && analysis.isVehicle) {
      // Save as vehicle photo
      const { data: photoData, error: insertError } = await supabase
        .from('vehicle_photos')
        .insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          team_id: currentTeam?.id || null,
          storage_path: path,
          url: url,
          photo_type: 'exterior',
          detected_angle: analysis.angle,
          ai_analysis: analysis as unknown as Json,
          is_vehicle_confirmed: analysis.isVehicle,
          quality_score: analysis.quality.score,
          quality_issues: analysis.quality.issues,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          analyzed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      return { path, url, analysis, photoId: photoData?.id };
    } else {
      // Save to unmatched queue
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
   * Process multiple photos in batch
   */
  const processBatch = useCallback(async (
    files: File[],
    vehicleId?: string
  ): Promise<PhotoUploadProgress[]> => {
    if (!user) throw new Error('User not authenticated');

    setIsProcessing(true);
    
    // Initialize progress tracking
    const initialProgress: PhotoUploadProgress[] = files.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));
    setProgress(initialProgress);
    options.onProgress?.(initialProgress);

    const results: PhotoUploadProgress[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update to uploading
      const uploadingProgress = [...initialProgress];
      uploadingProgress[i] = { ...uploadingProgress[i], status: 'uploading', progress: 25 };
      setProgress(uploadingProgress);
      options.onProgress?.(uploadingProgress);

      try {
        // Upload
        const folder = vehicleId ? `vehicles/${vehicleId}` : 'unmatched';
        const { path, url } = await uploadToStorage(file, folder);
        
        // Update to analyzing
        const analyzingProgress = [...uploadingProgress];
        analyzingProgress[i] = { ...analyzingProgress[i], status: 'analyzing', progress: 50 };
        setProgress(analyzingProgress);
        options.onProgress?.(analyzingProgress);

        // Analyze
        const analysis = await analyzePhoto(url, file.name);

        // Save to database
        let photoId: string | undefined;
        
        if (vehicleId && analysis.isVehicle) {
          const { data } = await supabase
            .from('vehicle_photos')
            .insert({
              vehicle_id: vehicleId,
              user_id: user.id,
              team_id: currentTeam?.id || null,
              storage_path: path,
              url: url,
              photo_type: 'exterior',
              detected_angle: analysis.angle,
              ai_analysis: analysis as unknown as Json,
              is_vehicle_confirmed: analysis.isVehicle,
              quality_score: analysis.quality.score,
              quality_issues: analysis.quality.issues,
              original_filename: file.name,
              file_size_bytes: file.size,
              mime_type: file.type,
              analyzed_at: new Date().toISOString()
            })
            .select()
            .single();
          
          photoId = data?.id;
        } else {
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
              suggestion_confidence: analysis.confidence
            });
        }

        // Update to complete
        const completeProgress = [...analyzingProgress];
        completeProgress[i] = {
          ...completeProgress[i],
          status: 'complete',
          progress: 100,
          result: { url, analysis, vehicleId, photoId }
        };
        setProgress(completeProgress);
        options.onProgress?.(completeProgress);
        
        results.push(completeProgress[i]);
      } catch (error) {
        // Better error messages for common storage failures
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
        
        // Update to error
        const errorProgress = [...initialProgress];
        errorProgress[i] = {
          ...errorProgress[i],
          status: 'error',
          progress: 0,
          error: errorMessage
        };
        setProgress(errorProgress);
        options.onProgress?.(errorProgress);
        
        results.push(errorProgress[i]);
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

    // 1. Get the unmatched photo
    const { data: unmatchedPhoto, error: fetchError } = await supabase
      .from('unmatched_photos')
      .select('*')
      .eq('id', unmatchedPhotoId)
      .single();

    if (fetchError || !unmatchedPhoto) throw new Error('Photo not found');

    // Parse AI analysis safely
    const aiAnalysis = unmatchedPhoto.ai_analysis as Record<string, unknown> | null;

    // 2. Create vehicle_photo record
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

    // 3. Update unmatched photo status
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
    const { error } = await supabase
      .from('vehicle_photos')
      .update({ photo_type: 'hero' })
      .eq('id', photoId);

    if (error) throw error;
  }, []);

  /**
   * Delete a photo
   */
  const deletePhoto = useCallback(async (photoId: string): Promise<void> => {
    // Get the photo first to delete from storage
    const { data: photo } = await supabase
      .from('vehicle_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (photo?.storage_path) {
      await supabase.storage
        .from('vehicle-photos')
        .remove([photo.storage_path]);
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
  const reorderPhotos = useCallback(async (
    vehicleId: string,
    photoIds: string[]
  ): Promise<void> => {
    // Update each photo's display_order
    const updates = photoIds.map((id, index) => 
      supabase
        .from('vehicle_photos')
        .update({ display_order: index })
        .eq('id', id)
    );

    await Promise.all(updates);
  }, []);

  return {
    isProcessing,
    progress,
    uploadAndAnalyze,
    processBatch,
    matchPhotoToVehicle,
    setAsHero,
    deletePhoto,
    reorderPhotos,
    analyzePhoto
  };
}
