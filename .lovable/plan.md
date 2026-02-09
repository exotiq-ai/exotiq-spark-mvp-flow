

# Fix: Link Customer Dialog -- Add "Create and Link" for Unmatched Bookings

## What's Happening

The booking for "Benji S Handuana" was created before the automated CRM sync was added. As a result:
- The booking has the customer's name, email, and phone stored as text fields
- No matching record exists in the CRM (customers table)
- The "Link Customer" dialog only searches existing CRM records -- it cannot create one

This is not a bug in the current booking flow. New bookings already auto-create CRM records. This is a gap for **legacy bookings** created before that feature shipped.

## SOP Answer

**No, the tenant should not need to add customers to CRM first.** The system already auto-creates CRM records for new bookings. The missing piece is a way to handle older bookings that slipped through before that automation existed.

## The Fix

### Update `LinkCustomerDialog.tsx`

Replace the passive "Can't find the customer? Create them in CRM first." message with an actionable **"Create & Link"** button:

- Pre-fill the new customer form with the booking's existing `customer_name`, `customer_email`, and `customer_phone`
- On click: create the customer in the `customers` table, then update the booking's `customer_id` to point to it
- This is a single-click operation -- no need to leave the dialog

### What Changes

| File | Change |
|------|--------|
| `src/components/dialogs/LinkCustomerDialog.tsx` | Add a "Create & Link" button at the bottom that creates a new CRM record from the booking's existing name/email/phone and links it in one step. Also accept `currentCustomerEmail` and `currentCustomerPhone` props so the data flows from the booking into the new customer record. |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Pass `customer_email` and `customer_phone` from the booking to the `LinkCustomerDialog` so the create flow has complete data. |

### Technical Details

The "Create & Link" button in `LinkCustomerDialog` will:

1. Insert into `customers` table: `{ full_name: currentCustomerName, email: currentCustomerEmail, phone: currentCustomerPhone, user_id, team_id }`
2. Update the booking: `{ customer_id: newCustomer.id }`
3. Call `refreshData()` and close the dialog

This matches the exact same logic already in `createBooking` (FleetContext lines 821-840) but makes it available retroactively for legacy bookings.

### Duplicate Prevention

Before creating, the button will check if a customer with the same email already exists (same logic as the auto-sync). If found, it links the existing record instead of creating a duplicate.

