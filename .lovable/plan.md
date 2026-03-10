

# Photo Hub v2 — Strengthened Plan (9/10)

## Addressing Your 4 Clarifications

### 1. CheckInOut/DamageReport in optimization scope

**Current state:**
- `InspectionPhotoUpload.tsx` uses `uploadVehiclePhoto()` from `photoUpload.ts` → stores in `vehicle-photos` bucket (private, signed URLs)
- `DamageReportDialog.tsx` uses its **own inline upload** directly to the `damage-photos` bucket (separate private bucket, uses `getPublicUrl` which will 403 on a private bucket — this is a latent bug)
- `CheckInOutDialog.tsx` uploads via its own `uploadPhoto()` method to `vehicle-photos` bucket
- `InspectionWidget.tsx` also has its own `uploadPhoto()` to `vehicle-photos`

**Decision:** Include all four surfaces in the optimization scope. The plan update:

| Surface | Current path | Updated path |
|---------|-------------|-------------|
| `InspectionPhotoUpload` | `photoUpload.ts` → `compressImage()` defaults | `photoUpload.ts` → `operational` preset |
| `DamageReportDialog` | Inline upload to `damage-photos`, no compression | Route through `photoUpload.ts` with `operational` preset, keep `damage-photos` bucket |
| `CheckInOutDialog` | Own `uploadPhoto()`, no compression | Route through `photoUpload.ts` with `operational` preset |
| `InspectionWidget` | Own `uploadPhoto()`, no compression | Route through `photoUpload.ts` with `operational` preset |

This means `photoUpload.ts` becomes the **single entry point** for all operational uploads. It gets a `bucket` parameter (default `'vehicle-photos'`) so DamageReport can target `damage-photos`.

**Additional fix:** DamageReportDialog currently calls `getPublicUrl` on a private bucket — switch to `createSignedUrl` to fix the latent 403 bug.

**Files added to scope:** `CheckInOutDialog.tsx`, `InspectionWidget.tsx`, `DamageReportDialog.tsx`

### 2. Thumbnail delete lifecycle

When a photo is deleted (via `deletePhoto()` in `usePhotoAnalysis.ts`), we currently delete `storage_path` from the bucket. The plan must also delete the corresponding `{storage_path}_thumb.jpg`.

**Rule:** Thumbnail lifecycle is always coupled to its parent. When the parent file is deleted, the thumbnail is deleted in the same `supabase.storage.remove()` call (pass both paths as an array). No independent thumbnail cleanup needed.

**Implementation:** In `deletePhoto()`, read `storage_path` from the row, compute thumb path as `storage_path.replace(/\.[^.]+$/, '_thumb.jpg')`, delete both in one call.

### 3. Private bucket signed URL strategy

**Current state is inconsistent:**
- `usePhotoAnalysis.ts` → 1-year signed URLs at upload time, stored in `url` column
- `photoUpload.ts` → 1-hour signed URLs at upload time, stored in `url` column
- `usePhotoReviewQueue.ts` → generates fresh 1-hour signed URLs at fetch time (correct for review queue)
- `DamageReportDialog.tsx` → uses `getPublicUrl` on private bucket (broken)

**Aligned strategy for the plan:**

| Context | URL stored in DB | URL served to UI |
|---------|-----------------|-----------------|
| Photo Hub (vehicle_photos.url) | 1-year signed URL at upload | Use stored URL; refresh if expired |
| Photo Hub (thumbnail_url) | 1-year signed URL at upload | Use stored URL; same lifecycle as parent |
| Review Queue | No change to stored URL | Fresh 1-hour signed URL at fetch (already correct) |
| Operational (inspections, damage) | 1-year signed URL at upload | Use stored URL |

**Implementation:** Standardize `photoUpload.ts` to also generate 1-year signed URLs (matching `usePhotoAnalysis.ts`). Both `url` and `thumbnail_url` get 1-year signed URLs at upload time.

### 4. Original vs compressed bytes metric semantics

**Definition:**
- `originalBytes`: `file.size` of the raw `File` object before any processing (what the user's device captured)
- `compressedBytes`: `compressedFile.size` after `compressImage()` runs (what actually gets uploaded to storage)
- `compressionRatio`: `1 - (compressedBytes / originalBytes)` — displayed as percentage saved (e.g., "62% smaller")
- If compression is skipped (file under threshold or non-image): `compressedBytes === originalBytes`, ratio = 0

**Where tracked:**
- `file_size_bytes` column in `vehicle_photos` → stores `compressedBytes` (what's in storage — this is the cost-relevant number)
- Session metrics in `uploadMetrics.ts` → tracks both original and compressed for savings calculation
- Not persisted to DB — session-only for now

---

## Updated File Scope (12 files)

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/imageCompression.ts` | Add presets, `generateThumbnail()` |
| Modify | `src/lib/photoUpload.ts` | Preset param, bucket param, thumbnail gen, 1-year signed URLs, 10MB limit |
| Modify | `src/components/photos/usePhotoAnalysis.ts` | Concurrency pool, thumbnail upload, filename matcher integration, thumbnail delete, metrics |
| Modify | `src/components/photos/types.ts` | New progress states, `matchResult`, `compressionStats` |
| Modify | `src/components/photos/BulkUploadModal.tsx` | Match badges, session summary |
| Modify | `src/components/photos/PhotoHubTab.tsx` | Session metrics display |
| Modify | `src/components/dialogs/DamageReportDialog.tsx` | Route through `photoUpload.ts`, fix signed URL bug |
| Modify | `src/components/dialogs/CheckInOutDialog.tsx` | Route through `photoUpload.ts` with `operational` preset |
| Modify | `src/components/inspections/InspectionWidget.tsx` | Route through `photoUpload.ts` with `operational` preset |
| Modify | `src/lib/featureFlags.ts` | 4 new flags |
| Create | `src/lib/filenameVehicleMatcher.ts` | Deterministic filename-to-vehicle scorer |
| Create | `src/lib/uploadMetrics.ts` | Session-level metrics tracker |

No database migration needed.

## Build Order

1. `imageCompression.ts` — presets + thumbnail generator (foundation)
2. `photoUpload.ts` — unified operational entry point with preset/bucket/thumbnail/signed-URL alignment
3. `filenameVehicleMatcher.ts` — standalone module
4. `featureFlags.ts` — gate new behaviors
5. `uploadMetrics.ts` — session tracker
6. `types.ts` — new progress states
7. `usePhotoAnalysis.ts` — concurrency, thumbnails, matcher, metrics, delete lifecycle
8. `DamageReportDialog.tsx` + `CheckInOutDialog.tsx` + `InspectionWidget.tsx` — route through `photoUpload.ts`
9. `BulkUploadModal.tsx` — match badges, summary
10. `PhotoHubTab.tsx` — session metrics

