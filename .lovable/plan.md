
# Fix: Hero Photo Enhancement - Stack Overflow Error

## Problem Identified

The `enhance-hero-photo` edge function crashes with **"Maximum call stack size exceeded"** when processing vehicle photos.

### Root Cause

**Line 131** in `supabase/functions/enhance-hero-photo/index.ts`:
```typescript
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
```

This code uses the spread operator (`...`) to pass every byte of the image as a separate argument to `String.fromCharCode()`. For a typical 2-3MB vehicle photo, this means spreading 2-3 million arguments, which instantly exceeds JavaScript's call stack limit.

### Evidence from Logs
```
RangeError: Maximum call stack size exceeded
    at Server.<anonymous> (...enhance-hero-photo/index.ts:105:32)
```

The error points to line 105 in the compiled version, which corresponds to the base64 conversion logic.

---

## Solution

Replace the problematic base64 encoding with Deno's standard library `base64Encode` function, which handles large binary data properly by processing it in chunks.

### Before (Broken)
```typescript
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
```

### After (Fixed)
```typescript
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// ... in the handler:
const base64 = base64Encode(arrayBuffer);
```

This pattern is already used successfully in the `elevenlabs-session` function.

---

## Additional Improvements

While fixing this, I'll also make the enhancement flow more robust:

### 1. Better Error Messages
Add specific error messages for common failure scenarios (file too large, network timeout, PhotoRoom API issues).

### 2. Option to Upload Enhanced Image to Storage
Currently, the enhanced image is returned as a base64 data URI, which can be very large (3-5MB for high-res photos). Consider uploading to Supabase Storage instead and returning a proper URL.

### 3. Processing Size Limit
Add a file size check to prevent processing extremely large images that might still cause issues.

---

## Implementation Plan

### File: `supabase/functions/enhance-hero-photo/index.ts`

**Changes:**

1. **Line 2** - Add import for Deno's base64 encoder:
```typescript
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
```

2. **Line 131** - Replace the broken base64 conversion:
```typescript
// BEFORE:
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

// AFTER:
const base64 = base64Encode(arrayBuffer);
```

3. **Add file size validation** - Before processing, check if the image is too large:
```typescript
if (imageBlob.size > 15 * 1024 * 1024) { // 15MB limit
  throw new Error('Image too large for enhancement. Maximum size is 15MB.');
}
```

4. **Optional: Upload to Storage instead of base64 return** - For better performance and to avoid large payloads:
```typescript
// Upload enhanced image to storage bucket
const fileName = `enhanced/${photoId}_${Date.now()}.${outputFormat}`;
const { data: uploadData, error: uploadError } = await supabase
  .storage
  .from('vehicle-photos')
  .upload(fileName, enhancedBlob, {
    contentType: mimeType,
    upsert: true
  });

if (uploadError) throw uploadError;

const { data: urlData } = supabase.storage
  .from('vehicle-photos')
  .getPublicUrl(fileName);

const enhancedUrl = urlData.publicUrl;
```

---

## Summary

| Change | Impact |
|--------|--------|
| Fix base64 encoding | Eliminates stack overflow error |
| Add file size check | Prevents processing files too large for PhotoRoom |
| Upload to storage (optional) | Reduces response payload size, faster UI updates |

### Files to Modify
- `supabase/functions/enhance-hero-photo/index.ts`

This is a one-file fix that will make the hero enhancement feature work properly. The UI component (`HeroEnhancementPreview.tsx`) is already correctly implemented and doesn't need changes.
