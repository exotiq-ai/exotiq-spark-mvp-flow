

# Photo Hub Hardening — Plan

Your audit is accurate on every point. Here's the validated status and build plan.

## Corrections to Documentation

1. **Display preset**: Code is `1600px / 0.82`, not `1200px/80%`. The recap was wrong — code is truth. No code change needed, just a doc fix.
2. **Photo coverage on FleetVehicleCard**: Confirmed present (lines 348-361, camera badge with X/11). Removing from gap list.

## Confirmed Gaps (all validated in code)

| Issue | Evidence |
|-------|----------|
| `photo_upload_batches` unused | Zero app-side references outside `types.ts` — table exists, never written to |
| Cleanup function never invoked | No app-side call, no cron config in `config.toml` |
| Thumbnail leak on cleanup | `cleanup-unmatched-photos` deletes `storage_path` only, not `_thumb.jpg` derivative |
| `width`/`height` never populated | No insert in the codebase writes these columns |
| No drag-to-reorder UI | `reorderPhotos` exists in `usePhotoAnalysis`, no sortable UI |
| No retry-failed in bulk upload | Progress is in-memory only, no retry mechanism |
| No dedup guard | Same file can be uploaded multiple times |

## Build Plan (6 items, ordered by impact)

### 1. Fix thumbnail leak in cleanup function
**`supabase/functions/cleanup-unmatched-photos/index.ts`**
- When building `paths` array for rejected photos, also compute and include `storage_path.replace(/\.[^.]+$/, '_thumb.jpg')` for each entry
- Same pattern already used in `usePhotoAnalysis.deletePhoto` and `photoUpload.deleteVehiclePhoto`

### 2. Persist image dimensions on upload
**`src/components/photos/usePhotoAnalysis.ts`**
- In `uploadToStorage`, after `createImageBitmap(file)` (already done during compression), capture `width`/`height` and return them alongside `path`, `url`, `compressedBytes`
- In `uploadAndAnalyze`, pass `width`/`height` into the `vehicle_photos` and `unmatched_photos` insert payloads
- Lightweight: `createImageBitmap` is already called by `compressImage` — we just need to call it once more in `uploadToStorage` or thread the values through

### 3. Add retry-failed to bulk upload
**`src/components/photos/BulkUploadModal.tsx`**
- After upload completes, if any items have `status === 'error'`, show a "Retry N failed" button
- Button filters `uploadProgress` for failed items, extracts the original `File` objects (already in memory), and calls `processBatch` again with just those files
- No backend change needed — purely UI/state

### 4. Add dedup guard (lightweight)
**`src/components/photos/usePhotoAnalysis.ts`** — in `processBatch`
- Before upload, compute a key per file: `${file.name}_${file.size}_${file.lastModified}`
- Check against existing `vehicle_photos` for the target vehicle using `original_filename` + `file_size_bytes` match
- If duplicate found, mark that file's progress as `skipped` with reason "Duplicate detected"
- Lightweight, no hash computation, no new DB columns

### 5. Add drag-to-reorder UI
**`src/components/photos/VehiclePhotoManager.tsx`**
- Wrap photo grid in a sortable container using HTML5 drag events (no new dependency — keep it native)
- Each `PhotoThumbnail` gets `draggable`, `onDragStart`, `onDragOver`, `onDrop`
- On drop: reorder local array optimistically, call `reorderPhotos(vehicleId, newOrderedIds)`
- Add a subtle drag handle indicator on hover

### 6. Wire cleanup function invocation
**`src/components/photos/PhotoHubTab.tsx`**
- Add a "Clean Up Queue" action button (visible when there are matched or rejected items in the queue)
- On click: calls `supabase.functions.invoke('cleanup-unmatched-photos')` with auth header
- Shows toast with results (N files cleaned, N rows removed)
- This is a manual trigger for now — cron can be added later via `pg_cron` if volume warrants it

## NOT doing (and why)

- **`photo_upload_batches` wiring**: The batch table was designed for a server-side orchestration pattern that never materialized. The client-side `processBatch` with in-memory progress works well. Wiring the table adds complexity without user value. Recommend keeping the table for future server-side batch jobs but not forcing it into the current client-side flow.
- **Signed URL auto-refresh**: 1-year URLs for photos and per-fetch regeneration for review queue is sufficient. No user reports of breakage. Add only if needed.

## Files Summary

| Action | File |
|--------|------|
| Fix | `supabase/functions/cleanup-unmatched-photos/index.ts` |
| Enhance | `src/components/photos/usePhotoAnalysis.ts` |
| Enhance | `src/components/photos/BulkUploadModal.tsx` |
| Enhance | `src/components/photos/VehiclePhotoManager.tsx` |
| Enhance | `src/components/photos/PhotoHubTab.tsx` |

**Total: 5 files modified, 0 new files, 0 migrations.**

