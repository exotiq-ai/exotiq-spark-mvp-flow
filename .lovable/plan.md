
# Add Photo Upload Button to Vehicle Details and Post-Add Vehicle Flow

## Problem Summary

When viewing a vehicle's details in the Fleet page (clicking on a vehicle card → Photos tab), users see "No photos for this vehicle" with **no way to upload photos directly**. The screenshot shows this empty state without an action button.

Additionally, after adding a new vehicle, there's no prompt to add photos for that vehicle.

---

## Solution Overview

### Part 1: Enable Photo Upload in Vehicle Details Modal

The `VehiclePhotoManager` component already supports an `onUploadClick` callback that shows an "Upload Photos" button - but this callback is not currently passed from `VehicleImageDialog`.

**Files to modify:**
- `src/components/dialogs/VehicleImageDialog.tsx`

**Changes:**
1. Import `BulkUploadModal` 
2. Add state for showing the upload modal
3. Pass `onUploadClick` callback to `VehiclePhotoManager`
4. Render `BulkUploadModal` with the current vehicle pre-selected

```tsx
// Add state
const [showUploadModal, setShowUploadModal] = useState(false);

// Pass callback to VehiclePhotoManager
<VehiclePhotoManager
  vehicleId={vehicleId}
  vehicleName={vehicleName}
  onUploadClick={() => setShowUploadModal(true)} // ← This enables the upload button
/>

// Render the upload modal
<BulkUploadModal
  open={showUploadModal}
  onOpenChange={setShowUploadModal}
  vehicles={[{ id: vehicleId, name: vehicleName }]}
  preSelectedVehicleId={vehicleId}
/>
```

### Part 2: Post-Add Vehicle Photo Prompt

After successfully adding a vehicle via `AddVehicleDialog`, show a success dialog that offers to:
1. Add photos now
2. Skip for later

**Files to modify:**
- `src/components/dialogs/AddVehicleDialog.tsx`
- `src/components/fleet/FleetPageEnhanced.tsx`

**Changes to AddVehicleDialog:**
1. Return the created vehicle ID from `onSubmit`
2. Add new optional prop `onAddPhotos?: (vehicleId: string, vehicleName: string) => void`
3. After successful creation, show a success step with "Add Photos" button

**Changes to FleetPageEnhanced:**
1. Track newly created vehicle
2. When `AddVehicleDialog` completes with photo intent, open `BulkUploadModal` with the new vehicle

---

## Implementation Details

### VehicleImageDialog Enhancement

```tsx
// src/components/dialogs/VehicleImageDialog.tsx

import { useState } from "react";
import { BulkUploadModal } from "@/components/photos/BulkUploadModal";

// Inside the component:
const [showUploadModal, setShowUploadModal] = useState(false);

// In Photos tab content:
<VehiclePhotoManager
  vehicleId={vehicleId}
  vehicleName={vehicleName}
  onUploadClick={() => setShowUploadModal(true)}
/>

// After the tabs, add the modal:
{vehicleId && (
  <BulkUploadModal
    open={showUploadModal}
    onOpenChange={setShowUploadModal}
    vehicles={[{ id: vehicleId, name: vehicleName }]}
    preSelectedVehicleId={vehicleId}
  />
)}
```

### AddVehicleDialog Enhancement

Add a "success" state that shows after vehicle creation:

```tsx
const [createdVehicle, setCreatedVehicle] = useState<{id: string, name: string} | null>(null);

// After successful submit, instead of immediately closing:
const result = await onSubmit({ ...vehicleData });
setCreatedVehicle({ id: result.id, name: name });

// Render success state:
{createdVehicle ? (
  <div className="text-center space-y-4 py-6">
    <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
    <h3>Vehicle Added Successfully!</h3>
    <p className="text-muted-foreground">
      Would you like to add photos for {createdVehicle.name}?
    </p>
    <div className="flex gap-3 justify-center">
      <Button variant="outline" onClick={handleClose}>
        Skip for Now
      </Button>
      <Button onClick={() => onAddPhotos?.(createdVehicle.id, createdVehicle.name)}>
        <Camera className="h-4 w-4 mr-2" />
        Add Photos
      </Button>
    </div>
  </div>
) : (
  // ... existing form
)}
```

### FleetPageEnhanced Integration

```tsx
// Add state
const [photoUploadVehicle, setPhotoUploadVehicle] = useState<{id: string, name: string} | null>(null);

// Update AddVehicleDialog to handle photo intent:
<AddVehicleDialog
  open={showAddVehicle}
  onOpenChange={setShowAddVehicle}
  onSubmit={createVehicle}
  onAddPhotos={(vehicleId, vehicleName) => {
    setShowAddVehicle(false);
    setPhotoUploadVehicle({ id: vehicleId, name: vehicleName });
  }}
/>

// Add BulkUploadModal for new vehicle photos:
<BulkUploadModal
  open={!!photoUploadVehicle}
  onOpenChange={(open) => !open && setPhotoUploadVehicle(null)}
  vehicles={photoUploadVehicle ? [{ id: photoUploadVehicle.id, name: photoUploadVehicle.name }] : []}
  preSelectedVehicleId={photoUploadVehicle?.id}
/>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dialogs/VehicleImageDialog.tsx` | Add upload modal state, pass `onUploadClick` to `VehiclePhotoManager`, render `BulkUploadModal` |
| `src/components/dialogs/AddVehicleDialog.tsx` | Add success state with "Add Photos" option, new `onAddPhotos` callback prop |
| `src/components/fleet/FleetPageEnhanced.tsx` | Handle new vehicle photo flow, track `photoUploadVehicle` state |
| `src/hooks/useLocationFilteredFleet.ts` | Modify `createVehicle` to return the created vehicle with its ID |

---

## Expected Outcome

### After Implementation:

1. **Vehicle Details Modal (Photos Tab)**
   - Shows "Upload Photos" button in empty state
   - Shows "Add More" button in photo grid when photos exist
   - Opens `BulkUploadModal` with vehicle pre-selected

2. **After Adding Vehicle**
   - Success screen with vehicle name confirmation
   - "Add Photos" button opens upload modal for that vehicle
   - "Skip for Now" closes dialog without uploading

### User Flow:
```text
Fleet Page → Click Vehicle Card → Photos Tab
        ↓
"No photos for this vehicle" + [Upload Photos] button
        ↓
Click → BulkUploadModal opens with vehicle pre-selected
        ↓
Upload photos → Photos appear in grid
```

```text
Fleet Page → [Add Vehicle] button
        ↓
Fill form → Submit
        ↓
Success: "Vehicle Added! Add photos?"
        ↓
[Add Photos] → Opens BulkUploadModal
        ↓
Upload photos → Done
```
