

# Fix: New Customer Auto-Save to CRM + Booking Card Vehicle Image

## Problem Summary

Three critical issues found after code review:

1. **New customers are NOT saved to CRM** -- When "New Customer" is selected in the booking dialog, the `createBooking` function in `FleetContext.tsx` only inserts into the `bookings` table. It never creates a record in the `customers` table. This means the customer count stays at 0 and no CRM entry exists.

2. **Booking details card shows "No image available"** -- The `EnhancedBookingDialog` uses `getVehicleImage(vehicle.name)` which only checks a hardcoded static mapping. It completely ignores the `vehicle.image_url` field from the database (where Photo Hub stores uploaded/enhanced images). Most vehicles won't have a static mapping entry.

3. **Booking validation schema rejects discount fields** -- The `bookingSchema` in `validationSchemas.ts` does not include `discount_amount`, `discount_reason`, `pickup_location_id`, `dropoff_location_id`, or `status` fields. Since `createBooking` runs `bookingSchema.parse(booking)`, these fields are silently stripped, meaning discounts are never actually saved to the database.

---

## Fix 1: Auto-Create Customer in CRM on New Booking

**File:** `src/contexts/FleetContext.tsx` -- `createBooking` function (line ~762)

After the booking insert succeeds, check if the booking used a new customer (no `customer_id` provided). If so:

1. Insert into the `customers` table with `full_name`, `email`, `phone` from the booking data
2. Update the newly created booking's `customer_id` to link it to the CRM record
3. This ensures every new booking with a new customer creates a CRM entry automatically

The `customerSchema` requires email as non-optional, but booking customers may not have email. The customer insert will use a direct Supabase insert (bypassing the strict schema) since the `customers` table allows nullable email.

**File:** `src/components/dialogs/NewBookingDialog.tsx`

Pass `customer_id` through to `onSubmit` when an existing customer is selected, so `createBooking` knows not to create a duplicate.

---

## Fix 2: Vehicle Image in Booking Details Card

**File:** `src/components/dialogs/EnhancedBookingDialog.tsx` (line ~126)

Change from:
```
const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;
```
To:
```
const vehicleImage = vehicle?.image_url || getVehicleImage(vehicle?.name || '') || null;
```

This prioritizes the database `image_url` (from Photo Hub uploads) and falls back to the static mapping only if no uploaded image exists.

---

## Fix 3: Booking Schema Accepts Discount Fields

**File:** `src/lib/validationSchemas.ts` -- `bookingSchema` (line ~17)

Add these fields to the schema so they pass through validation:
- `discount_amount` (number, optional, default 0)
- `discount_reason` (string, optional, nullable)
- `pickup_location_id` (string, optional, nullable)
- `dropoff_location_id` (string, optional, nullable)
- `status` (string, optional)
- `customer_id` (string, optional, nullable)

Without this fix, `bookingSchema.parse()` strips these fields and they never reach the database.

---

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/FleetContext.tsx` | Auto-create customer record in `createBooking` when new customer, link `customer_id` back to booking |
| `src/components/dialogs/NewBookingDialog.tsx` | Pass `customer_id` when existing customer selected |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Use `vehicle.image_url` as primary image source |
| `src/lib/validationSchemas.ts` | Add discount and location ID fields to booking schema |

## Risk Assessment

| Change | Risk |
|--------|------|
| Auto-create customer | Low -- additive insert, no existing data affected |
| Vehicle image fallback | None -- only changes image source priority |
| Schema update | None -- adds optional fields, existing bookings unaffected |

