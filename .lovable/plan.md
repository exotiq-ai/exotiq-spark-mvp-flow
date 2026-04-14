

# Fix: Payment Dialog Financial Summary and Math Issues

## Problems Identified

### 1. Amount field doesn't reflect discount
- User enters discount of $100 in the Payment Discount section
- The green text correctly says "Collecting $4,720.00"
- But the **Amount field still shows $4,820** (the pre-discount value)
- The **button says "Record $4,720.00 Payment"** (correct, uses `finalPaymentAmount`)
- This creates a confusing variance — user sees two different numbers

**Root cause**: `formData.amount` is only set when payment type changes (line 166-178). The discount is subtracted separately in `finalPaymentAmount` (line 236) but the Amount input still displays the raw `formData.amount`. The Amount field and the button show different values.

### 2. No gas fee toggle in the payment dialog
- The financial summary reads `gas_fee_waived` from the booking record (read-only)
- If the gas fee was set during booking creation, there's no way to waive/adjust it from the payment window
- The EditBookingDialog has this toggle, but the RecordPaymentDialog does not

### 3. Amount field allows manual override that breaks the math
- User can type any number in the Amount field, which disconnects it from the financial summary above
- No visual connection between the summary's "Balance Remaining" and what's in the Amount field

## Plan

### File: `src/components/dialogs/RecordPaymentDialog.tsx`

**A. Add gas fee toggle to the financial summary section** (~lines 332-337)
- Add a Switch component next to the gas fee line item
- Add local state `gasFeeWaived` initialized from booking
- When toggled, recalculate `financials` using the local state instead of the booking's stored value
- Persist the waiver by updating the booking record when payment is submitted (via `updateBookingDetails`)

**B. Fix the discount → amount → button math flow**
- Remove the separate `discountAmount` state for the payment-level discount
- Instead, make the Amount field **read-only when auto-calculated** (deposit/balance/security_deposit types) and show the discount-adjusted value directly
- OR: simpler approach — when `discountAmount` changes, auto-update `formData.amount` to reflect `baseAmount - discountAmount` so the Amount field and button always match
- Move the discount section **above** the Amount field and make the Amount field show `finalPaymentAmount` directly
- The button label should match whatever is in the Amount field

**C. Reorder the payment form for logical flow**
Current order: Financial Summary → Adjustments → Discount → Payment Method → Payment Type → Amount → Notes
Better order:
1. Financial Summary (with inline gas fee toggle)
2. Payment Method
3. Payment Type
4. Adjustments (collapsible)
5. Discount
6. **Calculated Amount** (auto-filled, still editable for manual override)
7. Notes
8. Button shows the Amount field value

**D. Auto-sync the Amount field**
- When payment type changes → set amount (already works)
- When discount changes → update amount to `baseAmount - discountAmount`
- When adjustments change → update amount to include adjustments
- Formula: `amount = baseForType + adjustmentsTotal - discountAmount`
- The button always shows `formData.amount` (no separate `finalPaymentAmount`)

## Summary of changes

| Change | Impact |
|--------|--------|
| Gas fee toggle in payment dialog | Users can waive gas fee at payment time |
| Auto-sync Amount with discount/adjustments | No more variance between field and button |
| Reorder form sections | Logical top-down flow |
| Remove dual-amount confusion | Single source of truth for payment amount |

Single file changed: `src/components/dialogs/RecordPaymentDialog.tsx`

