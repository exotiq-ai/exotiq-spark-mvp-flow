

# Fix: "View Full Profile" and "Link Customer" Buttons in Calendar Booking Dialog

## Root Cause

The `BookingCalendar` component is rendered on line 559 of `BookEnhanced.tsx` **without** the `onNavigateToModule` prop:

```
<BookingCalendar />
```

This means when a booking is clicked in the calendar tab, the `EnhancedBookingDialog` opens with `onNavigateToModule` as `undefined`. All navigation buttons ("View Full Profile", "CRM", "Vehicle", "Payments" quick links) silently do nothing because they call `onNavigateToModule?.()` which is a no-op when undefined.

The "Link Customer" button itself works (it opens the `LinkCustomerDialog` via internal state), so it is NOT broken. However, if the user means the button doesn't seem to do anything visible after linking, it may be because the dialog closes but the calendar doesn't visually update until a refresh.

## Fix

### File: `src/components/dashboard/BookEnhanced.tsx` (line 559)

Pass the `onNavigateToModule` handler to `BookingCalendar`, matching the same pattern already used for the overview tab's `EnhancedBookingDialog`:

**Before:**
```tsx
<BookingCalendar />
```

**After:**
```tsx
<BookingCalendar 
  onNavigateToModule={(moduleId, context) => {
    if (moduleId === 'core' && context?.customerId) {
      goToCustomerProfile(context.customerId);
    } else if (moduleId === 'motoriq' && context?.vehicleId) {
      goToVehicleDetails(context.vehicleId);
    } else if (moduleId === 'pulse' && context?.bookingId) {
      goToPayments(context.bookingId);
    }
  }}
/>
```

This is a single-line change. The `BookingCalendar` component already accepts `onNavigateToModule` as a prop and passes it through to `EnhancedBookingDialog` -- it just was never provided from the parent.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookEnhanced.tsx` | Pass `onNavigateToModule` to `BookingCalendar` on line 559 |

## Risk

None. This is wiring an existing prop that was simply missing.
