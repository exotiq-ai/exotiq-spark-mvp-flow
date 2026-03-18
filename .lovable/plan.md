

# Fix: Post-Tour Modal Not Dismissible (Click + Esc)

## Analysis

The previous fix added `onClick={onExplore}` to the backdrop — **that part is correct and should work for click dismissal**. However, the user reports neither click NOR Esc works.

Two issues found:

### 1. No Esc key handler on PostTourChoiceModal
The modal has **zero keyboard handling**. The Esc key previously "worked" only because the AutomatedDemoTour's keyboard listener was still active during a brief overlap. Once the tour fully unmounts, Esc does nothing.

### 2. Potential click interception
The `InteractiveModuleTour` and `TourSpotlight` components render at `z-[100]` and `z-[90]` with `pointer-events-auto` on their SVG overlay. If either component doesn't fully unmount (e.g., stale state), it could sit invisibly on top of the PostTourChoiceModal (also `z-[100]`) and swallow clicks.

## Fix

### `src/components/onboarding/PostTourChoiceModal.tsx`
- Add a `useEffect` that listens for `Escape` key and calls `onExplore` when the modal is open
- This gives consistent dismissal via keyboard

### Verify click works
The backdrop `onClick={onExplore}` is already in place. If click is still blocked, the z-index overlap with other tour components would be the cause — bump the modal's z-index from `z-[100]` to `z-[110]` to ensure it sits above any residual tour overlays.

| File | Change |
|------|--------|
| `src/components/onboarding/PostTourChoiceModal.tsx` | Add Esc key listener via `useEffect`; bump z-index to `z-[110]` to prevent click interception from stale tour overlays |

Single file, small change.

