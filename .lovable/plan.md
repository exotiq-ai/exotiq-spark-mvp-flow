
# Booking Flow Enhancements & CRM Delete

## Overview

Six targeted improvements to the booking creation dialog, calendar/dashboard refresh behavior, today's bookings filter, and CRM customer management.

---

## 1. Discount Pricing in New Booking Dialog

**Problem:** No way to apply a discount when creating a booking.

**Solution:** Add a collapsible "Discount" section below the date fields in `NewBookingDialog.tsx`:

- A dollar-amount input field ($ off the total, not per-day) 
- A dropdown for discount reason: Promotional, Military Discount, Employee, Friends and Family
- Real-time price recalculation showing original total, discount, and final total
- The discount and reason are stored in two new columns on the `bookings` table

**Database migration:**
```sql
ALTER TABLE bookings ADD COLUMN discount_amount numeric DEFAULT 0;
ALTER TABLE bookings ADD COLUMN discount_reason text;
```

The `total_value` stored will be the **net** amount (original minus discount). The `discount_amount` and `discount_reason` columns preserve the audit trail.

**UI placement:** Between the date pickers and the location fields, as a collapsible row (collapsed by default). When expanded, shows the discount input + reason dropdown side by side. A live summary line appears: "Subtotal: $X | Discount: -$Y | Total: $Z".

---

## 2. Prevent Accidental Dialog Close

**Problem:** Clicking outside the New Booking dialog closes it and loses all entered data.

**Solution:** Add `onInteractOutside` and `onPointerDownOutside` event handlers to `DialogContent` that call `e.preventDefault()`. This prevents the overlay click from closing the dialog. Users must explicitly click "Cancel" to close.

This is a one-line change on the `DialogContent` component -- Radix UI Dialog supports these props natively.

---

## 3. Instant Refresh After Booking Creation

**Problem:** New bookings don't appear immediately in the calendar or pending approval sections.

**Solution:** After `createBooking` succeeds in `FleetContext.tsx`, it already calls `refreshData()` -- but the issue is the `NewBookingDialog` calls `onSubmit` (which is `createBooking`), and then immediately closes the dialog. The fix:

- In `FleetContext.createBooking`: ensure `await refreshData(true)` is called (force refresh) after the insert succeeds -- this is already partially in place but needs the `true` flag
- Invalidate React Query booking caches via `queryClient.invalidateQueries({ queryKey: ['bookings'] })` in the `BookEnhanced` component's `handleCreateBooking` wrapper

No structural changes needed -- just ensuring the force-refresh path fires.

---

## 4. Fix "Today's Bookings" Filter

**Problem:** `BookEnhanced.tsx` line 148 has `todayBookings = bookings.slice(0, 5)` -- this takes the first 5 bookings with **zero date filtering**. Any booking shows up as "today's".

**Solution:** Replace with a proper date filter matching the pattern already used in `Book.tsx`:

```typescript
const todayBookings = useMemo(() => {
  return bookings.filter(b => {
    const startDate = new Date(b.start_date);
    const endDate = new Date(b.end_date);
    return (
      isToday(startDate) || 
      (startDate <= new Date() && endDate >= new Date())
    );
  }).slice(0, 5);
}, [bookings]);
```

This shows only bookings that either start today or are actively spanning today (started before, ending after). Future bookings won't appear here.

---

## 5. Delete Customer from CRM

**Problem:** No way for an admin to delete a customer. The `FleetContext` has `updateCustomer`, `blacklistCustomer`, and `addCustomerNote` but no `deleteCustomer`.

**Solution:**

- Add `deleteCustomer(customerId: string)` to `FleetContext` that:
  1. Checks if the customer has any active/confirmed bookings (prevent deletion if so)
  2. Deletes the customer row from the `customers` table
  3. Calls `refreshData()`

- Add a "Delete Customer" button (red, destructive variant) to the `CustomerProfileDialog` with a confirmation alert dialog: "This will permanently remove this customer. Bookings referencing this customer will retain the customer name but lose the CRM link."

- The `bookings` table uses `customer_id` as a nullable FK, so deleting a customer sets it to NULL -- the `customer_name` text field preserves the name for historical bookings.

**Database consideration:** The FK on `bookings.customer_id` likely has no ON DELETE action. We'll add a migration to set it to `SET NULL`:

```sql
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
```

---

## Files Changed

| Action | File | Change |
|--------|------|--------|
| Migrate | Database | Add `discount_amount`, `discount_reason` columns; update customer FK |
| Modify | `src/components/dialogs/NewBookingDialog.tsx` | Add discount section, prevent outside-click close |
| Modify | `src/components/dashboard/BookEnhanced.tsx` | Fix todayBookings filter |
| Modify | `src/contexts/FleetContext.tsx` | Add `deleteCustomer`, ensure force refresh on createBooking |
| Modify | `src/components/dialogs/CustomerProfileDialog.tsx` | Add delete button with confirmation |

## Risk Assessment

| Change | Risk | Reason |
|--------|------|--------|
| Discount fields | None | New nullable columns, additive UI |
| Prevent outside click | None | UX-only, no data impact |
| Refresh fix | None | Ensures existing refresh path fires properly |
| Today filter fix | Low | Bug fix -- currently showing wrong data |
| Delete customer | Low | Guarded by confirmation + active booking check + SET NULL FK |
