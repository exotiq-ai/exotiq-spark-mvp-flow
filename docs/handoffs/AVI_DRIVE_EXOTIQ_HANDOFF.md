# Avi/Hermes Handoff — Drive Exotiq Payment UI Updates

**Document Type:** Frontend Implementation Handoff  
**Date:** May 28, 2026  
**For:** Avi (Hermes coding agent) — Drive Exotiq / exotiq.rent  
**Context:** The Stripe payment architecture has been finalized. This doc covers what needs to change in the renter-facing UI to align with the backend payment flow.

---

## Architecture Decisions Made

These are locked. Build against them:

| Decision | Answer |
|----------|--------|
| Charge model | V1: Single Stripe Checkout (full amount via Exotiq account, operator share transferred automatically) |
| Renter platform fee | 10% of operator total (rental + extras + operator taxes) |
| Platform fee base | Excludes deposits, excludes protection |
| Protection plan pricing | $89/day (hardcoded, Exotiq-controlled) |
| Statement descriptor | `EXOTIQ.RENT` (single charge for V1) |
| Free cancellation window | 72 hours before pickup |
| Platform fee refundable? | Yes within 72h window; non-refundable after |
| Protection refundable? | Yes within 72h window; non-refundable after rental starts or early return |
| Security deposit | Separate auth hold on operator's connected account (created server-side after payment) |
| Broker commission | Invisible to renter (operator-side only, Phase 2) |

---

## What's Correct in the Current Scaffold (Keep As-Is)

These are already right. Don't change them:

- `domain/booking/totals.ts` — fee calculation logic is correct
- `platformFeeRate: 0.10` — correct
- Fee base = `operatorTotalCents` (rental + extras + tax, excluding deposit) — correct
- Protection as Exotiq pass-through, not in fee base — correct
- "Security deposits or future authorization holds are not included in the platform-fee base" — correct
- ReviewStep split display (Operator section + Exotiq.Rent section) — correct
- PayStep breakdown — correct
- ConfirmationScreen charge display — correct

---

## Changes Needed

### 1. Add Deposit Hold to Totals Display

The current scaffold doesn't show the security deposit. Add it as a separate line that's clearly NOT part of "total due today."

**In `domain/booking/types.ts`**, add to `BookingTotals`:
```typescript
depositHoldCents: number;  // auth hold amount — NOT charged, just authorized
```

**In `domain/booking/totals.ts`**, accept a `depositHoldCents` input parameter and pass it through. Do NOT add it to `grandTotalCents` — the deposit is a hold, not a charge.

**In ReviewStep and PayStep**, add after the grand total:
```
┌──────────────────────────────────────────────┐
│ Security deposit hold          $2,500        │
│ Authorization only — not charged.            │
│ Released within 48h of return if no damage.  │
└──────────────────────────────────────────────┘
```

Style it differently from the charges (e.g., dashed border, muted colors) to make clear it's separate.

### 2. Add Cancellation Policy Disclosure

**In ReviewStep**, add a collapsible section before "Proceed to payment":

```
Free cancellation
Cancel up to 72 hours before pickup for a full refund.

After the free cancellation window:
• Platform fee (10%): non-refundable
• Protection plan: non-refundable
• Operator rental: per operator's cancellation policy
```

**In PayStep**, add a one-liner above the pay button:
```
Free cancellation up to 72 hours before pickup.
```

### 3. Update Statement Descriptor Language

**Current PayStep text:**
> "Exotiq platform fee and protection plan should pass through Stripe to Exotiq and appear on the customer statement as exotiq.rent."

**Update to (V1 — single charge):**
> "Your card will be charged once by EXOTIQ.RENT for the full booking amount. The operator's share is transferred automatically."

This is because V1 uses a single Stripe Checkout — the renter sees one charge on their statement, not two.

### 4. Remove "Two Charges" Language

