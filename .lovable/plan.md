
# Fix Vehicle Not Saving During Onboarding

## Problem Summary

When a new customer (`denverexoticrentalcars@gmail.com`) added their first vehicle (Ferrari 488) during onboarding, the vehicle **was not saved to the database** and did not appear in their fleet inventory.

**Evidence:**
- User's team (`c71d6655-710a-46da-95b4-f9b0e5f91386`) has **zero vehicles** in the database
- No database errors logged — indicating the insert never reached the database
- The user got a success toast but no actual data was persisted

---

## Root Cause Analysis

I identified **3 compounding issues**:

### Issue 1: Missing FleetContext Refresh After Create

**File:** `src/contexts/FleetContext.tsx` (lines 703-747)

The `createVehicle` function inserts the vehicle but **never refreshes the local state**:

```typescript
const createVehicle = async (vehicle) => {
  // ... insert to database ...
  if (error) {
    toast({ title: "Error", ... });
    return;
  }
  // ❌ MISSING: refreshVehicles() or refreshData()
  toast({ title: "Vehicle Added", ... });
};
```

**Impact:** Even if the insert succeeded, the UI wouldn't reflect it until a manual refresh or page reload.

### Issue 2: AddVehicleFromPhotoWizard Bypasses FleetContext

**File:** `src/components/photos/AddVehicleFromPhotoWizard.tsx` (lines 221-237)

The wizard inserts directly via Supabase client but:
1. Does NOT call `refreshData()` or invalidate any React Query cache
2. Does NOT notify FleetContext that new data exists

```typescript
// Creates vehicle directly
const { data: vehicleData, error: vehicleError } = await supabase
  .from('vehicles')
  .insert({ ... })
  .select()
  .single();

// ❌ No cache invalidation
// ❌ No FleetContext.refreshData()
```

### Issue 3: Onboarding Flow Has Same Problem

**File:** `src/pages/Onboarding.tsx` (lines 326-339)

The manual vehicle entry (`handleAddVehicle`) inserts directly but:
1. Does NOT call `refreshData()` 
2. Immediately advances to step 4 without waiting for data sync

```typescript
const handleAddVehicle = async () => {
  const { error } = await supabase.from('vehicles').insert({ ... });
  if (error) throw error;
  await handleStepChange(4);  // ❌ Advances before refresh
};
```

---

## Technical Solution

### Fix 1: FleetContext `createVehicle` Must Refresh

Update `src/contexts/FleetContext.tsx` to call `refreshVehicles()` after successful insert:

```typescript
const createVehicle = async (vehicle) => {
  if (!user) return;
  try {
    const validated = vehicleSchema.parse(vehicle);
    const teamId = currentTeam?.id;

    const { error } = await supabase
      .from('vehicles')
      .insert({ ... });

    if (error) {
      toast({ title: "Error", ... });
      return;
    }

    // ✅ ADD: Refresh vehicles list
    refreshVehicles();

    // Show celebration/toast...
  } catch (error) { ... }
};
```

### Fix 2: AddVehicleFromPhotoWizard Must Sync State

Update `src/components/photos/AddVehicleFromPhotoWizard.tsx` to invalidate cache:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useFleet } from '@/contexts/FleetContext';

// Inside component:
const queryClient = useQueryClient();
const { refreshData } = useFleet();

const handleCreateVehicle = async () => {
  // ... existing insert logic ...
  
  if (vehicleError) throw vehicleError;
  
  // ✅ ADD: Sync state after successful insert
  await refreshData();
  queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  
  setCreatedVehicleId(vehicleData.id);
  // ...
};
```

### Fix 3: Onboarding Must Wait for Data Sync

Update `src/pages/Onboarding.tsx` to refresh FleetContext:

```typescript
import { useFleet } from '@/contexts/FleetContext';

// Inside component:
const { refreshData } = useFleet();

const handleAddVehicle = async () => {
  if (!user) return;
  setLoading(true);
  try {
    const { error } = await supabase.from('vehicles').insert({ ... });
    if (error) throw error;

    // ✅ ADD: Wait for data sync before advancing
    await refreshData();
    
    await handleStepChange(4);
  } catch (error) { ... }
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/FleetContext.tsx` | Add `refreshVehicles()` call after insert in `createVehicle` |
| `src/components/photos/AddVehicleFromPhotoWizard.tsx` | Add `refreshData()` and `queryClient.invalidateQueries` after insert |
| `src/pages/Onboarding.tsx` | Add `refreshData()` in `handleAddVehicle` before step change |

---

## Secondary Improvement: Optimistic UI Update

For faster perceived performance, we can also add the vehicle to local state immediately (optimistic update), then reconcile with the server:

```typescript
// In FleetContext createVehicle:
// 1. Generate temp ID
// 2. Add to local state immediately
// 3. Insert to database
// 4. Replace temp with real ID on success, or rollback on error
```

This is optional but improves UX significantly.

---

## Testing Plan

1. Create a new test account
2. Complete onboarding steps 1-2
3. Add a vehicle via:
   - Manual entry form
   - Photo wizard
   - Bulk import
4. Verify vehicle appears immediately in fleet inventory (no page reload needed)
5. Navigate away and back to confirm persistence
6. Check database directly to confirm row exists

---

## Expected Outcome

After these fixes:
- Vehicles added during onboarding will persist to the database
- UI will immediately reflect new vehicles without manual refresh
- All three vehicle creation paths (manual, photo wizard, import) will sync properly
