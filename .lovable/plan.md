
# Photo Hub Implementation Plan

## Overview

Build a Photo Hub as a **new tab within the Fleet module** (following the pattern used in Book with Inspections). This will provide centralized photo management with AI-powered analysis, bulk upload with drag-and-drop, and a review queue for matching photos to vehicles.

---

## Architecture Summary

```text
FleetPageEnhanced.tsx (existing)
├── Tab: "Fleet" (default - existing vehicle grid)
└── Tab: "Photos" (new - Photo Hub)
         ├── PhotoStats - Dashboard cards with photo coverage metrics
         ├── BulkUploadModal - Drag-and-drop + AI analysis
         ├── PhotoReviewQueue - Match unmatched photos to vehicles
         └── VehiclePhotoGrid - Browse photos by vehicle
```

---

## Step 1: Refactor FleetPageEnhanced to Use ModuleTabs

**File:** `src/components/fleet/FleetPageEnhanced.tsx`

Add tabs pattern like BookEnhanced.tsx:

```tsx
<ModuleTabs
  tabs={[
    { id: "fleet", label: "Fleet", shortLabel: "Fleet", icon: Car },
    { id: "photos", label: "Photos", shortLabel: "Photos", icon: Camera },
  ]}
  defaultValue="fleet"
>
  <TabsContent value="fleet">
    {/* Move existing FleetPageEnhanced content here */}
  </TabsContent>
  <TabsContent value="photos">
    <PhotoHubTab vehicles={vehicles} loading={loading} />
  </TabsContent>
</ModuleTabs>
```

---

## Step 2: Create Photo Hub Tab Component

**New File:** `src/components/photos/PhotoHubTab.tsx`

Main container with:
- Stats cards (total photos, vehicles with/without photos, unmatched queue count)
- "Bulk Upload" button (opens modal)
- Review Queue section (pending photos needing vehicle assignment)
- Vehicle Photo Grid (browse all vehicles and their photos)

**Key features:**
- Real-time stats from `vehicle_photos` and `unmatched_photos` tables
- Quick access to upload and review workflows
- Search/filter vehicles by photo coverage

---

## Step 3: Create Bulk Upload Modal

**New File:** `src/components/photos/BulkUploadModal.tsx`

Leveraging the existing `FileUploadZone` and `InspectionPhotoUpload` patterns:

**Features:**
- Drag-and-drop zone accepting multiple images
- Optional vehicle pre-selection (if user knows which vehicle photos belong to)
- Progress tracking for each file (using existing `PhotoUploadProgress` type)
- Real-time AI analysis results displayed per photo
- Batch processing using existing `usePhotoAnalysis.processBatch()`
- Summary view showing matched/unmatched results

**UI Flow:**
1. User drags/drops 10 photos
2. Each photo shows: uploading → analyzing → complete (with AI result)
3. Photos go to either `vehicle_photos` (if matched) or `unmatched_photos` (for review)
4. Modal shows final summary with counts

---

## Step 4: Create Photo Review Queue

**New File:** `src/components/photos/PhotoReviewQueue.tsx`

**Two modes:**
1. **Single-photo mode:** Review one photo at a time with vehicle suggestions
2. **Batch mode:** Grid view to quickly assign multiple photos

**Features:**
- Show AI-suggested vehicle (with confidence score)
- Vehicle selector dropdown with search
- Quick actions: Match, Skip, Reject
- Visual vehicle thumbnails for easy identification
- Keyboard shortcuts for power users (Arrow keys + Enter)

**Data source:** `unmatched_photos` table with status='pending'

---

## Step 5: Create Vehicle Photo Manager

**New File:** `src/components/photos/VehiclePhotoManager.tsx`

Per-vehicle photo grid showing:
- Hero photo (highlighted with star badge)
- All other photos by type (exterior, interior, detail)
- Photo coverage indicator (e.g., "8/11 recommended shots")
- Drag-to-reorder functionality
- "Set as Hero" action on any photo
- Delete photo action
- Upload more photos button

**Used in:**
- PhotoHubTab (inline expanded view)
- Vehicle detail dialog (future integration)

---

## Step 6: Create Reusable PhotoCard Component

**New File:** `src/components/photos/PhotoCard.tsx`

Displays a single photo with:
- Thumbnail image with lazy loading
- Type badge (Hero, Exterior, Interior, etc.)
- Quality score indicator (if below threshold, show warning)
- Detected angle label
- Action buttons (Set Hero, Delete, View Full)
- Loading/error states

---

## Step 7: Add Photo Count to FleetVehicleCard

**File:** `src/components/fleet/FleetVehicleCard.tsx`

