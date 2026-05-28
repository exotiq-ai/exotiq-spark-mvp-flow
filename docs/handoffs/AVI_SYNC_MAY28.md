# Avi/Hermes Sync — Architecture & Pricing Changes (May 28, 2026)

**From:** Exotiq architecture session (Command Center repo)  
**For:** Avi (Hermes coding agent) — Drive Exotiq / exotiq.rent  
**Date:** May 28, 2026  
**Status:** Decisions locked. Build against these.

---

## TL;DR — What Changed Since Your Last Commit

Your latest commit (`bf6d88d feat: clarify checkout payment split`) is aligned with the architecture decisions below. This doc confirms what's locked, what changed in the Command Center repo since then, and what you need to know going forward.

---

## 1. Repos & Branches to Pull

### Command Center (app.exotiq.ai)
- **Repo:** `https://github.com/exotiq-ai/exotiq-spark-mvp-flow`
- **Branch:** `cursor/stripe-connect-docs-3a8a` (PR #5 — open, not yet merged to main)
- **Key new files:**
  - `docs/handoffs/AVI_DRIVE_EXOTIQ_HANDOFF.md` — YOUR specific action items
  - `docs/internal/STRIPE_PAYMENT_ARCHITECTURE.md` — Full payment spec (read this)
  - `docs/handoffs/LOVABLE_STRIPE_HANDOFF.md` — What Lovable is building (backend you'll consume)
  - `docs/handoffs/LOVABLE_PRICING_RESTRUCTURE.md` — SaaS pricing change (affects tenant billing, not renter payments)
  - `STRIPE_TODO.md` — Updated to reflect actual implementation state (Phases 1-5 complete)

### Drive Exotiq (exotiq.rent)
- **Repo:** `https://github.com/exotiq-ai/exotiq-rent`
- **Branch:** `feat/drive-exotiq-booking-flow` — your working branch, no changes from us

---

## 2. Architecture Decisions Locked

These are final. Build against them:

### Payment Model (V1 — MVP Launch)

```
SINGLE STRIPE CHECKOUT SESSION
├── Full amount charged to Exotiq's platform account
├── Operator's share transferred via Connect (transfer_data.destination)
├── application_fee_amount = platformFee + protectionTotal (Exotiq keeps this)
└── Statement descriptor: "EXOTIQ.RENT" (single charge)
```

**What this means for your UI:**
- Renter sees ONE charge on their statement: `EXOTIQ.RENT`
- You redirect to a Stripe Checkout URL (returned by the backend)
- You do NOT collect card data in your app
- You do NOT implement Stripe Elements or Payment Element

### Fee Structure

| Line Item | Amount | Who Keeps It |
|-----------|--------|-------------|
| Rental + extras + operator tax | Operator total | Operator (via Connect transfer) |
| Platform fee | 10% of operator total | Exotiq |
| Protection plan | $89/day × rental days | Exotiq |
| Security deposit | Operator-set amount | Auth hold only (released after return) |

**Important:**
- Platform fee base = operator total (rental + extras + tax). Excludes deposit. Excludes protection.
- Broker commission (10% from operator) = Phase 2, NOT at launch. Invisible to renter.
- Security deposit = separate PaymentIntent created server-side AFTER main payment succeeds

### Cancellation Policy

- **72-hour free cancellation** before pickup
- Within window: full refund (platform fee + protection + rental)
- After window: platform fee NON-REFUNDABLE, protection NON-REFUNDABLE, operator rental per their policy
- Post-rental/early return: nothing refundable

---

## 3. What Lovable Is Building (Backend You'll Consume)

These edge functions are being created for you to call:

| Edge Function | What It Does | Your Integration Point |
|---------------|-------------|----------------------|
| `renter-quote-booking` | Server-side quote with fee breakdown | Replace your local `totals.ts` math with this response |
| `renter-create-booking` | Creates booking + returns Stripe Checkout URL | Call on "Reserve" button click |
| `public-team-storefront` | Returns public team + vehicle data | Replace mock data |
| `public-vehicle-availability` | Returns busy date ranges | Wire into date picker |

**These don't exist yet.** Lovable will build them. Until then, keep using your mocks. The contract shapes are defined in your `publicContracts.ts` and in `docs/handoffs/LOVABLE_STRIPE_HANDOFF.md` (Tasks 7-10).

---

## 4. What Changed: Command Center SaaS Pricing

This does NOT affect the renter payment flow, but you should know:

**Old model:** 4 tiers (Starter $79, Professional $399, Business $899, Enterprise $1,799)  
**New model:** 2 tiers + Enterprise
- Pro: $39/vehicle/mo (1-15 vehicles)
- Business: $29/vehicle/mo (16-50 vehicles)
- Enterprise: Custom (51+)

**Why you care:** The `teams` table will have subscription tier data. If you ever need to check whether an operator is on a valid subscription (e.g., to show their storefront), the tier names are now `pro` and `business` instead of `starter`, `professional`, `business`, `enterprise`.

---

## 5. Your Action Items (From the Handoff Doc)

These are things you can do NOW without waiting for Lovable:

### Do Now (No Backend Needed)

1. **Add security deposit display** to ReviewStep and PayStep
   - Show as a separate line, clearly NOT part of "total due today"
   - "Security deposit hold: $X — authorization only, released after return"
   - Style differently (dashed border, muted) to distinguish from charges

2. **Add cancellation policy disclosure** to ReviewStep
   - "Free cancellation up to 72 hours before pickup"
   - Collapsible detail: what's refundable vs. not

3. **Update statement descriptor copy** (V1 = single charge)
   - Change from "two charges on your statement" → "charged once by EXOTIQ.RENT for the full booking amount"

4. **Update `BookingTotals` type** — add `depositHoldCents: number`

5. **Update mock data** — add `securityDepositCents: 250000` to mock operator/vehicle

6. **Update `PublicQuote` type** in `publicContracts.ts`:
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

### Wire Later (When Backend Is Ready)

7. **Replace local totals math** with response from `renter-quote-booking`
8. **Wire "Reserve" button** to call `renter-create-booking` → redirect to returned Checkout URL
9. **Handle return URLs:**
   - Success: `https://exotiq.rent/booking/{bookingRef}?status=confirmed`
   - Cancel: `https://exotiq.rent/{teamSlug}/{vehicleSlug}/book?payment=cancelled`

---

## 6. What's Already Correct in Your Code (Don't Change)

- `domain/booking/totals.ts` — fee math is correct (10% of operatorTotal, excludes deposit)
- `platformFeeRate: 0.10` — correct
- Protection as Exotiq pass-through — correct
- ReviewStep split display (Operator + Exotiq sections) — correct
- PayStep breakdown — correct
- "No raw card data in app state" — correct
- Confirmation screen charge display — correct

---

## 7. Questions Your Docs Flagged (Now Answered)

| Question (from your handoff docs) | Answer |
|-----------------------------------|--------|
| Platform-fee base? | 10% of operatorTotal (rental + extras + tax). Excludes deposit + protection. |
| One charge or two? | V1 = one charge (single Checkout). V2 = separate charges (later). |
| Deposit treatment? | Separate auth hold on connected account. Not revenue. No fee. Released after return. |
| Statement descriptor? | `EXOTIQ.RENT` (configure in Stripe Dashboard). |
| Express or Standard accounts? | Express. Confirmed. |
| Protection = Exotiq revenue? | Yes. Direct revenue, not pass-through to third party. |
| Booking statuses needed? | `requested`, `pending_payment`, `confirmed`, `declined`, `active`, `completed`, `cancelled`, `refunded` |

---

## 8. Sequence Diagram: Renter Payment Flow (Final)

```
Renter (Drive Exotiq)          Backend (Supabase)              Stripe
        │                              │                          │
        │── "Reserve" click ──────────▶│                          │
        │                              │── renter-create-booking ─│
        │                              │   • validate team/vehicle│
        │                              │   • check availability   │
        │                              │   • compute quote        │
        │                              │   • create booking draft │
        │                              │   • create Checkout ─────▶│
        │                              │◀── checkout URL ──────────│
        │◀── redirect to Checkout ─────│                          │
        │                              │                          │
        │────── (renter pays on Stripe Checkout page) ───────────▶│
        │                              │                          │
        │                              │◀── checkout.completed ────│
        │                              │   webhook handler:        │
        │                              │   • update booking status │
        │                              │   • record payments       │
        │                              │   • create deposit hold ─▶│
        │                              │   • notify operator       │
        │                              │                          │
        │◀── redirect to /booking/{ref}?status=confirmed ─────────│
        │                              │                          │
```

---

## 9. File Reference Map

Your code → Backend it will call:

| Your File | Future Backend | Status |
|-----------|---------------|--------|
| `domain/booking/service.ts` → `getBookingStartContext()` | `public-team-storefront` + `public-vehicle-availability` | Lovable will build |
| `domain/booking/totals.ts` | `renter-quote-booking` (server-side source of truth) | Lovable will build |
| `components/drive-exotiq/flow/PayStep.tsx` → "Reserve" button | `renter-create-booking` → Stripe Checkout URL | Lovable will build |
| `app/booking/[bookingId]/page.tsx` | `public-booking-by-ref` | Lovable will build |

---

## 10. Summary

- Your frontend scaffold is architecturally correct — keep building
- Do the 6 "now" tasks above (deposit display, cancellation copy, type updates)
- The backend functions you'll consume don't exist yet — keep using mocks
- When Lovable deploys them, swap your mock service for real API calls
- The payment split you documented in `checkout-payment-flow-handoff.md` is confirmed accurate
- V1 = single Stripe Checkout (simpler), V2 = separate charges (later, better statement descriptors)

You're unblocked. Keep going.
