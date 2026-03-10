
# Photo Hub v2 — Storage Optimization & Upload Performance

## Status: ✅ Implemented

## What Was Built

### 1. Upload Presets & Thumbnail Generator ✅
- **File:** `src/lib/imageCompression.ts`
- Named presets: `hero` (2048px/90%), `display` (1600px/82%), `operational` (1200px/70%), `thumbnail` (400px/70%)
- `generateThumbnail()` function using thumbnail preset
- Existing `compressImage()` signature unchanged — backward compatible

### 2. Unified Photo Upload Entry Point ✅
- **File:** `src/lib/photoUpload.ts`
- Single entry point for ALL upload surfaces
- `preset` param (default: `operational`) and `bucket` param (default: `vehicle-photos`)
- 1-year signed URLs for private bucket access
- Automatic thumbnail generation and upload
- File size limit raised to 10MB
- `deleteVehiclePhoto()` deletes both main file and thumbnail

### 3. Filename-Based Auto-Matching ✅
- **File:** `src/lib/filenameVehicleMatcher.ts`
- Deterministic scorer: make+model=high, make-only=medium, color boost
- Strips camera prefixes (IMG, DSC), numeric suffixes
- Extracts angle hints from filenames (front, rear, interior, etc.)
- Feature-flagged via `filenameAutoMatch`

### 4. Session Metrics Tracker ✅
- **File:** `src/lib/uploadMetrics.ts`
- In-memory tracker: original bytes, compressed bytes, duration, match result
- `getSessionStats()`: compression ratio, auto-match rate, saved bytes
- `formatBytes()` helper for UI display

### 5. Feature Flags ✅
- **File:** `src/lib/featureFlags.ts`
- 4 new flags: `filenameAutoMatch`, `uploadPresets`, `thumbnailGeneration`, `concurrentUploads`

### 6. Concurrent Batch Processing ✅
- **File:** `src/components/photos/usePhotoAnalysis.ts`
- `processWithConcurrency()` pool (3 parallel uploads)
- Thumbnail upload + `thumbnail_url` written to DB
- Filename matcher integration: auto-assign on high confidence, suggest on medium
- `deletePhoto()` deletes both main file and thumbnail
- Metrics recorded per upload

### 7. Updated Progress Types ✅
- **File:** `src/components/photos/types.ts`
- New statuses: `preprocessing`, `matching`
- `matchResult`: `auto-matched` | `suggested` | `unmatched` | `skipped`
- `compressionStats`: `{ originalBytes, compressedBytes }`

### 8. Operational Surface Alignment ✅
- **DamageReportDialog.tsx**: Routes through `uploadVehiclePhoto()` with `operational` preset and `damage-photos` bucket. **Fixed latent bug**: was using `getPublicUrl` on private bucket (would 403), now uses signed URLs.
- **CheckInOutDialog.tsx**: Routes through `uploadVehiclePhoto()` with `operational` preset
- **InspectionWidget.tsx**: Routes through `uploadVehiclePhoto()` with `operational` preset

### 9. Bulk Upload UI Updates ✅
- **File:** `src/components/photos/BulkUploadModal.tsx`
- Per-file match badges: "Auto-matched", "Suggested", "Review needed", "Assigned"
- Session summary after completion: saved MB, compression ratio, auto-match count
- New status labels for `preprocessing` and `matching` stages
- Vehicles passed to `processBatch()` for filename matching

### 10. Photo Hub Metrics Display ✅
- **File:** `src/components/photos/PhotoHubTab.tsx`
- Session metrics banner: saved bytes, compression ratio, auto-match count
- Animated appearance after bulk upload

## Files Created
- `src/lib/filenameVehicleMatcher.ts`
- `src/lib/uploadMetrics.ts`

## Files Modified
- `src/lib/imageCompression.ts` (presets + thumbnail generator)
- `src/lib/photoUpload.ts` (unified entry point)
- `src/lib/featureFlags.ts` (4 new flags)
- `src/components/photos/types.ts` (new progress states)
- `src/components/photos/usePhotoAnalysis.ts` (concurrency, thumbnails, matcher, metrics, delete lifecycle)
- `src/components/photos/BulkUploadModal.tsx` (match badges, session summary)
- `src/components/photos/PhotoHubTab.tsx` (session metrics display)
- `src/components/dialogs/DamageReportDialog.tsx` (unified upload + signed URL fix)
- `src/components/dialogs/CheckInOutDialog.tsx` (unified upload)
- `src/components/inspections/InspectionWidget.tsx` (unified upload)

## No Database Migration Needed
Existing columns `thumbnail_url`, `width`, `height`, `file_size_bytes` in `vehicle_photos` are now populated.

## What This Enables for Phase 2 (R2 Evaluation)
Session metrics provide real data on:
- Average compression ratio per context
- Monthly storage growth rate
- Auto-match success rate
- Upload latency distribution