Since we're launching with V1 (single checkout), remove any copy that implies the renter will see two separate statement lines. They'll see one line: `EXOTIQ.RENT` for the grand total.

If/when we upgrade to V2 (separate charges), we'll update the copy then.

### 5. Add to Confirmation Screen

**In `ConfirmationScreen.tsx`**, add after the charges breakdown:

```
┌──────────────────────────────────────────────┐
│ 🔒 Security deposit                         │
│ $2,500 authorized on your card               │
│ Released within 48h of return if no damage   │
└──────────────────────────────────────────────┘
```

Also add to the "What happens next" section:
```
04  Security deposit hold is placed on your card after booking confirmation.
```

### 6. Update PublicQuote Type

**In `domain/booking/publicContracts.ts`**, update `PublicQuote`:

```typescript
export type PublicQuote = {
  currency: 'usd';
  rentalDays: number;
  dailyRateCents: number;
  rentalSubtotalCents: number;
  extrasSubtotalCents: number;
  operatorTaxesCents: number;
  operatorTotalCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  protectionDailyRateCents: number;
  protectionTotalCents: number;
  exotiqTotalCents: number;
  grandTotalCents: number;
  depositHoldCents: number;
  cancellationPolicy: {
    freeCancellationHours: 72;
    platformFeeRefundableInWindow: true;
    protectionRefundableInWindow: true;
  };
};
```

This type should match what the backend `renter-quote-booking` edge function returns. When the backend is ready, swap the mock totals calculation for a real API call to this function.

### 7. Wire the Payment Button

When the backend is ready, the "Reserve" / "Continue with Stripe checkout" button should:

1. Call `renter-create-booking` edge function (creates booking + returns Stripe Checkout URL)
2. Redirect the renter to the Stripe Checkout URL
3. On success, Stripe redirects to `/booking/{bookingRef}?status=confirmed`
4. On cancel, Stripe redirects back to the booking page with `?payment=cancelled`

**For now:** Keep the button as a mock/placeholder. The real wiring happens when Lovable deploys `renter-create-booking`.

### 8. Mock Data Update

**In `domain/booking/mockData.ts`**, add deposit amount to the mock operator/vehicle:

```typescript
securityDepositCents: 250000, // $2,500
```

This lets you build and test the deposit display without the backend.

---

## What NOT to Change

- Don't implement Stripe Elements or Payment Element in the renter app. Stripe Checkout handles the payment page — the renter is redirected there.
- Don't store or handle card data. The backend generates a Checkout URL; you just redirect to it.
- Don't calculate broker commission. That's operator-side only, invisible to renters.
- Don't show anything about what the operator pays or earns. Renters only see their own charges.

---

## Sequence: What Depends on What

```
Can do NOW (no backend needed):
  ├── Deposit display in Review/Pay/Confirmation
  ├── Cancellation policy disclosure
  ├── Statement descriptor copy update
  ├── PublicQuote type update
  ├── Mock data with deposit amount
  └── Remove two-charge language

Needs backend (Lovable deploys first):
  ├── Real quote from renter-quote-booking
  ├── Real booking creation from renter-create-booking
  ├── Stripe Checkout redirect
  └── Confirmation from real booking data
```

---

## Reference

- Full payment architecture: `docs/internal/STRIPE_PAYMENT_ARCHITECTURE.md` (in Command Center repo)
- Checkout wireframe (your doc): `docs/drive-exotiq/checkout-payment-flow-handoff.md`
- Integration contracts: `docs/drive-exotiq/exotiq-rent-integration-contract-plan.md`

---

## Summary

Your existing totals math and UI split display are correct. The main additions are:
1. Show the security deposit hold (as a separate non-charge item)
2. Add cancellation policy disclosure (72h free cancellation)
3. Update statement descriptor copy for V1 (single charge, not two)
4. Prepare the `PublicQuote` type for when the backend is ready

Everything else you've built is aligned with the final architecture. Keep going.
