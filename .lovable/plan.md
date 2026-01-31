
# Vehicle Delete Functionality - Implementation Plan

## Current Situation

You've discovered that:
1. **Duplicate vehicles exist** - Many vehicles appear 2-3 times in the database (created during testing imports)
2. **No delete UI exists** - There's no way to delete vehicles from the Fleet Management interface
3. **Backend supports delete** - RLS policies already allow users to delete their own vehicles

### Duplicate Vehicles Found (sample)
| Vehicle | Count |
|---------|-------|
| Ferrari Roma 2024 | 3 |
| Lamborghini Huracán EVO 2024 | 3 |
| Audi S8 Plus 2017 | 3 |
| McLaren 720S 2020 | 2 |
| Porsche 911 Turbo S | 2 |
| ...and many more | |

---

## Immediate Workaround: Delete Vehicles Manually

Until the UI is built, you can delete duplicate vehicles directly from the database. I can help you run a cleanup query.

**Option A: Delete specific duplicates (keeps the oldest entry of each vehicle)**
```sql
-- This keeps ONE copy of each vehicle (the first one created) and deletes the rest
DELETE FROM vehicles 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM vehicles 
  GROUP BY team_id, name, make, model, year
);
```

**Option B: Delete by specific IDs (if you know which to remove)**
I can provide specific IDs for duplicates you want to delete.

---

## Implementation Plan: Add Delete Functionality to UI

### Part 1: Add Delete Method to FleetContext
**File:** `src/contexts/FleetContext.tsx`

Add a `deleteVehicle` function that:
- Calls `supabase.from('vehicles').delete().eq('id', vehicleId)`
- Shows confirmation toast on success
- Triggers `refreshData()` to update the UI
- Handles errors gracefully

### Part 2: Single Vehicle Delete
**File:** `src/components/fleet/FleetVehicleCard.tsx`

Add a "Delete Vehicle" option to the existing dropdown menu (the "..." menu):
- Positioned at the bottom of the menu with a separator
- Uses destructive red styling
- Opens confirmation dialog before deleting

### Part 3: Confirmation Dialog Integration  
**Existing component:** `src/components/ui/confirmation-dialog.tsx`

Use the existing `ConfirmationDialog` with:
- `variant="destructive"` 
- Clear warning message: "This will permanently delete {vehicle name}. This action cannot be undone."
- Confirmation text: "Delete Vehicle"

### Part 4: Batch Delete (Optional Enhancement)
**File:** `src/components/fleet/FleetPageEnhanced.tsx`

Add batch selection and delete capability:
- Checkbox on each vehicle card for multi-select
- "Delete Selected" button appears when items are selected
- Bulk confirmation before delete

### Part 5: Duplicate Prevention
**File:** `src/components/dialogs/AddVehicleDialog.tsx`

Add optional duplicate detection:
- Before inserting, check if vehicle with same name/make/model/year exists
- Show warning: "A similar vehicle already exists. Add anyway?"
- This prevents future duplicates

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/FleetContext.tsx` | Add `deleteVehicle` and `deleteVehicles` (batch) methods |
| `src/components/fleet/FleetVehicleCard.tsx` | Add delete option to dropdown menu |
| `src/components/fleet/FleetPageEnhanced.tsx` | Add selection state and batch delete UI |
| `src/hooks/useLocationFilteredFleet.ts` | Expose delete methods from FleetContext |
| `src/components/dialogs/AddVehicleDialog.tsx` | Optional: Add duplicate warning |

---

## Technical Details

### Delete Vehicle Flow
```text
User clicks "Delete" in dropdown
        ↓
Confirmation dialog opens (destructive variant)
        ↓
User confirms → deleteVehicle(vehicleId) called
        ↓
Supabase DELETE query with RLS check (user owns vehicle)
        ↓
Success toast + refreshData() to update UI
```

### Batch Delete Flow  
```text
User selects multiple vehicles (checkboxes)
        ↓
"Delete X Selected" button appears
        ↓
Confirmation dialog with vehicle count
        ↓
Loop: deleteVehicle for each selected ID
        ↓
Summary toast + refreshData()
```

---

## Expected Outcome

After implementation:
- Single delete: Click vehicle "..." menu → "Delete Vehicle" → Confirm → Vehicle removed
- Batch delete: Select vehicles → Click "Delete Selected" → Confirm → All selected removed
- Duplicate prevention: Warning when adding vehicle that already exists
- Clean fleet: No more duplicates cluttering the dashboard
