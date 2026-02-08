/**
 * Client-side image compression using the native Canvas API.
 * Resizes and compresses images before upload to reduce storage costs.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** Files under this size (in bytes) are returned unchanged */
  skipUnderBytes?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.82,
  skipUnderBytes: 500 * 1024, // 500 KB
};

/**
 * Compress an image file using the browser Canvas API.
 * - Resizes to fit within maxWidth/maxHeight while preserving aspect ratio
 * - Outputs as JPEG at the specified quality
 * - Skips files already under skipUnderBytes
 * - Returns the original file unchanged if compression fails
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip small files
  if (file.size <= opts.skipUnderBytes) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Calculate new dimensions preserving aspect ratio
    let newWidth = width;
    let newHeight = height;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    // If no resize needed and file is already JPEG, only re-encode at target quality
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas context unavailable, returning original file');
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: opts.quality,
    });

    // Only use compressed version if it's actually smaller
    if (blob.size >= file.size) {
      return file;
    }

    // Preserve original filename but change extension to .jpg
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${nameWithoutExt}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Image compression failed, using original file:', error);
    return file;
  }
}
