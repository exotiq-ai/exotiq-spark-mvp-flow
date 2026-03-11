

# Client-Side Photo Editor — Plan

## Approach

Add a `PhotoEditorDialog` component using `react-easy-crop` (lightweight, 15KB, MIT) for crop/rotate and Canvas API `ctx.filter` for brightness/contrast/saturation. Zero API calls, zero cloud costs — everything renders client-side via `OffscreenCanvas`, same pattern as existing `imageCompression.ts`.

## New Dependency

- `react-easy-crop` — provides the interactive crop area with pinch-zoom, drag, and aspect ratio presets

## New File: `src/components/photos/PhotoEditorDialog.tsx`

A dialog containing:

1. **Crop area** — `react-easy-crop` `<Cropper>` with the image URL, outputs `croppedAreaPixels`
2. **Aspect ratio presets** — Free, 16:9, 4:3, 1:1 (toggle buttons)
3. **Rotate** — 90° CW/CCW buttons
4. **Adjustments** — Three sliders (brightness 50-150, contrast 50-150, saturation 50-150), applied as CSS `filter` on the preview for instant feedback
5. **Apply button** — Uses `OffscreenCanvas` to: load image → apply rotation → crop to pixel region → apply `ctx.filter = 'brightness(...) contrast(...) saturate(...)'` → export as JPEG → upload replacement via existing `uploadToStorage` → update the `vehicle_photos` row's `url`/`storage_path` → delete old file
6. **Cancel** — Closes without changes

Props: `{ open, onOpenChange, photo: VehiclePhoto, onSaved: () => void }`

The Canvas rendering function will live in `src/lib/imageCompression.ts` as `applyEdits(imageUrl, { cropArea, rotation, brightness, contrast, saturation }) → File` to keep it colocated with existing image utilities.

## Integration Points (2 existing files)

### `src/components/photos/VehiclePhotoManager.tsx`
- **Hero photo dropdown** (line 297): Add "Edit / Crop" menu item → opens `PhotoEditorDialog` with `heroPhoto`
- **PhotoThumbnail dropdown** (line 566): Add "Edit / Crop" menu item → opens `PhotoEditorDialog` with that photo
- State: single `editingPhoto: VehiclePhoto | null`, dialog open when non-null

### `src/components/photos/usePhotoAnalysis.ts`
- Add `replacePhotoFile(photoId, newFile)` — uploads new file, updates the DB row's `url`/`storage_path`/`thumbnail_url`/`file_size_bytes`/`width`/`height`, deletes old storage path. Reuses existing `uploadToStorage` + `deletePhoto` internals.

## Files Summary

| Action | File |
|--------|------|
| New dep | `react-easy-crop` |
| New | `src/components/photos/PhotoEditorDialog.tsx` |
| Enhance | `src/lib/imageCompression.ts` — add `applyEdits()` |
| Enhance | `src/components/photos/VehiclePhotoManager.tsx` — add Edit menu items |
| Enhance | `src/components/photos/usePhotoAnalysis.ts` — add `replacePhotoFile()` |

**4 files touched, 1 new file, 1 new dependency, 0 API calls, 0 cloud costs.**

