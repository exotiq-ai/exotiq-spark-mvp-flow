

# Fix: Payment Dialog UX Polish + Stripe Plumbing Check

## Issues to Fix

### 1. Discount field scroll sensitivity
The discount `<Input type="number">` responds to mouse wheel events, which accidentally changes the value when scrolling the dialog. Fix: add `onWheel` handler to prevent scroll-to-change.

### 2. Amount field "0" won't delete
`value={formData.amount}` — when the user clears the field, `parseFloat("") || 0` immediately sets it back to 0. Fix: allow empty string state so the field can be cleared, then treat empty as 0 on blur/submit.

## Stripe Plumbing Status

**Yes, the plumbing is there.** The payment dialog already:
- Detects Stripe vs manual payment methods (`isStripePayment`)
- Calls `supabase.functions.invoke('create-payment-checkout')` with booking_id, customer info, amount, and payment_type
- The `create-payment-checkout` edge function creates a Stripe Checkout session on the team's connected account
- Handles marketplace fees (20% platform fee for marketplace bookings)
- Creates/reuses Stripe customers by email
- Redirects to Stripe Checkout URL in a new tab
- The `stripe-webhook` handler catches `checkout.session.completed` and `payment_intent.succeeded` to record the payment in the database

So when you connect Stripe via Settings > Payments, the "Pay with Stripe" button will work end-to-end.

## Changes

**File: `src/components/dialogs/RecordPaymentDialog.tsx`**

1. Add `onWheel={(e) => e.currentTarget.blur()}` to the discount Input (line 602) and the amount Input (line 652) to prevent accidental scroll changes.

2. Change the amount field to use a string-based intermediate state so the "0" can be deleted:
   - Store display value as string, parse to number on blur
   - Or simpler: change `value={formData.amount}` to `value={formData.amount || ""}` so 0 renders as empty (matching the discount field pattern already used on line 606)

