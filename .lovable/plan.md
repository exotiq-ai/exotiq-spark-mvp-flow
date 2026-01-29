

# Photo Hub UI Completion Plan

## Current Status

The Photo Hub Phase 1 is already implemented with core components working. The Fleet page has a "Photos" tab that shows the PhotoHubTab with stats, bulk upload, and review queue functionality.

---

## Remaining Work

### 1. Create VehiclePhotoManager Component

**New File:** `src/components/photos/VehiclePhotoManager.tsx`

A per-vehicle photo grid that displays:
- Hero photo prominently at the top with a star badge
- Grid of other photos organized by type (exterior, interior, detail)
- Photo coverage indicator (e.g., "7/11 recommended shots")
- Drag-to-reorder functionality using existing patterns
- Actions per photo: "Set as Hero", "Delete", "View Full Size"
- "Upload More" button that opens BulkUploadModal with vehicle pre-selected

**Props:**
```tsx
interface VehiclePhotoManagerProps {
  vehicleId: string;
  vehicleName: string;
  onPhotoClick?: (photo: VehiclePhoto) => void;
  compact?: boolean; // For inline expansion in grids
}
```

**Features:**
- Uses `useVehiclePhotos({ vehicleId })` for data
- Uses `usePhotoAnalysis` for setAsHero, deletePhoto, reorderPhotos
- Shows recommended angles checklist from `RECOMMENDED_ANGLES` constant
- Responsive grid: 2 cols mobile, 3-4 cols desktop

---

### 2. Add Photo Count Badge to FleetVehicleCard

**File:** `src/components/fleet/FleetVehicleCard.tsx`

Add a photo coverage indicator showing count against recommended total:

```tsx
// New prop
photoCount?: number;

// In the Status Row section (after Ops Status badge)
{photoCount !== undefined && (
  <Badge 
    variant="outline" 
    className={cn(
      'text-xs gap-1',
      photoCount >= 8 && 'border-success/50 text-success',
      photoCount >= 4 && photoCount < 8 && 'border-amber-500/50 text-amber-600',
      photoCount < 4 && 'border-muted-foreground/30 text-muted-foreground'
    )}
  >
    <Camera className="h-3 w-3" />
    {photoCount}/11
  </Badge>
)}
```

---

### 3. Wire Photo Counts into FleetPageEnhanced

**File:** `src/components/fleet/FleetPageEnhanced.tsx`

- Import `useVehiclePhotos` hook
- Fetch `photoCountByVehicle` map
- Pass counts to each `FleetVehicleCard`

```tsx
const { photoCountByVehicle } = useVehiclePhotos({ realtime: false });

// In FleetVehicleCard rendering:
<FleetVehicleCard
  vehicle={vehicle}
  photoCount={photoCountByVehicle[vehicle.id] || 0}
  // ... other props
/>
```

---

### 4. Add VehiclePhotoManager to PhotoHubTab

**File:** `src/components/photos/PhotoHubTab.tsx`

Add an expandable section to browse photos by vehicle:
- List of vehicles with photo counts
- Click to expand and show VehiclePhotoManager inline
- Quick access to upload more photos per vehicle

---

### 5. Integrate with Vehicle Details Dialog

**File:** `src/components/dialogs/VehicleImageDialog.tsx`

Replace static image preview with VehiclePhotoManager:
- Show full photo gallery for the vehicle
- Allow setting hero photo
- Enable photo management directly from vehicle details

---

### 6. Cleanup Type Assertions

**File:** `src/components/photos/usePhotoAnalysis.ts`

Remove all `as any` type assertions now that database types are generated. The types file should now include `vehicle_photos` and `unmatched_photos` table definitions.

**Lines to update:**
- Line 98, 106: Remove `as any` from insert objects
- Line 127: Remove `as any` from insert objects  
- Line 202, 220: Remove `as any` from insert objects
- Line 292, 306, 319, 360: Remove `as any` from update operations

---

### 7. Export VehiclePhotoManager

**File:** `src/components/photos/index.ts`

Add export for the new component:

```tsx
export { VehiclePhotoManager } from './VehiclePhotoManager';
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/photos/VehiclePhotoManager.tsx` | Create | Per-vehicle photo grid with management |
| `src/components/fleet/FleetVehicleCard.tsx` | Modify | Add photo count badge |
| `src/components/fleet/FleetPageEnhanced.tsx` | Modify | Wire photo counts to cards |
| `src/components/photos/PhotoHubTab.tsx` | Modify | Add vehicle browser section |
| `src/components/dialogs/VehicleImageDialog.tsx` | Modify | Integrate photo manager |
| `src/components/photos/usePhotoAnalysis.ts` | Modify | Remove type assertions |
| `src/components/photos/index.ts` | Modify | Export new component |

---

## UI/UX Details

### VehiclePhotoManager Layout

```text
┌─────────────────────────────────────────────────┐
│ ★ Hero Photo (large, full width)                │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │              [Hero Image]                   │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Coverage: 7/11 shots ████████░░░                │
│                                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│ │ Ext  │ │ Ext  │ │ Int  │ │ Dtl  │ [+ Add]   │
│ └──────┘ └──────┘ └──────┘ └──────┘            │
│                                                 │
│ Missing: Engine Bay, Right Side                 │
└─────────────────────────────────────────────────┘
```

### Photo Coverage Badge Colors
- Green (8+): Excellent coverage
- Amber (4-7): Good, some missing
- Gray (0-3): Needs attention

---

## Implementation Order

1. Create `VehiclePhotoManager.tsx` component
2. Add photo count badge to `FleetVehicleCard.tsx`
3. Wire counts in `FleetPageEnhanced.tsx`
4. Add vehicle browser to `PhotoHubTab.tsx`
5. Update `VehicleImageDialog.tsx` integration
6. Clean up type assertions in `usePhotoAnalysis.ts`
7. Update exports in `index.ts`

