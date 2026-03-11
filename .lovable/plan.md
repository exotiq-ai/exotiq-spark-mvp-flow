

# Fixing Bulk Upload UX Issues

## Problems Identified

**1. "unknown" angle badge showing on every file**

In `BulkUploadModal.tsx` lines 410-414, when a file completes it renders `item.result.analysis.angle` as a badge. Since `skipAnalysis` defaults to `true`, the code in `usePhotoAnalysis.ts` (line 274) sets a fallback analysis with `angle: 'unknown'`. So every completed file shows an unhelpful "unknown" badge.

**Fix:** Only show the angle badge when AI analysis actually ran and returned a meaningful angle (not `'unknown'`).

**2. "Review Queue" button just closes the modal — no navigation to review**

In `BulkUploadModal.tsx` line 443, the "Review Queue" button calls `handleClose()` which resets state and closes the dialog. It does NOT trigger the Photo Hub's `setShowReviewQueue(true)`. The parent `PhotoHubTab` has review queue toggling, but the modal has no callback to activate it.

**Fix:** Add an `onReviewQueue` callback prop to `BulkUploadModal`. When "Review Queue" is clicked, call it before closing. In `PhotoHubTab`, pass a handler that sets `showReviewQueue = true`.

**3. Photo Hub stat numbers are confusing**

The screenshot shows "Total Photos: 24", "Vehicles with Photos: 2 (2 of 59)", "Hero Photos: 2 (57 missing)", "Pending Review: 0". The issues:
- "57 missing" hero photos is alarming when user just uploaded 5 photos — it counts ALL vehicles without heroes, not just ones the user is actively working with.
- "Pending Review: 0" is confusing when the upload just said there are photos to review — this is because the stat counter queries the DB which may not have refreshed yet, or the filename matcher routed everything to unmatched but the stat query hasn't caught up.
- The stats don't refresh automatically after the bulk upload modal closes.

**Fix:** Force a stats refetch when the upload modal closes. Reword "57 missing" to be less alarming — show as a subtle subtitle rather than a warning-styled count.

---

## Changes (3 files)

### `src/components/photos/BulkUploadModal.tsx`
- Hide the angle badge when `angle === 'unknown'` or when analysis wasn't actually run
- Add `onReviewQueue?: () => void` prop
- "Review Queue" button calls `onReviewQueue()` then `handleClose()` instead of just closing

### `src/components/photos/PhotoHubTab.tsx`
- Pass `onReviewQueue={() => setShowReviewQueue(true)}` to `BulkUploadModal`
- Force refetch stats/queue when upload modal closes (in the `onOpenChange` handler)
- Soften "X missing" hero subtitle — change to "X of Y set" framing instead of deficit-focused language

### `src/components/photos/usePhotoAnalysis.ts`
- No changes needed — the `angle: 'unknown'` default is fine for DB storage; the display filtering happens in the modal