Add photo coverage indicator:

```tsx
// Near license plate or ops status
{photoCount !== undefined && (
  <Badge variant="outline" className="text-xs gap-1">
    <Camera className="h-3 w-3" />
    {photoCount}/11
  </Badge>
)}
```

**Data fetching:**
- Add a new hook `useVehiclePhotoStats()` that fetches photo counts per vehicle
- Or extend `useLocationFilteredFleet()` to include photo counts via a view

---

## Step 8: Create useVehiclePhotos Hook

**New File:** `src/hooks/useVehiclePhotos.ts`

Fetches and manages vehicle photos:

```tsx
export function useVehiclePhotos(vehicleId?: string) {
  // Fetch photos for a specific vehicle or all team photos
  // Subscribe to realtime updates
  // Return: photos, stats, loading, refetch
}
```

---

## Step 9: Create usePhotoReviewQueue Hook

**New File:** `src/hooks/usePhotoReviewQueue.ts`

Manages the unmatched photo queue:

```tsx
export function usePhotoReviewQueue() {
  // Fetch unmatched photos with status='pending'
  // Return: queue, matchPhoto, skipPhoto, rejectPhoto, loading
}
```

---

## Step 10: Update Types and Exports

**File:** `src/components/photos/index.ts`

Export all new components:

```tsx
export { PhotoHubTab } from './PhotoHubTab';
export { BulkUploadModal } from './BulkUploadModal';
export { PhotoReviewQueue } from './PhotoReviewQueue';
export { VehiclePhotoManager } from './VehiclePhotoManager';
export { PhotoCard } from './PhotoCard';
```

---

## Step 11: Cleanup usePhotoAnalysis.ts

**File:** `src/components/photos/usePhotoAnalysis.ts`

Remove `as any` type assertions now that database types are generated.

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/fleet/FleetPageEnhanced.tsx` | Modify | Add ModuleTabs with Fleet/Photos tabs |
| `src/components/photos/PhotoHubTab.tsx` | Create | Main Photo Hub container |
| `src/components/photos/BulkUploadModal.tsx` | Create | Drag-and-drop batch upload |
| `src/components/photos/PhotoReviewQueue.tsx` | Create | Match unmatched photos |
| `src/components/photos/VehiclePhotoManager.tsx` | Create | Per-vehicle photo grid |
| `src/components/photos/PhotoCard.tsx` | Create | Reusable photo display |
| `src/components/fleet/FleetVehicleCard.tsx` | Modify | Add photo count badge |
| `src/hooks/useVehiclePhotos.ts` | Create | Photo data fetching |
| `src/hooks/usePhotoReviewQueue.ts` | Create | Review queue management |
| `src/components/photos/index.ts` | Modify | Export new components |
| `src/components/photos/usePhotoAnalysis.ts` | Modify | Remove type assertions |

---

## UI/UX Design Decisions

### Photo Hub Stats Section
- Card grid showing: Total Photos, Vehicles with Photos, Missing Hero Photos, Pending Review
- Action buttons: "Bulk Upload" and "Review Queue" (with badge count)

### Bulk Upload Modal
- Full-screen on mobile, large modal on desktop (like InspectionWidget)
- Shows real-time upload progress with AI analysis results
- Final summary with "Go to Review Queue" CTA for unmatched photos

### Review Queue
- Toggle between "Single" and "Batch" modes
- Single mode: Large photo preview with vehicle suggestions
- Batch mode: Grid with quick-select checkboxes and bulk assign

### Photo Coverage Indicator
- Format: `8/11` with tooltip showing which shots are missing
- Color coding: Green (8+), Yellow (5-7), Red (0-4)
- Uses `RECOMMENDED_ANGLES` from types.ts as reference

---

## Technical Considerations

1. **Performance:** Lazy load images in grid views, use intersection observer
2. **Realtime:** Consider enabling realtime on `unmatched_photos` for multi-user teams
3. **Mobile:** Touch-friendly review queue, swipe gestures for single-photo mode
4. **Accessibility:** Keyboard navigation in review queue, proper ARIA labels
5. **Error Handling:** Graceful degradation if AI analysis fails

---

## Implementation Order

1. **Phase 1 (Core):**
   - FleetPageEnhanced tabs refactor
   - PhotoHubTab with basic stats
   - BulkUploadModal (using existing usePhotoAnalysis)

2. **Phase 2 (Review):**
   - PhotoReviewQueue (single mode first)
   - usePhotoReviewQueue hook
   - PhotoCard component

3. **Phase 3 (Polish):**
   - VehiclePhotoManager
   - Photo count on FleetVehicleCard
   - Batch review mode
   - Type cleanup
