

# Three Quick Fixes

## 1. Global Search Doesn't Find "GT3 RS"

**Root cause:** `EnhancedGlobalSearch.tsx` line 179-182 only searches `v.make` and `v.model` — it does NOT search `v.name`. Every other search in the codebase (FleetPage, PhotoReviewQueue, InspectionsTab, etc.) includes `v.name`. If the vehicle name is "Porsche GT3 RS" but model is stored as "911 GT3 RS", searching "GT3" alone may not match depending on how make/model were entered.

**Fix:** Add `v.name?.toLowerCase().includes(query)` to the vehicle filter in `EnhancedGlobalSearch.tsx`. Also update the vehicle click action from navigating to MotorIQ to opening the vehicle detail dialog on the Fleet page (consistent with other search locations).

**File:** `src/components/common/EnhancedGlobalSearch.tsx` — line 179

## 2. First Photo Should Auto-Set as Hero

**Root cause:** When uploading a photo via `uploadAndAnalyze` in `usePhotoAnalysis.ts`, the `photo_type` is always set based on the detected angle (exterior/interior/etc). There's no check for "is this the only photo for this vehicle?" — so the first upload always lands as a non-hero photo, requiring manual hero selection.

**Fix:** In `uploadAndAnalyze`, after determining `photo_type`, check if this vehicle already has any photos. If count is 0 (this is the first photo), set `photo_type` to `'hero'` regardless of detected angle.

**File:** `src/components/photos/usePhotoAnalysis.ts` — around line 179, before the insert

## 3. Hero Photo Has No Delete/Replace Action

**Root cause:** The hero photo section in `VehiclePhotoManager.tsx` (lines 251-302) only shows a "View" button on hover. There's no delete or replace action — those only exist in the `PhotoThumbnail` dropdown for non-hero photos. If the only photo is an AI-generated hero, the user has no way to remove it from this UI.

**Fix:** Add a dropdown menu (or additional hover buttons) to the hero photo section with "Delete" and "Replace" actions. Keep "View" as a button, add a small `MoreVertical` dropdown with delete (with confirmation) and replace options.

**File:** `src/components/photos/VehiclePhotoManager.tsx` — lines 279-291 (hero hover actions)

## Summary

| Fix | File | Effort |
|-----|------|--------|
| Search `v.name` in global search | `EnhancedGlobalSearch.tsx` | 1 line |
| Auto-hero on first photo | `usePhotoAnalysis.ts` | ~5 lines |
| Hero photo delete/replace actions | `VehiclePhotoManager.tsx` | ~20 lines |

3 files, all small changes.

