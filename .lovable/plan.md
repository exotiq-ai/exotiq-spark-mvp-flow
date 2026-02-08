

# Storage & Database Optimization Plan

## Overview

Three targeted optimizations to reduce database bloat and storage costs with zero risk to live functionality.

---

## Task 1: Purge Stale Notifications

**Problem:** 8,770 notification rows in the database, 8,723 of which are older than 30 days. The 30-day purge policy documented in the project was never activated.

**Solution:** Two-part approach -- immediate cleanup via a one-time SQL delete, then a scheduled database function to auto-purge going forward.

### Step 1a: One-Time Purge (SQL Migration)

Run a DELETE statement to remove all notifications older than 30 days:

```sql
DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
```

This clears ~8,700 rows and reclaims ~2.5 MB immediately.

### Step 1b: Scheduled Auto-Purge (Database Function + pg_cron)

Create a database function that deletes old notifications, triggered by Supabase's built-in `pg_cron` extension:

- Function `purge_old_notifications()` deletes rows older than 30 days
- Scheduled to run daily at 3:00 AM UTC
- Keeps the table lean permanently with no manual intervention

**Risk:** None. Old, read notifications have no functional purpose. The realtime subscription only listens for INSERTs on the current user's notifications.

---

## Task 2: Clean Up Unmatched Photos

**Problem:** 12 photos still in `pending` status in the `unmatched_photos` table, plus 26 already matched and 3 rejected. The matched/rejected rows still reference storage files that may no longer be needed.

**Solution:** Add a "Bulk Reject All" action to the existing Photo Review Queue UI, and clean up orphaned storage files for resolved entries.

### Step 2a: Add "Reject All Pending" Button

Add a bulk action button to `PhotoReviewQueue.tsx` that calls the existing `batchRejectPhotos` function (already implemented in `usePhotoReviewQueue`) for all pending items at once.

### Step 2b: Storage Cleanup for Resolved Photos

Create a database function `cleanup_resolved_unmatched_photos()` that:

1. Finds `unmatched_photos` rows with status `rejected` (currently 3)
2. Deletes the associated files from `vehicle-photos` storage
3. Hard-deletes the database rows

For `matched` rows (26), the storage files are still in use by `vehicle_photos` records, so only the `unmatched_photos` row is deleted (the photo itself stays).

This will be implemented as a backend function callable from an admin action, not automated, to give control over what gets purged.

**Risk:** Low. Rejected photos are explicitly unwanted. Matched photo rows are cleaned from the queue table only -- the actual files remain linked to their vehicles.

---

## Task 3: Client-Side Image Compression

**Problem:** Uploaded photos average 900 KB to 2.3 MB. Most are displayed as thumbnails or medium-size previews, making full-resolution uploads wasteful.

**Solution:** Add a `compressImage()` utility that runs in the browser before upload, using the native Canvas API (no new dependencies).

### Compression Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max width | 2048px | Sufficient for hero images and detail views |
| Max height | 2048px | Maintains aspect ratio |
| Output format | JPEG | Smaller than PNG for photos |
| Quality | 0.82 | Good balance of quality vs. size |
| Expected reduction | 50-70% | 2 MB photo becomes ~600-800 KB |

### Implementation

**New file:** `src/lib/imageCompression.ts`

- `compressImage(file: File, options?): Promise<File>` -- resizes and compresses using `<canvas>` and `canvas.toBlob()`
- Preserves aspect ratio, skips files already under 500 KB
- Returns a new `File` object (same name, JPEG type)

**Modified file:** `src/lib/photoUpload.ts`

- Call `compressImage()` before the storage upload in `uploadVehiclePhoto()`
- The 5 MB validation check stays as a safety net, but most files will now be well under 1 MB

**Modified file:** `src/components/photos/usePhotoAnalysis.ts`

- Call `compressImage()` in `uploadToStorage()` before the `supabase.storage.upload()` call
- Both upload paths (direct upload and bulk upload) benefit automatically

### No New Dependencies

This uses only the browser-native `HTMLCanvasElement` and `canvas.toBlob()` APIs, which are supported in all modern browsers. No library install needed.

**Risk:** Very low. Compression is purely additive -- if it fails for any reason, the original file is uploaded unchanged. Image quality at 0.82 JPEG is visually indistinguishable from the original for automotive photography.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/imageCompression.ts` | Client-side image resize and compress utility |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/photoUpload.ts` | Add compression before upload |
| `src/components/photos/usePhotoAnalysis.ts` | Add compression in uploadToStorage |
| `src/components/photos/PhotoReviewQueue.tsx` | Add "Reject All" bulk action button |

## Database Changes

| Change | Type |
|--------|------|
| Delete notifications older than 30 days | One-time SQL migration |
| Create `purge_old_notifications()` function | SQL migration |
| Schedule daily cron job for purge | SQL migration (pg_cron) |
| Create `cleanup_resolved_unmatched_photos()` function | SQL migration |

## Impact Summary

| Optimization | Savings | Ongoing |
|-------------|---------|---------|
| Notification purge | ~2.5 MB immediately | Auto-purge daily |
| Unmatched photo cleanup | ~10-30 MB (rejected files) | Manual as needed |
| Image compression | 50-70% per future upload | Automatic |

