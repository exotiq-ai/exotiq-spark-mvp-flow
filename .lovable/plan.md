

# Fix Payment Collection Dialog: Scrollability, Storage, and Status Tracking

## Summary

All payment data is stored in your database's `payments` table, scoped to your tenant account via `team_id`. The fix ensures manual payments actually get saved (currently the button only shows a toast) and that booking statuses update automatically.

## Changes

### 1. Make Dialog Scrollable (`RecordPaymentDialog.tsx`)

Apply the responsive dialog standard: wrap the form content in a `ScrollArea` with `max-h-[60vh]` so it scrolls on mobile and desktop while keeping the header and footer buttons always visible.

### 2. Wire Up Manual Payment Save (`RecordPaymentDialog.tsx`)

Replace the placeholder toast on the "Record Payment" button with the actual `onSubmit()` call that saves to the database:
- Passes: `booking_id`, `customer_id`, `amount`, `payment_type`, `payment_method`, `payment_status: "completed"`, `notes`, `transaction_date`
- Shows success toast and closes the dialog

### 3. Update Booking Payment Status (`FleetContext.tsx`)

After a payment is inserted into the `payments` table:
- Query all completed payments for that booking
- Calculate total paid vs booking's `total_value`
- Update `booking.payment_status` to:
  - `"deposit_paid"` if payment type was "deposit"
  - `"paid"` if total paid >= total value
  - `"partial"` otherwise
- Call `refreshData()` so all views update immediately

### 4. Validation Update (`validationSchemas.ts`)

Expand the `paymentSchema` to accept the additional payment method values (zelle, venmo, paypal, etc.) that tenants can now configure, so validation doesn't reject them.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dialogs/RecordPaymentDialog.tsx` | ScrollArea for overflow, wire up manual payment save, loading state |
| `src/contexts/FleetContext.tsx` | After payment insert: update booking payment_status, call refreshData() |
| `src/lib/validationSchemas.ts` | Expand payment_method enum to include all accepted methods |

