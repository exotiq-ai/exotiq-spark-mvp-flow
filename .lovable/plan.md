

# Fix Pricing Consistency Across All Booking Surfaces

## The Problem

There are **four separate places** that calculate booking totals, and they all use different formulas. This means changing a booking in one place produces a different number than viewing it in another.

| Location | Day Calculation | Total Formula |
|----------|----------------|---------------|
| New Booking | `Math.ceil((end - start) / msPerDay)` | `rate x days - discount` |
| Edit Booking | `differenceInDays(end, start)` (truncates) | `rate x days` (loses discount) |
| Enhanced Booking (inline edit) | `differenceInDays(end, start)` | `rate x days` (loses discount, delivery fee) |
| Payment Dialog | `differenceInDays(end, start)` | `rate x days - discount + delivery_fee` |

The result: the math doesn't match. Editing a booking overwrites the total without preserving discounts. The day calculation itself can differ by 1 day depending on which dialog you use.

## The Fix

### 1. Create a Single Pricing Utility (`src/lib/pricingUtils.ts`)

One function that all dialogs import:

```text
calculateBookingTotal(startDate, endDate, dailyRate, options)
  -> { rentalDays, rentalSubtotal, discount, gasFee, deliveryFee, grandTotal }
```

- **Day calculation**: Use date-only comparison (strip time, count calendar days). This matches the tenant's billing model -- they bill by day, not by hour.
- **Formula**: `(dailyRate x days) - discount + gasFee + deliveryFee`
- Every dialog that shows or saves a total will call this same function.

### 2. Add Gas Fee to Database

Add two columns to the `bookings` table:
- `gas_fee` (numeric, default 20.00) -- the flat re-fueling service fee
- `gas_fee_waived` (boolean, default false) -- tenant can waive per booking

### 3. Update New Booking Dialog

- Use `pricingUtils.calculateBookingTotal()` for the pricing summary
- Add gas fee toggle (on by default, $20)
- Auto-populate mileage fields from the selected vehicle
- Save `gas_fee` and `gas_fee_waived` to the booking record
- The `total_value` saved includes: `(rate x days) - discount + gas_fee + delivery_fee`

### 4. Update Edit Booking Dialog

- Use `pricingUtils.calculateBookingTotal()` for price recalculation
- **Preserve existing discount, gas fee, and delivery fee** when recalculating after date changes
- Show full price breakdown (not just `days x rate`)
- Save the correct `total_value` that accounts for all line items

### 5. Update Enhanced Booking Dialog (Inline Edit)

- Same pricing utility for the inline edit price breakdown
- Preserve discount/gas/delivery when saving edits
- The financial summary in view mode will also use the utility for consistency

### 6. Update Record Payment Dialog

- Use `pricingUtils.calculateBookingTotal()` for the financial summary
- Include `gas_fee` as a line item (if not waived)
- The "Balance Remaining" calculation: `grandTotal - totalPaid`

### 7. Update Vehicle Mileage Rate Dropdown

- Change the free-text overage rate input to a dropdown with contract-standard tiers: $1.99, $2.99, $3.49, $3.99, $4.49, $4.99
- Apply to both `AddVehicleDialog` and `VehicleDetailsDialog`

## Technical Details

### New File: `src/lib/pricingUtils.ts`

```text
calculateRentalDays(startDate: string | Date, endDate: string | Date): number
  - Strips time component
  - Counts calendar days between start and end
  - Minimum 1 day

calculateBookingTotal(params): BookingPricing
  params: { startDate, endDate, dailyRate, discountAmount?, gasFee?, gasFeeWaived?, deliveryFee? }
  returns: { rentalDays, rentalSubtotal, discountAmount, gasFee, deliveryFee, grandTotal }
```

### SQL Migration

```text
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS gas_fee numeric DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS gas_fee_waived boolean DEFAULT false;
```

### Files Changed

| File | Change |
|------|--------|
| `src/lib/pricingUtils.ts` | New -- single source of truth for pricing math |
| SQL Migration | Add `gas_fee`, `gas_fee_waived` to bookings |
| `src/components/dialogs/NewBookingDialog.tsx` | Use pricingUtils, add gas fee toggle, populate mileage from vehicle |
| `src/components/dialogs/EditBookingDialog.tsx` | Use pricingUtils, preserve discount/gas/delivery in total |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Use pricingUtils for inline edit and view-mode financial summary |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Use pricingUtils, add gas fee line item |
| `src/components/dialogs/AddVehicleDialog.tsx` | Change mileage rate to dropdown ($1.99-$4.99) |
| `src/components/dialogs/VehicleDetailsDialog.tsx` | Change mileage rate to dropdown ($1.99-$4.99) |

### What This Ensures

- Change a date anywhere -> same total everywhere
- Discounts, gas fees, delivery fees are never lost during edits
- Payment dialog always shows the same numbers as the booking overview
- CRM booking history reflects accurate totals
- Day count is always based on calendar dates, not timestamps
