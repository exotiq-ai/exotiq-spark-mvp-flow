
# Photo Hub Review Queue Enhancement Plan

## Summary
The Review Queue's "Batch" mode is incomplete - it currently shows a photo grid but lacks selection functionality. We need to add:
1. Multi-select capability with checkboxes
2. "Select All" button for batch operations
3. Vehicle selector for batch matching
4. Improved stats display showing total vehicles

---

## What We're Building

### Current Batch Mode
- Shows photos in a grid
- Clicking a photo goes to single-view mode
- No way to select multiple photos

### Enhanced Batch Mode
- Checkboxes on each photo for selection
- "Select All" / "Deselect All" toggle
- Vehicle selector dropdown for batch assignment
- "Match All Selected" button
- Progress indicator during batch operation
- Selection counter showing "X of Y selected"

---

## Implementation Details

### 1. PhotoReviewQueue.tsx - Add Multi-Select Batch Mode

**New State Variables:**
```text
selectedPhotoIds: string[]     - Track selected photo IDs
batchVehicleId: string         - Vehicle to match batch to
isBatchProcessing: boolean     - Loading state for batch ops
```

**New UI Elements in Batch Mode:**
```text
┌────────────────────────────────────────────────────────┐
│  Review Queue                       [Single] [Batch]   │
├────────────────────────────────────────────────────────┤
│  ☑ Select All (12 selected of 24)                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ Vehicle: [ Select vehicle to match... ▼ ]      │    │
│  │ [ Match 12 Selected Photos ]                   │    │
│  └────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ ☑   │ │ ☑   │ │ ☐   │ │ ☑   │ │ ☐   │              │
│  │ img │ │ img │ │ img │ │ img │ │ img │              │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

**Batch Actions Bar:**
- Select All / Deselect All checkbox
- Selection counter ("12 of 24 selected")
- Vehicle dropdown selector
- "Match Selected" button (disabled until vehicle selected)
- "Reject Selected" button for non-vehicle photos

### 2. Enhanced Photo Cards in Batch Mode

Each photo in batch mode will have:
- Checkbox overlay in top-left corner
- Visual selected state (border highlight)
- Click toggles selection (not navigation)
- AI suggestion badge visible

### 3. Stats Improvements in PhotoHubTab

Update the stats display to be clearer:
- "Vehicles with Photos: 5 of 12" - explicit total
- Add tooltip explaining what stats mean
- Ensure stats refresh after batch operations

### 4. Hook Integration

The `batchMatchPhotos` function already exists in `usePhotoReviewQueue`:
```typescript
const batchMatchPhotos = useCallback(async (
  photoIds: string[],
  vehicleId: string
): Promise<void> => {
  for (const photoId of photoIds) {
    await matchPhoto(photoId, vehicleId);
  }
}, [matchPhoto]);
```

We'll add progress callback support for better UX.

---

## File Changes

| File | Changes |
|------|---------|
| `src/components/photos/PhotoReviewQueue.tsx` | Add selection state, batch action bar, checkbox overlays, batch processing UI |
| `src/hooks/usePhotoReviewQueue.ts` | Add batch reject, progress callback for batch operations |
| `src/components/photos/PhotoHubTab.tsx` | Improve stats display to show "X of Y vehicles" |

---

## User Flow After Changes

1. User uploads 50 photos → goes to Review Queue
2. Switches to "Batch" mode
3. Clicks "Select All" → all 50 photos selected
4. Chooses vehicle from dropdown (e.g., "2024 Lamborghini Huracan")
5. Clicks "Match 50 Selected Photos"
6. Progress bar shows matching in progress
7. Optionally, AI flags photos that don't match the selected vehicle's make/color
8. Matched photos removed from queue
9. User returns to Photo Hub → sees updated stats

---

## Technical Notes

### Selection Logic
- Track by photo ID in Set for O(1) lookups
- "Select All" adds all current queue IDs
- Individual toggle adds/removes from set
- Clear selection when switching to single mode

### Batch Processing
- Show progress: "Matching 5 of 50..."
- Handle partial failures gracefully
- Toast summary: "45 matched, 5 failed"
- Auto-refresh queue after completion

### Performance
- Batch operations process in parallel (up to 5 concurrent)
- Chunked processing for large batches
- Optimistic UI updates where possible
