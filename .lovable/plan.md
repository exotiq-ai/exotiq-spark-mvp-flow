

# Fix Payment Validation Error and Add Discount Option

## Root Cause of the Error

The "Validation Error" occurs because the Zod validation schema in `src/lib/validationSchemas.ts` is out of sync with the payment types the dialog actually sends.

**The schema allows:** `deposit`, `rental`, `damage`, `refund`
**The dialog sends:** `deposit`, `balance`, `security_deposit`, `overage_fee`, `damage_fee`

Additionally, the schema does not include `payment_status` or `transaction_date` fields, which the dialog passes in the payment object. Zod's `.parse()` rejects unknown fields and mismatched enum values, causing the red "Validation Error" toast.

## Changes

### 1. Fix Payment Validation Schema (`src/lib/validationSchemas.ts`)

- Expand the `payment_type` enum to include all valid types: `deposit`, `balance`, `rental`, `security_deposit`, `overage_fee`, `damage_fee`, `damage`, `refund`
- Add `payment_status` as an optional string field
- Add `transaction_date` as an optional string field
- Allow `customer_id` to be `null` (the dialog passes `null`, not just empty string)

### 2. Add Discount Option to Payment Dialog (`src/components/dialogs/RecordPaymentDialog.tsx`)

Add a "Payment Discount" section between the financial summary and the payment method, similar to the booking discount flow:

- **Discount Amount** ($) -- numeric input for the discount value
- **Discount Reason** -- dropdown with standard reasons: Promotional, Military Discount, Employee, Friends and Family, Loyalty/Repeat Customer, Manager Override, Custom
- The discount subtracts from the payment amount
- Discount details are stored in the payment's `notes` field as structured JSON alongside any adjustments

### 3. Ensure Data Accuracy

- The `createPayment` function in `FleetContext.tsx` already updates `booking.payment_status` after recording -- verify it correctly accounts for discounted amounts
- Adjustments and discount data are stored in the `notes` field as JSON so CRM/booking history can display the breakdown
- The financial summary already reads from `payments` table for existing payment history -- no changes needed there

## Technical Details

### Schema Fix (validationSchemas.ts, line 71-78)
```
paymentSchema = z.object({
  booking_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive().max(1000000),
  payment_type: z.enum(['deposit','balance','rental','security_deposit','overage_fee','damage_fee','damage','refund']),
  payment_method: z.enum([...]).optional(),
  payment_status: z.string().optional(),
  transaction_date: z.string().optional(),
  notes: z.string().max(5000).optional().nullable(),
})
```

### Discount State in RecordPaymentDialog
```
discountAmount (number, default 0)
discountReason (string, default "")
```

The final payment amount = `formData.amount - discountAmount`. The discount info is included in the structured notes JSON sent to the database.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/validationSchemas.ts` | Fix payment_type enum, add missing fields |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Add discount section (amount + reason), include in notes JSON |

