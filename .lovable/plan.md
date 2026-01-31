
# Fix Non-Working Shortcut Buttons (Vehicle, CRM, Payments)

## Problem Identified

The "Vehicle", "CRM", and "Payments" shortcut buttons at the bottom of the Booking Details dialog are not working. Clicking them does nothing (only logs to console).

## Root Cause

In `BookEnhanced.tsx`, the `onNavigateToModule` callback passed to `EnhancedBookingDialog` is a placeholder that only logs:

```typescript
// Current broken implementation (lines 247-249)
onNavigateToModule={(moduleId, context) => {
  console.log('Navigate to:', moduleId, context);  // Just logs, doesn't navigate!
}}
```

When users click the shortcut buttons, the dialog calls this callback with the appropriate module and context (e.g., `"motoriq"` with `{ vehicleId: "..." }`), but the callback doesn't actually navigate anywhere.

## Solution

Replace the stub with actual navigation logic using the existing `useModuleNavigation` hook, which already provides:
- `goToVehicleDetails(vehicleId)` - Navigate to MotorIQ with vehicle details
- `goToCustomerProfile(customerId)` - Navigate to CRM with customer profile
- `goToPayments(bookingId)` - Navigate to Payments section

## Code Fix

**File: `src/components/dashboard/BookEnhanced.tsx`**

Replace lines 247-249:
```typescript
// BEFORE (broken)
onNavigateToModule={(moduleId, context) => {
  console.log('Navigate to:', moduleId, context);
}}

// AFTER (working)
onNavigateToModule={(moduleId, context) => {
  setShowBookingDetails(false);  // Close dialog first
  setSelectedBooking(null);
  
  if (moduleId === 'motoriq' && context?.vehicleId) {
    goToVehicleDetails(context.vehicleId);
  } else if (moduleId === 'core' && context?.customerId) {
    goToCustomerProfile(context.customerId);
  } else if (moduleId === 'pulse' && context?.bookingId) {
    goToPayments(context.bookingId);
  }
}}
```

The hook is already imported (`useModuleNavigation`) but only `goToBookingDetails` is being used. We need to destructure the additional navigation functions.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/BookEnhanced.tsx` | Update `onNavigateToModule` callback to use actual navigation functions |

## Why This Works

1. The `useModuleNavigation` hook uses `setSearchParams` from React Router to update URL parameters
2. The dashboard reads these params to switch modules and pass context
3. Each module handles its own URL params (e.g., MotorIQ reads `vehicleId` to show specific vehicle)
