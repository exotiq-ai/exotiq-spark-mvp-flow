
# Fix Booking Approval Flow & Data Display Issues

## Issues Identified

After thorough investigation, I found **5 distinct issues** that need to be addressed:

### Issue 1: Missing "View Details" Button in Pending Approval Section
**Location**: `src/components/dashboard/BookEnhanced.tsx` (lines 273-296)

**Current State**: The Pending Approval section only shows Decline and Approve buttons, with no way to view booking details first.

**Impact**: Users cannot verify or edit booking information before approving.

**Fix**: Add a "View Details" button that opens the booking details dialog before any action is taken.

---

### Issue 2: Search Results Don't Navigate to Booking Details
**Location**: `src/components/common/EnhancedGlobalSearch.tsx` (lines 217-233)

**Current State**: When clicking a booking in search results, it navigates to `/dashboard?module=book` without the `bookingId` parameter:
```typescript
action: () => navigate("/dashboard?module=book")  // Missing bookingId!
```

**Impact**: Gregory's booking appears in search but clicking it goes nowhere useful - doesn't open the booking details.

**Fix**: Update the navigation to include the bookingId:
```typescript
action: () => navigate(`/dashboard?module=book&bookingId=${b.id}`)
```

---

### Issue 3: Vehicle Name Not Displayed for Imported Bookings
**Location**: `src/components/dashboard/BookEnhanced.tsx` (lines 120-127)

**Current State**: The `getVehicleDisplay()` function only looks up by `vehicle_id`:
```typescript
const getVehicleDisplay = (vehicleId: string) => {
  const vehicle = vehicles.find(v => v.id === vehicleId);
  if (!vehicle) {
    return 'Unknown Vehicle';  // Ignores booking.vehicle_name!
  }
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
};
```

**Database Evidence**: Gregory's booking has:
- `vehicle_id: null`
- `vehicle_name: "2017 Audi S8 Plus"` (correctly stored!)

**Impact**: Shows "Unknown Vehicle" instead of the imported vehicle name.

**Fix**: Update to accept the booking object and fall back to `vehicle_name`:
```typescript
const getVehicleDisplay = (booking: Booking) => {
  const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
  if (vehicle) {
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  }
  // Fall back to stored vehicle_name from import
  if (booking.vehicle_name) {
    return booking.vehicle_name;
  }
  return 'Unknown Vehicle';
};
```

---

### Issue 4: Booking Not Appearing on Calendar
**Location**: Multiple places, but root cause in data

**Database Evidence**:
```
Gregory Ringler:
  start_date: 2026-02-10
  end_date: 2026-02-08  ← END is BEFORE START!
```

**Root Causes**:
1. **Invalid date range**: The CSV import stored `end_date` before `start_date`, which breaks date interval filtering
2. **Location filtering**: Bookings with `vehicle_id: null` and no `pickup_location_id` may be filtered out when a specific location is selected (line 29-37 in `useLocationFilteredFleet.ts`)

**Fixes**:
1. Add date validation during import to ensure `end_date >= start_date`
2. Ensure calendar displays bookings even when `vehicle_id` is null
3. Ensure location filtering handles null vehicle_id gracefully

---

### Issue 5: EnhancedBookingDialog Shows "Unknown Vehicle" for Imported Bookings
**Location**: `src/components/dialogs/EnhancedBookingDialog.tsx` (line 216)

**Current State**:
```typescript
{vehicle?.name || "Unknown Vehicle"}
```

**Fix**: Fall back to `booking.vehicle_name`:
```typescript
{vehicle?.name || booking?.vehicle_name || "Unknown Vehicle"}
```

---

## Implementation Plan

### Phase 1: Add View Details Button to Pending Approval

**File**: `src/components/dashboard/BookEnhanced.tsx`

Add a "View" button before Decline/Approve that opens the `EnhancedBookingDialog`:

```text
Current UI:
  [Customer Name]
  [Vehicle - Date]
  [Decline] [Approve]

New UI:
  [Customer Name]  
  [Vehicle - Date]
  [View] [Decline] [Approve]
```

The View button will:
1. Set the `selectedBookingId` state
2. Open the `EnhancedBookingDialog` component (already imported on line 8)
3. Allow user to review all details before deciding

---

### Phase 2: Fix Vehicle Name Display Throughout

**Files to update**:
1. `src/components/dashboard/BookEnhanced.tsx` - Update `getVehicleDisplay()`
2. `src/components/dashboard/BookingCalendar.tsx` - Update vehicle name display
3. `src/components/dialogs/EnhancedBookingDialog.tsx` - Fall back to `vehicle_name`
4. `src/components/common/EnhancedGlobalSearch.tsx` - Fix navigation URL

**Pattern**: Everywhere we show vehicle info, check:
```typescript
vehicle?.name || booking?.vehicle_name || "Unknown Vehicle"
```

---

### Phase 3: Fix Search Navigation

**File**: `src/components/common/EnhancedGlobalSearch.tsx`

Update booking search results to navigate with bookingId:
```typescript
// Before:
action: () => navigate("/dashboard?module=book")

// After:
action: () => navigate(`/dashboard?module=book&bookingId=${b.id}`)
```

---

### Phase 4: Add Date Validation to Import

**File**: `src/components/import/ImportWizard.tsx`

Add validation to ensure imported bookings have valid date ranges:
```typescript
// Validate dates
if (row.start_date && row.end_date) {
  const start = new Date(row.start_date);
  const end = new Date(row.end_date);
  if (end < start) {
    // Swap dates or warn user
    [row.start_date, row.end_date] = [row.end_date, row.start_date];
  }
}
```

---

### Phase 5: Fix Location Filtering for Null Vehicle Bookings

**File**: `src/hooks/useLocationFilteredFleet.ts`

Update the booking filter logic to handle null vehicle_id:
```typescript
// Lines 29-37: Current logic fails for null vehicle_id
return fleet.bookings.filter(b => {
  if (b.pickup_location_id) {
    return b.pickup_location_id === selectedLocationId;
  }
  // If no pickup_location_id and no vehicle_id, include in "all" 
  // or when selectedLocationId matches a specific condition
  const vehicle = fleet.vehicles.find(v => v.id === b.vehicle_id);
  if (!vehicle && !b.pickup_location_id) {
    // Include bookings that have no location info (unassigned imports)
    return true; // Or use a default behavior
  }
  return vehicle?.location_id === selectedLocationId;
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/BookEnhanced.tsx` | Add View button, update `getVehicleDisplay()` to use `vehicle_name` fallback |
| `src/components/common/EnhancedGlobalSearch.tsx` | Fix booking navigation to include `bookingId` |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Use `vehicle_name` fallback for display |
| `src/components/dashboard/BookingCalendar.tsx` | Update vehicle name display for null vehicle_id |
| `src/components/import/ImportWizard.tsx` | Add date validation |
| `src/hooks/useLocationFilteredFleet.ts` | Handle null vehicle_id in location filter |

---

## Testing Checklist

After implementation:

- [ ] Click "View" on pending booking → Opens full booking details dialog
- [ ] View details shows vehicle name from `vehicle_name` field when `vehicle_id` is null
- [ ] Approve booking → Status changes to "confirmed"
- [ ] Approved booking appears on calendar (for Feb 2026)
- [ ] Search for "Gregory" → Click booking result → Opens booking details
- [ ] Import new booking CSV with swapped dates → Dates are auto-corrected
- [ ] Location filter "All Locations" shows bookings with null vehicle_id
