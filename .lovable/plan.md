

# Fix: Back Arrow Should Navigate to Skipped Photos

## Problem
When you skip a photo, `skipPhoto()` in `usePhotoReviewQueue` moves the photo to the **end** of the queue array. The `currentIndex` stays the same, so the next photo slides in. Pressing the back arrow goes to `currentIndex - 1` — which is the photo *before* the skip, not the skipped photo itself. The skipped photo is now buried at the end of the array.

## Fix
Change skip behavior: instead of reordering the array, simply advance `currentIndex` by one. The skipped photo stays in place in the queue, and the back arrow naturally returns to it.

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/usePhotoReviewQueue.ts` | Remove the array-reorder logic from `skipPhoto` — make it a no-op on the queue (photo stays in place) |
| 2 | `src/components/photos/PhotoReviewQueue.tsx` | After calling `skipPhoto`, call `goToNext()` to advance the index forward |

The skipped photo remains at its original position. Back arrow → previous index → skipped photo. Simple and intuitive.

