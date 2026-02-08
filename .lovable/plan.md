
# Auto-Refresh CRM After Adding a Customer

## Problem

When a customer is added via the CRM, the list doesn't update until the page is manually refreshed. This is because the `createCustomer` function is the **only** data mutation in the system that doesn't call `refreshData()` after a successful insert.

Every other operation (update customer, add note, blacklist, create booking, create vehicle, etc.) already triggers a refresh -- this one was simply missed.

## Fix

### File: `src/contexts/FleetContext.tsx`

Add `await refreshData()` after the successful customer insert, matching the exact pattern used by every other mutation function. No other changes needed -- no refresh button required.

**Before (lines 1031-1033):**
```
      return;
    }

    toast({ title: "Customer Added", ... });
```

**After:**
```
      return;
    }

    await refreshData();
    toast({ title: "Customer Added", ... });
```

## Result

After this one-line addition, the CRM customer list will instantly reflect newly added customers without any page reload. No refresh button is needed -- the system already has the infrastructure for this; it was just missing from this one function.

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/FleetContext.tsx` | Add `await refreshData()` after successful customer insert |
