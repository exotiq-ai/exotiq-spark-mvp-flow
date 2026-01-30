
# Fix: Hero Photo Enhancement - Private Bucket URL Issue

## Root Cause Analysis

I've completed a thorough review of the backend and found the **exact issue** preventing the hero enhancement from working:

### The Problem

**The `vehicle-photos` bucket is PRIVATE**, but the edge function uses `getPublicUrl()` to generate the enhanced image URL.

```sql
-- Current bucket configuration:
id: 'vehicle-photos'
public: false  ← PRIVATE BUCKET
```

When PhotoRoom successfully enhances the image and the edge function uploads it to storage:
1. Upload succeeds (`Enhanced image uploaded to storage: enhanced/b6bd...`)
2. `getPublicUrl()` returns a URL like: `https://...supabase.co/storage/v1/object/public/vehicle-photos/enhanced/...`
3. This URL returns **404** because the bucket is private - only **signed URLs** work for private buckets

### Evidence from Logs & Network

**Edge function logs show success:**
```
2026-01-30T00:09:03Z INFO Enhanced image uploaded to storage: enhanced/b6bddef8-...
2026-01-30T00:09:03Z INFO Hero photo enhanced in 2809ms
```

**But client shows 404:**
```
Failed to load resource: the server responded with a status of 404 ()
```

The URL `https://...supabase.co/storage/v1/object/public/vehicle-photos/enhanced/...` doesn't work because `/object/public/` requires a public bucket.

---

## The Fix

### Option A: Use Signed URLs (Recommended)
Keep the bucket private for security, but generate a signed URL instead of a public URL.

**Change in `supabase/functions/enhance-hero-photo/index.ts`:**

```typescript
// BEFORE (broken for private bucket):
const { data: urlData } = serviceClient.storage
  .from('vehicle-photos')
  .getPublicUrl(fileName);
enhancedUrl = urlData.publicUrl;

// AFTER (works for private bucket):
const { data: signedData, error: signedError } = await serviceClient.storage
  .from('vehicle-photos')
  .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

if (signedError) {
  throw new Error(`Failed to create signed URL: ${signedError.message}`);
}
enhancedUrl = signedData.signedUrl;
```

This matches the pattern already used successfully in `usePhotoAnalysis.ts` and `AddVehicleFromPhotoWizard.tsx`.

### Option B: Make Bucket Public (Not Recommended)
We could change the bucket to public, but this would expose all vehicle photos to the internet without authentication - not ideal for a fleet management system.

---

## Additional Issues Found

### 1. UI Shows Blank Enhanced Panel
The console logs show the enhanced image URL returning 404, which causes the `<img>` tag to render nothing. The error isn't being caught properly.

**Fix:** Add `onError` handler to the enhanced image:
```tsx
<motion.img
  src={enhancedUrl}
  onError={(e) => {
    console.error('Failed to load enhanced image:', enhancedUrl);
    setError('Enhanced image failed to load');
  }}
/>
```

### 2. Stack Overflow - Already Fixed
The previous "Maximum call stack size exceeded" error was fixed by using `base64Encode` from Deno's standard library. This is now working (confirmed in logs after 00:08:46).

---

## Implementation Summary

| File | Change |
|------|--------|
| `supabase/functions/enhance-hero-photo/index.ts` | Replace `getPublicUrl()` with `createSignedUrl()` |
| `src/components/photos/HeroEnhancementPreview.tsx` | Add `onError` handler for better error feedback |

### Technical Details

The signed URL pattern is already used consistently throughout the codebase:
- `src/lib/photoUpload.ts` (line 66-68) - 1 hour expiry
- `src/components/photos/usePhotoAnalysis.ts` (line 44-46) - 1 year expiry  
- `src/components/photos/AddVehicleFromPhotoWizard.tsx` (line 161-163) - 1 year expiry

Using 1-year signed URLs for enhanced photos matches existing patterns and ensures URLs remain valid long-term.

---

## Why This Keeps Breaking

The root issue is a **pattern inconsistency**:
- Original photos use `createSignedUrl()` (private-compatible)
- Enhanced photos used `getPublicUrl()` (public-only)

Both should use the same pattern for a private bucket.
