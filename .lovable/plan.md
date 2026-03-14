

# Add Confirmation Dialog Before Booking Cancellation

## Problem
All three cancel/decline buttons (pending in EnhancedBookingDialog, confirmed in EnhancedBookingDialog, and Decline in BookEnhanced) fire `updateBookingStatus` immediately with no confirmation step. Accidental clicks can cancel bookings irreversibly.

## Approach
Use the existing `ConfirmationDialog` component (already in the project with destructive variant support) to gate all cancellation actions behind a "Are you sure?" prompt.

## Changes

### 1. `src/components/dialogs/EnhancedBookingDialog.tsx`
- Add `showCancelConfirm` state (boolean)
- Both cancel buttons (pending line 1230, confirmed line 1247) → set `showCancelConfirm = true` instead of calling `updateBookingStatus` directly
- Render `ConfirmationDialog` with `variant="destructive"`, title "Cancel Booking?", description including vehicle/customer name, and `onConfirm` that calls `updateBookingStatus(booking.id, "cancelled")` then closes both dialogs

### 2. `src/components/dashboard/BookEnhanced.tsx`
- Add `cancellingBookingId` state
- Decline button (line 341) → set `cancellingBookingId` instead of calling directly
- Render `ConfirmationDialog` with destructive variant, `onConfirm` calls `updateBookingStatus(cancellingBookingId, 'cancelled')` and clears state

Both use the existing `ConfirmationDialog` component — no new dependencies.

