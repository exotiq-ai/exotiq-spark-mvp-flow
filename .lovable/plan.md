

# Fix: Auto-Set Hero Photo on All Match Paths

## Problem

During batch upload, only 27 of ~80 vehicles got hero photos. The ones that did were matched via the **review queue** (`usePhotoReviewQueue.ts`), which correctly checks "does this vehicle have a hero?" before inserting. The other two code paths skip this check:

1. **Batch auto-match** (`usePhotoAnalysis.ts` line 357-389) — inserts with `getPhotoType(analysis.angle)` (usually `exterior`), never checks if the vehicle needs a hero.
2. **`matchPhotoToVehicle`** (`usePhotoAnalysis.ts` line 501-519) — hardcodes `photo_type: 'exterior'`, never checks for existing hero.

## Changes

| # | File | Lines | Change |
|---|------|-------|--------|
| 1 | `src/components/photos/usePhotoAnalysis.ts` | 357-389 | Before inserting auto-matched photo, query `vehicle_photos` for an existing hero. If none exists, set `photo_type: 'hero'` instead of angle-based type. |
| 2 | `src/components/photos/usePhotoAnalysis.ts` | 501-519 | Same fix for `matchPhotoToVehicle`: check for existing hero before inserting. If no hero exists, set as hero. |

## Detail

Both paths get the same pattern already used in `uploadAndAnalyze` (line 180-185):

```typescript
const { count: existingCount } = await supabase
  .from('vehicle_photos')
  .select('id', { count: 'exact', head: true })
  .eq('vehicle_id', vehicleId)
  .eq('photo_type', 'hero');

const photoType = (existingCount === 0 || existingCount === null) 
  ? 'hero' 
  : getPhotoType(analysis.angle);
```

For the batch path, since multiple photos for the same vehicle may process concurrently, we also need a local `Set` tracking which vehicles already had a hero assigned in the current batch to avoid race conditions producing duplicate heroes.

