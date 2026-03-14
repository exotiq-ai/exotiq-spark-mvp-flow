

# Add Cancel Button for Confirmed Bookings

## Problem
The Cancel button in `EnhancedBookingDialog` is only rendered when `booking.status === "pending"`. Confirmed bookings only show "Complete Booking" — there's no way to cancel a duplicate or unwanted confirmed booking.

## Change

### File: `src/components/dialogs/EnhancedBookingDialog.tsx`

**Lines 1243-1250**: Expand the `confirmed` status block to include a Cancel button alongside "Complete Booking".

Replace the single "Complete Booking" button with a two-button row:
- **Cancel Booking** (outline, destructive styling) — calls `updateBookingStatus(booking.id, "cancelled")`
- **Complete Booking** (primary) — existing behavior

This matches the same pattern already used for `pending` bookings on lines 1226-1241.

```
// Before (confirmed only shows Complete):
{booking.status === "confirmed" && (
  <Button onClick={...} className="w-full">Complete Booking</Button>
)}

// After (confirmed shows Cancel + Complete):
{booking.status === "confirmed" && (
  <div className="flex gap-2">
    <Button variant="outline" onClick={cancel} className="flex-1 text-destructive ...">
      Cancel Booking
    </Button>
    <Button onClick={complete} className="flex-1">
      Complete Booking
    </Button>
  </div>
)}
```

Single file, ~5 lines changed.

