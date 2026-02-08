

# Fix CRM Data Display + Add Booking from Customer Card

## Issues Found

### 1. Duplicate Customer Records
The auto-create logic in `createBooking` doesn't check for existing customers with the same name/email before creating. Gregory Ringler now has **two CRM entries** -- one with 2 bookings linked, and a duplicate with 0. The CRM list may show the wrong one.

**Fix:** Before inserting a new customer in `createBooking`, query for an existing customer with the same email or name+phone. If found, use that existing `customer_id` instead of creating a duplicate.

### 2. Benji Booking Not Linked
The Benji S Handuana booking (`8fffa85a`) was created before the auto-create code shipped, so `customer_id` is `null`. This is a data issue, not a code bug. The "Link Customer" button on that booking already works -- you can link it manually. No code change needed for this specific record.

### 3. "Add Booking" Button in Customer Profile
Add a button in the `CustomerProfileDialog` (in the Bookings tab and optionally Overview) that opens the `NewBookingDialog` pre-filled with the customer's details.

### 4. Customer Bookings Tab Shows Wrong Data
The bookings passed to `CustomerProfileDialog` are filtered by `customer_id` in `CRMSection.tsx`. This is correct, but if the user clicks on the duplicate customer entry (the new auto-created one), it will show 0 bookings because the bookings are linked to the original entry.

**Fix:** The duplicate prevention in Fix 1 prevents this going forward. For existing duplicates, we'll add a cleanup note.

---

## Changes

### File: `src/contexts/FleetContext.tsx` -- `createBooking` function

**Before creating a new customer**, add a duplicate check:

```typescript
// Check for existing customer by email or name before creating
let existingCustomerId = null;
if (booking.customer_email) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('email', booking.customer_email)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) existingCustomerId = existing.id;
}
if (!existingCustomerId && booking.customer_name) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('full_name', booking.customer_name)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) existingCustomerId = existing.id;
}
```

If found, link that existing customer instead of inserting a new one.

Also update the existing customer's `total_bookings` and `lifetime_value` after linking.

### File: `src/components/dialogs/CustomerProfileDialog.tsx`

Add an "Add Booking" button in the Bookings tab (next to the empty state, or at the top of the bookings list). This button:
- Accepts a new `onAddBooking` callback prop
- When clicked, closes the customer profile dialog and opens the new booking dialog pre-filled with the customer's name, email, and phone

Add the prop to `CustomerProfileDialogProps`:
```typescript
interface CustomerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  bookings: Booking[];
  onAddBooking?: (customer: Customer) => void;  // NEW
}
```

Add button in the Bookings tab area:
- A prominent "New Booking" button with a Plus icon at the top of the Bookings tab
- Also show it in the empty state as a call-to-action

### File: `src/components/dashboard/CRMSection.tsx`

Pass the `onAddBooking` handler to `CustomerProfileDialog`. This handler:
1. Closes the customer profile dialog
2. Opens `NewBookingDialog` (add state for this)
3. Pre-fills the customer info by setting a `prefillCustomer` state

Add the `NewBookingDialog` import and rendering, with the prefill customer data passed through.

### File: `src/components/dialogs/NewBookingDialog.tsx`

Add an optional `prefillCustomer` prop so when opened from CRM, it auto-selects the existing customer:

```typescript
interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Tables<'vehicles'>[];
  onSubmit: (booking: ...) => Promise<void>;
  prefillCustomer?: { id: string; name: string; email?: string; phone?: string };
}
```

When `prefillCustomer` is provided, auto-set `selectedCustomerId`, `customerName`, `customerEmail`, `customerPhone` on mount.

---

## Tenant Flow Answer

Currently the flow supports **both** paths:
- **CRM first, then booking** -- create customer in CRM, then create booking and select existing customer
- **Booking first** -- select "New Customer" in booking dialog, and it auto-creates the CRM entry

Both paths will work correctly after these fixes. The new "Add Booking" button in the CRM card adds a convenient shortcut for the CRM-first workflow.

---

## Database Cleanup

The duplicate Gregory Ringler entry (`a733fdcc`) with 0 bookings should be deleted. This will be done via the existing "Delete Customer" button in the CRM, or can be cleaned up manually. No migration needed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/FleetContext.tsx` | Duplicate check before auto-creating customer; update stats after linking |
| `src/components/dialogs/CustomerProfileDialog.tsx` | Add "New Booking" button with `onAddBooking` callback |
| `src/components/dashboard/CRMSection.tsx` | Wire up `onAddBooking`, add `NewBookingDialog` with prefill |
| `src/components/dialogs/NewBookingDialog.tsx` | Accept `prefillCustomer` prop for auto-fill |
