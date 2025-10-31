import { supabase } from '@/integrations/supabase/client';

export interface PhotoUploadResult {
  url: string;
  path: string;
  error?: string;
}

/**
 * Upload a photo to vehicle-photos bucket
 * @param file - The image file to upload
 * @param folder - The folder path (e.g., userId/inspectionId)
 * @returns PhotoUploadResult with url and path or error
 */
export const uploadVehiclePhoto = async (
  file: File,
  folder: string
): Promise<PhotoUploadResult> => {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      return {
        url: '',
        path: '',
        error: 'Invalid file type. Please upload JPEG, PNG, WEBP, or HEIC images.'
      };
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        url: '',
        path: '',
        error: 'File size exceeds 5MB limit.'
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const fileName = `${folder}/${timestamp}-${randomString}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('vehicle-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        url: '',
        path: '',
        error: error.message
      };
    }

    // Get signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('vehicle-photos')
      .createSignedUrl(data.path, 3600);

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return {
        url: '',
        path: '',
        error: signedError.message
      };
    }

    return {
      url: signedData.signedUrl,
      path: data.path
    };
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return {
      url: '',
      path: '',
      error: error.message || 'Failed to upload photo'
    };
  }
};

/**
 * Delete a photo from vehicle-photos bucket
 * @param path - The storage path of the photo
 * @returns boolean indicating success
 */
export const deleteVehiclePhoto = async (path: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('vehicle-photos')
      .remove([path]);

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
 * Get signed URL for private photo access (if bucket becomes private)
 * @param path - The storage path of the photo
 * @param expiresIn - Seconds until URL expires (default 3600 = 1 hour)
 * @returns string URL or empty string on error
 */
export const getSignedPhotoUrl = async (
  path: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('vehicle-photos')
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
