import { supabase } from '@/integrations/supabase/client';
import { compressImage, generateThumbnail, UPLOAD_PRESETS, type UploadPreset } from './imageCompression';
import { isFeatureEnabled } from './featureFlags';

export interface PhotoUploadResult {
  url: string;
  path: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  originalBytes: number;
  compressedBytes: number;
  error?: string;
}

/**
 * Unified photo upload entry point for all surfaces.
 * Handles compression, thumbnail generation, and signed URL creation.
 * 
 * @param file - The image file to upload
 * @param folder - The folder path (e.g., userId/inspectionId)
 * @param userId - The authenticated user's ID
 * @param options.preset - Compression preset (default: 'operational')
 * @param options.bucket - Storage bucket (default: 'vehicle-photos')
 */
export const uploadVehiclePhoto = async (
  file: File, 
  folder: string,
  userId: string,
  options?: {
    preset?: UploadPreset;
    bucket?: string;
  }
): Promise<PhotoUploadResult> => {
  const preset = options?.preset ?? 'operational';
  const bucket = options?.bucket ?? 'vehicle-photos';
  const originalBytes = file.size;

  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      return {
        url: '', path: '', originalBytes, compressedBytes: 0,
        error: 'Invalid file type. Please upload JPEG, PNG, WEBP, or HEIC images.'
      };
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        url: '', path: '', originalBytes, compressedBytes: 0,
        error: 'File size exceeds 10MB limit.'
      };
    }

    // Compress image with context-aware preset
    const presetOptions = isFeatureEnabled('uploadPresets') ? UPLOAD_PRESETS[preset] : undefined;
    const compressedFile = await compressImage(file, presetOptions);
    const compressedBytes = compressedFile.size;

    // Generate unique filename with userId prefix for RLS
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = compressedFile.name.split('.').pop();
    const fileName = `${userId}/${folder}/${timestamp}-${randomString}.${extension}`;

    // Upload main file to storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return { url: '', path: '', originalBytes, compressedBytes, error: error.message };
    }

    // Get 1-year signed URL for private bucket access
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return { url: '', path: '', originalBytes, compressedBytes, error: signedError.message };
    }

    const result: PhotoUploadResult = {
      url: signedData.signedUrl,
      path: data.path,
      originalBytes,
      compressedBytes,
    };

    // Generate and upload thumbnail
    if (isFeatureEnabled('thumbnailGeneration')) {
      try {
        const thumbnail = await generateThumbnail(file);
        const thumbPath = data.path.replace(/\.[^.]+$/, '_thumb.jpg');

        const { error: thumbError } = await supabase.storage
          .from(bucket)
          .upload(thumbPath, thumbnail, {
            cacheControl: '3600',
            upsert: false
          });

        if (!thumbError) {
          const { data: thumbSignedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(thumbPath, 60 * 60 * 24 * 365);

          if (thumbSignedData?.signedUrl) {
            result.thumbnailUrl = thumbSignedData.signedUrl;
            result.thumbnailPath = thumbPath;
          }
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation failed, continuing without:', thumbErr);
      }
    }

    return result;
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return {
      url: '', path: '', originalBytes, compressedBytes: 0,
      error: error.message || 'Failed to upload photo'
    };
  }
};

/**
 * Delete a photo and its thumbnail from storage.
 * @param path - The storage path of the photo
 * @param bucket - The storage bucket (default: 'vehicle-photos')
 */
export const deleteVehiclePhoto = async (
  path: string,
  bucket: string = 'vehicle-photos'
): Promise<boolean> => {
  try {
    // Compute thumbnail path
    const thumbPath = path.replace(/\.[^.]+$/, '_thumb.jpg');
    
    // Delete both main file and thumbnail in one call
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path, thumbPath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Photo delete error:', error);
    return false;
  }
};

/**
 * Get signed URL for private photo access
 * @param path - The storage path of the photo
 * @param expiresIn - Seconds until URL expires (default 1 year)
 * @param bucket - Storage bucket (default: 'vehicle-photos')
 */
export const getSignedPhotoUrl = async (
  path: string,
  expiresIn: number = 60 * 60 * 24 * 365,
  bucket: string = 'vehicle-photos'
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return '';
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Get signed URL error:', error);
    return '';
  }
};
