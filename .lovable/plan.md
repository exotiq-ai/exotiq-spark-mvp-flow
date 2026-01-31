

# Fix Photo Upload - Broken Previews and AI Analysis Failures

## Problem Summary

Photos upload successfully to storage but:
1. **Preview images are broken** (showing placeholder/broken image icon)
2. **AI analysis returns empty results** (0% confidence, "Unknown" angle)
3. Photos can be saved to vehicles but still don't display

## Root Causes Identified

### Issue 1: HEIC Format Not Browser-Compatible
The uploaded file `IMG_8832.HEIC` is stored with `.HEIC` extension. Browsers cannot natively display HEIC images - they require conversion to JPEG/PNG/WebP.

**Evidence from database:**
```
storage_path: fd9bb57e.../unmatched/1769892483530-i1r0k.HEIC
```

### Issue 2: Google Vision API Cannot Access Signed URLs
The signed URLs generated for private bucket access contain authentication tokens. When passed to Google Vision API:
- Vision API makes external request to fetch the image
- The signed URL may have CORS or access restrictions
- Result: Vision API returns empty labels/objects

**Evidence from edge function logs:**
```
Labels detected: []
Objects detected: []
Analysis result: { isVehicle: false, confidence: 0, angle: "unknown" }
```

### Issue 3: HEIC Not Supported by Vision API
Google Cloud Vision API does not support HEIC format directly. Even if the URL was accessible, the format would fail.

---

## Solution Plan

### Fix 1: Convert HEIC to JPEG on Upload (Client-Side)
**File:** `src/components/photos/usePhotoAnalysis.ts`

Before uploading, detect HEIC files and convert them to JPEG using HTML Canvas or a library:

```typescript
const convertHeicToJpeg = async (file: File): Promise<File> => {
  // Use heic2any or similar library
  // Or: Skip HEIC for now and show user-friendly error
};
```

**Simpler approach (recommended for quick fix):**
- Detect HEIC files and skip them with a user-friendly message
- Prompt user to convert to JPEG before uploading

### Fix 2: Send Base64 to Vision API Instead of URL
**File:** `supabase/functions/analyze-vehicle-photo/index.ts`

The current flow passes signed URL to Vision API. Instead:
1. Edge function fetches the image using the signed URL (server-side, no CORS)
2. Convert to base64
3. Send base64 to Vision API (which accepts `content` field)

```typescript
// Fetch image from storage using signed URL
const imageResponse = await fetch(imageUrl);
const arrayBuffer = await imageResponse.arrayBuffer();
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

// Send to Vision API as base64
imageContent = { content: base64 };
```

### Fix 3: Skip AI Analysis for Swift Onboarding (Quick Win)
**Files:** `src/components/photos/usePhotoAnalysis.ts`

Add option to skip AI analysis entirely and just upload:

```typescript
const processBatch = async (
  files: File[],
  vehicleId?: string,
  options?: { skipAnalysis?: boolean }
)
```

When `skipAnalysis: true`:
- Upload file to storage
- Save to database with default values (unknown angle, 100% quality)
- Skip Vision API call entirely

This unblocks customer onboarding immediately.

### Fix 4: Add Image Error Handling in UI
**File:** `src/components/photos/PhotoReviewQueue.tsx`

Add `onError` handler for broken images to show placeholder gracefully:

```tsx
<img
  src={currentPhoto.url}
  alt={currentPhoto.original_filename || 'Photo'}
  onError={(e) => {
    e.currentTarget.src = '/placeholder-image.png';
    // Or show ImageOff icon
  }}
/>
```

### Fix 5: Validate File Format Before Upload
**File:** `src/components/photos/BulkUploadModal.tsx`

Filter out HEIC files with warning:

```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
  const droppedFiles = Array.from(e.dataTransfer.files).filter(f => {
    if (f.name.toLowerCase().endsWith('.heic')) {
      toast.warning(`${f.name}: HEIC format not supported. Please convert to JPEG.`);
      return false;
    }
    // ... rest of validation
  });
});
```

---

## Implementation Priority

### Phase 1: Quick Fixes for Immediate Onboarding (Do First)

| Fix | File | Impact |
|-----|------|--------|
| Skip AI analysis option | `usePhotoAnalysis.ts` | Unblocks uploads immediately |
| Filter HEIC with warning | `BulkUploadModal.tsx` | Prevents broken uploads |
| Add image error handler | `PhotoReviewQueue.tsx` | Shows fallback for broken images |
| Add image error handler | `VehiclePhotoManager.tsx` | Shows fallback for broken images |

### Phase 2: Proper Fix (After Onboarding)

| Fix | File | Impact |
|-----|------|--------|
| Base64 to Vision API | Edge function | Enables AI analysis to work |
| HEIC to JPEG conversion | Client-side | Supports iPhone photos |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/photos/usePhotoAnalysis.ts` | Add `skipAnalysis` option to bypass Vision API |
| `src/components/photos/BulkUploadModal.tsx` | Filter HEIC files with user warning |
| `src/components/photos/PhotoReviewQueue.tsx` | Add `onError` handler for broken images |
| `src/components/photos/VehiclePhotoManager.tsx` | Add `onError` handler for broken images |
| `supabase/functions/analyze-vehicle-photo/index.ts` | Fetch image server-side and send base64 to Vision API |

---

## Expected Outcome

After Phase 1:
- HEIC files are blocked with helpful message ("Please convert to JPEG")
- Other images upload and save successfully (even without AI analysis)
- Broken images show fallback placeholder instead of broken icon
- Customer onboarding can proceed immediately

After Phase 2:
- AI analysis works for all supported formats
- Vision API receives base64 data (no URL access issues)
- HEIC files can be converted and uploaded

