

# Fix Search Bar Navigation — Revised Plan

## Changes from original plan

- **Add Team Hub** to EnhancedGlobalSearch module list (was missing alongside Fleet)
- **Audit "New Booking"** action — verify BookEnhanced reads `action=new`, fix if not
- **CommandPalette Fleet** is already correct — only "Customers" line 162 needs fixing

## Files & Changes

### 1. `src/components/common/EnhancedGlobalSearch.tsx`
- Line 116: "Add Vehicle" → `moduleIdToPath("fleet", { action: "add-vehicle" })`
- Line 124: "Add Customer" → `moduleIdToPath("book", { tab: "crm", action: "add-customer" })`
- Line 279: Vehicle results → `moduleIdToPath("fleet", { vehicleId: v.id })`
- Lines 183-240: Add "Fleet" (`Car` icon) and "Team Hub" (`Users` icon) to modules list

### 2. `src/components/common/CommandPalette.tsx`
- Line 162: "Customers" → `moduleIdToPath('book', { tab: 'crm' })`

### 3. `src/components/dashboard/CRMSection.tsx`
- Add `useEffect` reading `action=add-customer` from searchParams → `setShowAddCustomer(true)` + clear param (mirrors existing `customerId` pattern on lines 58-72)

### 4. `src/components/fleet/FleetPageEnhanced.tsx`
- Add `useEffect` reading `action=add-vehicle` from searchParams → `setShowAddDialog(true)` + clear param

### 5. Audit: `src/components/dashboard/BookEnhanced.tsx`
- Verify `action=new` opens NewBookingDialog — fix if missing

