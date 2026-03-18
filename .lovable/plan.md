

# Photo Matching Improvements: Color Display, Already-Matched Filtering, Auto-Hero

## Three Changes

### 1. Include vehicle color in the matching UI and matching logic

**Problem**: The Vehicle interface passed to PhotoReviewQueue doesn't include `color`. So when two identical make/model vehicles differ only by color, the user can't tell them apart, and the filename matcher can't use color either.

**Changes**:
- **`FleetPageEnhanced.tsx`** (line ~310): Add `color: v.color` to the `vehiclesForPhotos` mapping.
- **`PhotoHubTab.tsx`** (line ~38): Add `color?: string` to the `Vehicle` interface.
- **`PhotoReviewQueue.tsx`** (line ~39): Add `color?: string` to the `Vehicle` interface. Update the vehicle list display (line ~468-471) to show color: e.g. `"2024 BMW M4 · White"`. Update the batch Select (line ~575) similarly.
- **`BulkUploadModal.tsx`**: Already has `color` in its Vehicle interface — no change needed there.

This also improves the **filename auto-matcher** (`filenameVehicleMatcher.ts`) since it already scores on color — it just needs the color data passed through, which `BulkUploadModal` already does.

### 2. Hide already-matched vehicles from the selection list

**Problem**: After matching a photo to a vehicle, that vehicle still appears in the list. For single-photo-per-vehicle fleets, this creates confusion.

**Approach**: Track which vehicle IDs have been matched during the current review session. Filter those out of the vehicle list. Add a small "X matched" counter and a toggle to show all vehicles if needed (safety valve for multi-photo scenarios).

**Changes in `PhotoReviewQueue.tsx`**:
- Add `matchedVehicleIds` state (`Set<string>`) — populated when `matchPhoto` or `batchMatchPhotos` succeeds.
- Filter `filteredVehicles` to exclude matched IDs by default.
- Add a small toggle: "Show all vehicles" / "Hide matched (N)" so users can override if they need to assign multiple photos to one vehicle.

### 3. Auto-set matched photos as hero when the vehicle has no existing hero

**Problem**: After matching, every photo is inserted as `exterior` type. Users must manually go into each vehicle and set the hero photo.

**Approach**: Before inserting the `vehicle_photo` record in `matchPhoto()`, check if the vehicle already has a hero photo. If not, set `photo_type: 'hero'` instead of the angle-based type.

**Changes in `usePhotoReviewQueue.ts`** (`matchPhoto` function, around line 154):
- Before insert, query `vehicle_photos` for an existing hero: `SELECT id FROM vehicle_photos WHERE vehicle_id = ? AND photo_type = 'hero' LIMIT 1`
- If none exists, set `photo_type: 'hero'` regardless of detected angle.
- This means the first photo matched to any vehicle automatically becomes its hero — no manual step needed.

## Files Changed

| File | Change |
|------|--------|
| `src/components/fleet/FleetPageEnhanced.tsx` | Pass `color` in vehiclesForPhotos |
| `src/components/photos/PhotoHubTab.tsx` | Add `color` to Vehicle interface |
| `src/components/photos/PhotoReviewQueue.tsx` | Add `color` to Vehicle interface, display color in list, track matched vehicles, add show/hide toggle |
| `src/hooks/usePhotoReviewQueue.ts` | Auto-set hero on first match per vehicle |

## Discussion Points

**Hiding matched vehicles**: The toggle ensures this works for both single-photo and multi-photo workflows. Defaulting to hidden makes the single-photo flow fast; the toggle is there as a safety net.

**Auto-hero**: This is safe because the DB already has a trigger that enforces only one hero per vehicle. If a vehicle somehow already has a hero, the photo just gets its normal angle-based type.

