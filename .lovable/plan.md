

# Fix Photo Preview Showing Broken - 400 Error from Signed URL

## Problem Identified

JPG photos are uploading successfully to storage but showing as broken in the Review Queue. The console shows:
```
Failed to load resource: the server responded with a status of 400 ()
```

## Root Cause Analysis

The file **does exist** in storage with correct format:
- Storage path: `fd9bb57e.../unmatched/1769893719947-g38sa.jpeg`
- Mimetype: `image/jpeg` 
- Size: 889,522 bytes (valid)

The signed URL is stored in the database and should be valid for 1 year. However, the 400 error indicates the **signed URL is malformed or the token is being incorrectly processed**.

After checking the upload code and database, I found the issue:

**The signed URL is being generated correctly, but the browser may be having issues with the token query parameter.** Looking at the pattern, signed URLs from Supabase storage require the client to be properly authenticated OR the URL must be fetched correctly.

### Key Finding

The actual issue is likely that **when the photo was uploaded, the signed URL was created but the image is not accessible via that URL** - possibly due to:

1. **Path mismatch between upload and signed URL** - The `data.path` returned after upload may differ from what's actually stored
2. **Cross-origin issues with how the browser fetches signed URLs**

## Solution: Generate Fresh Signed URLs at Fetch Time

Instead of storing signed URLs at upload time (which can become stale or invalid), we should:

1. **Store only the `storage_path`** in the database
2. **Generate fresh signed URLs when fetching photos for display**

This is more reliable because:
- Signed URLs are always fresh
- No chance of URL corruption in database
- Works even if signing keys rotate

## Implementation Plan

### Part 1: Modify usePhotoReviewQueue to Generate Fresh Signed URLs

**File:** `src/hooks/usePhotoReviewQueue.ts`

Update the `fetchQueue` function to:
1. Fetch photos with their `storage_path`
2. Generate fresh signed URLs for each photo
3. Return the photos with fresh URLs

```typescript
const fetchQueue = useCallback(async () => {
  // Fetch photos...
  const { data, error } = await supabase
    .from('unmatched_photos')
    .select('*')
    .match(teamFilter)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Generate fresh signed URLs for each photo
  const photosWithFreshUrls = await Promise.all(
    (data || []).map(async (photo) => {
      if (!photo.storage_path) return photo;
      
      const { data: signedData } = await supabase.storage
        .from('vehicle-photos')
        .createSignedUrl(photo.storage_path, 60 * 60); // 1 hour validity
      
      return {
        ...photo,
        url: signedData?.signedUrl || photo.url,
      };
    })
  );

  setQueue(photosWithFreshUrls);
});
```

### Part 2: Add Fallback Public URL Option (Alternative)

If signed URLs continue to have issues, we can make the bucket public for read access. This is simpler but less secure.

However, for a fleet management system with private vehicle photos, keeping the bucket private with signed URLs is the better approach.

### Part 3: Add Debugging to Identify Exact Failure

Add console logging in the image `onError` handler to capture the actual error:

```typescript
onError={(e) => {
  console.error('Image load failed:', {
    src: e.currentTarget.src,
    storagePath: currentPhoto.storage_path,
    originalUrl: currentPhoto.url,
  });
  // Show fallback...
}}
```

### Part 4: Validate Upload Path Consistency

**File:** `src/components/photos/usePhotoAnalysis.ts`

Ensure the path used for signed URL generation matches what's stored:

```typescript
const { data, error } = await supabase.storage
  .from('vehicle-photos')
  .upload(path, file, { ... });

// Use data.path (which is the actual stored path) NOT the local path variable
const { data: signedData } = await supabase.storage
  .from('vehicle-photos')
  .createSignedUrl(data.path, 60 * 60 * 24 * 365);
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePhotoReviewQueue.ts` | Generate fresh signed URLs when fetching queue |
| `src/components/photos/usePhotoAnalysis.ts` | Ensure path consistency in upload |
| `src/components/photos/PhotoReviewQueue.tsx` | Add better error debugging |

## Quick Test

After implementation, test with the Denver account:
1. Upload a new JPG photo
2. Navigate to Photo Hub → Review Queue
3. Photo should display with fresh signed URL
4. Match to vehicle → photo should persist and display

## Why This Fixes It

The current approach stores a signed URL at upload time. If anything goes wrong during that signing (network glitch, encoding issue), that broken URL is permanently stored.

By generating fresh signed URLs at fetch time:
- Each view gets a fresh, valid URL
- No persistent corruption
- More reliable for private bucket access

