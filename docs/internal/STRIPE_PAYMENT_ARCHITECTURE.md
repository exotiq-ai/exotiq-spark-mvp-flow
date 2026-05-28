# Stripe Payment Architecture — Exotiq Platform

**Document Type:** Technical Architecture Specification  
**Last Updated:** May 28, 2026  
**Status:** APPROVED — Ready for implementation  
**Audience:** Avi (Drive Exotiq frontend), Lovable (Command Center backend), Exotiq Engineering

---

## 1. Executive Summary

Exotiq operates a two-sided marketplace connecting exotic car renters with fleet operators. The payment system uses **Stripe Connect Express** with a split-charge model:

- **Renter pays two separate charges** on a single booking
- **Operator receives rental revenue** minus broker commission (when applicable)
- **Exotiq receives platform fee + protection plan** as direct revenue

This document is the single source of truth for how money moves through the platform.

---

## 2. Fee Structure

### 2.1 Renter-Facing Fees (Always Charged)

| Fee | Amount | Charged By | Statement Descriptor |
|-----|--------|-----------|---------------------|
| Platform fee | 10% of operator total (rental + extras + operator taxes) | Exotiq platform account | `EXOTIQ.RENT` |
| Protection plan | Per-day rate (currently $89/day placeholder) | Exotiq platform account | `EXOTIQ.RENT` |
| Rental + extras + taxes | Operator's published rates | Tenant connected account | Operator's business name |
| Security deposit | Operator-set amount (auth hold, not a charge) | Tenant connected account | Operator's business name |

### 2.2 Operator-Facing Fees (Conditional)

| Fee | Amount | When Applied | How Collected |
|-----|--------|-------------|---------------|
| Broker commission | 10% of **rental subtotal only** (excludes extras, taxes, delivery, deposits) | Only when Exotiq provides the lead (marketplace booking) | `application_fee_amount` on connected account charge |

### 2.3 Fee Base Definitions

```
RENTER PLATFORM FEE BASE:
  = rentalSubtotal + extrasSubtotal + operatorTaxes
  = operatorTotal
  Excludes: security deposit, protection plan

OPERATOR BROKER COMMISSION BASE:
  = rentalSubtotal ONLY (dailyRate × days)
  Excludes: extras, taxes, delivery, gas, mileage, deposits, discounts
```

### 2.4 Launch Phases

| Phase | Renter Pays | Operator Pays |
|-------|-------------|---------------|
| Phase 1 (Launch) | 10% platform fee + protection | 0% (broker commission disabled) |
| Phase 2 (Marketplace traction) | 10% platform fee + protection | 10% broker commission on marketplace bookings |

The `teams.platform_fee_percent` column controls the broker commission rate. Default: 0 (Phase 1). Set to 10 when activating Phase 2 per-team or globally.

---

## 3. Stripe Charge Architecture

### 3.1 Overview: Two Charges Per Booking

```
┌─────────────────────────────────────────────────────────────┐
│                    RENTER'S CARD                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Charge 1: EXOTIQ PLATFORM (Direct)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amount: platformFee + protectionTotal                │   │
│  │ Account: Exotiq's platform Stripe account            │   │
│  │ Descriptor: "EXOTIQ.RENT"                            │   │
│  │ Type: Standard PaymentIntent (immediate capture)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Charge 2: OPERATOR RENTAL (Connected Account)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amount: operatorTotal (rental + extras + tax)        │   │
│  │ Account: Tenant's connected Express account          │   │
│  │ Descriptor: Operator's registered business name      │   │
│  │ application_fee_amount: brokerCommission (if any)    │   │
│  │ Type: Standard PaymentIntent (immediate capture)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Charge 3: SECURITY DEPOSIT HOLD (Connected Account)       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amount: deposit amount (operator-set)                │   │
│  │ Account: Tenant's connected Express account          │   │
│  │ capture_method: "manual" (auth hold, not a charge)   │   │
│  │ application_fee_amount: 0 (never take fee on deposit)│   │
│  │ Expires: 7 days                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Why Separate Charges (Not One With Splits)

1. **Statement descriptor clarity** — Renter sees "EXOTIQ.RENT" for platform fees and operator's name for rental. Cannot achieve this with a single charge.
2. **Dispute isolation** — If renter disputes the operator charge, Exotiq's platform fee charge is unaffected.
3. **Refund independence** — Operator can refund rental without affecting Exotiq's earned platform fee.
4. **Accounting clarity** — Each entity's revenue is on their own Stripe account.
5. **Protection plan separation** — Protection is Exotiq revenue, not an application fee on the operator's charge.

### 3.3 Stripe Implementation Pattern

**Charge 1 (Exotiq platform):**
```
stripe.paymentIntents.create({
  amount: platformFeeCents + protectionTotalCents,
  currency: "usd",
  customer: stripeCustomerId,
  statement_descriptor_suffix: "PLATFORM FEE",
  metadata: {
    booking_id, booking_ref, type: "exotiq_platform_charge",
    platform_fee_cents: platformFeeCents,
    protection_cents: protectionTotalCents,
  }
})
// NO stripeAccount option — charges directly to Exotiq's account
```

**Charge 2 (Operator rental):**
```
stripe.paymentIntents.create({
  amount: operatorTotalCents,
  currency: "usd",
  customer: connectedCustomerId,
  application_fee_amount: brokerCommissionCents, // 0 for Phase 1
  metadata: {
    booking_id, booking_ref, type: "operator_rental_charge",
    booking_source: "marketplace" | "direct",
  }
}, { stripeAccount: operatorStripeAccountId })
```

**Charge 3 (Security deposit hold):**
```
stripe.paymentIntents.create({
  amount: depositAmountCents,
  currency: "usd",
  customer: connectedCustomerId,
  capture_method: "manual",
  metadata: {
    booking_id, booking_ref, type: "security_deposit_hold",
  }
}, { stripeAccount: operatorStripeAccountId })
// NO application_fee_amount on deposits
```

### 3.4 Customer Object Strategy

Two Stripe Customer objects are needed per renter:

1. **Platform customer** — On Exotiq's account. Used for Charge 1.
2. **Connected account customer** — On the operator's account. Used for Charges 2 and 3.

Both reference the same payment method via Stripe's `payment_method` cloning or by collecting payment in a single Checkout Session that creates tokens for both.

**Recommended approach:** Use **Stripe Checkout** in `payment` mode with both line items grouped, then use the resulting payment method to create the connected-account charges server-side. OR use **Payment Element** with a SetupIntent to save the card, then charge both accounts server-side.

### 3.5 Statement Descriptor Configuration

In Stripe Dashboard → Settings → Public details:
- **Statement descriptor:** `EXOTIQ.RENT`
- **Shortened descriptor:** `EXOTIQ.RENT`

Operator's connected accounts will show whatever business name they registered during Express onboarding.

---

## 4. Booking Payment Flow (End-to-End)

### 4.1 Happy Path Sequence

```
1. Renter completes booking flow in Drive Exotiq
2. Renter clicks "Reserve" on PayStep
3. Frontend calls: renter-create-checkout-session (new edge function)
4. Backend:
   a. Creates booking draft (status: pending_payment)
   b. Creates Stripe Checkout Session with all line items
   c. Returns checkout URL
5. Renter completes Stripe Checkout (enters card, 3DS if needed)
6. Stripe fires checkout.session.completed webhook
7. Backend (webhook handler):
   a. Creates Charge 1 (platform fee + protection) on Exotiq account
   b. Creates Charge 2 (operator rental) on connected account
   c. Creates Charge 3 (security deposit hold) on connected account
   d. Updates booking status: pending_payment → confirmed (or pending_documents)
   e. Inserts payment records for each charge
   f. Sends confirmation notification
8. Renter sees confirmation screen
9. Operator sees new booking in Command Center
```

### 4.2 Payment Failure Handling

If any charge fails after the Checkout Session completes:

- **Charge 1 fails (platform):** Do not proceed with Charges 2/3. Mark booking as `payment_failed`. Notify renter.
- **Charge 2 fails (operator rental):** Refund Charge 1 automatically. Do not create Charge 3. Mark as `payment_failed`.
- **Charge 3 fails (deposit hold):** Charge 1 and 2 already succeeded. The booking IS confirmed but deposit hold failed. Notify operator and renter. Operator can decide to proceed without hold or request retry.

### 4.3 Alternative: Single Checkout with Stripe Connect

A simpler launch approach that avoids multi-charge orchestration:

1. Use Stripe Checkout on the **platform account** for the full amount
2. Set `payment_intent_data.application_fee_amount` to cover the operator's portion
3. Transfer the operator's share via Stripe Transfer

**Downside:** Statement shows "EXOTIQ.RENT" for everything (operator's charge won't show their name). This may be acceptable for MVP and can be upgraded to separate charges later.

**Decision needed:** Do we launch with the simpler single-checkout approach (faster to build, one statement descriptor) or the full separate-charges approach (better UX, requires more orchestration)?

---

## 5. Refund & Cancellation Policy

### 5.1 Refund Matrix

| Scenario | Platform Fee (10%) | Protection Plan | Operator Rental | Broker Commission |
|----------|-------------------|-----------------|-----------------|-------------------|
| Renter cancels within free window (48h+ before pickup) | REFUND | REFUND | REFUND | Reversed (if any) |
| Renter cancels outside free window | NON-REFUNDABLE | NON-REFUNDABLE | Per operator policy | Retained |
| Operator cancels | REFUND | REFUND | N/A | Reversed (if any) |
| Exotiq cancels / at fault | Case-by-case | Case-by-case | Case-by-case | Case-by-case |
| Rental returned early | Non-refundable | Non-refundable (retain full term) | Per operator policy | Retained |
| Post-rental dispute | Non-refundable | Non-refundable | Between renter + operator | N/A |
| Chargeback on operator charge | Unaffected (separate charge) | Unaffected | Disputed | N/A |
| Chargeback on Exotiq charge | Disputed (submit evidence) | Disputed | Unaffected | N/A |

### 5.2 Non-Refundable Platform Fee — Legal Basis

The platform fee is earned at booking confirmation. Justification:
- Exotiq provided a marketplace matching service
- The fee is clearly disclosed before payment
- Renter explicitly agrees to terms
- Industry standard for OTAs (Turo, Expedia, Getaround)

**Terms language (for legal review):**
> "The Exotiq.Rent platform fee is a non-refundable service fee charged for facilitating the booking between you and the rental operator. This fee is earned upon booking confirmation and is separate from the operator's rental charges. The platform fee will not be refunded except where the booking is cancelled within the free cancellation window or where the cancellation is caused by Exotiq or the operator."

### 5.3 Protection Plan — Refund Rules

- Refundable: if booking is cancelled within the free cancellation window (before operator confirms)
- Non-refundable: after rental begins, if rental is returned early, or post-rental
- No pro-rating on early returns

### 5.4 Chargeback Defense (Separate Charges Advantage)

Because Exotiq's platform fee is a separate charge on Exotiq's own account:
- Renter disputes against the operator do NOT affect Exotiq's revenue
- If a renter disputes the Exotiq charge specifically, evidence to submit:
  - Booking confirmation receipt
  - Terms acceptance timestamp
  - Proof of service delivery (booking was facilitated)
  - Clear fee disclosure in checkout UI

---

## 6. Data Model Changes Needed

### 6.1 Command Center (app.exotiq.ai) — Lovable Tasks

**New columns on `bookings`:**
```sql
-- Already exists: booking_source (direct, marketplace)
-- Add these:
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  platform_fee_base_cents integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  broker_commission_cents integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  exotiq_platform_charge_id text;  -- pi_xxx for the platform charge
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  protection_tier text;  -- premium | standard | decline
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  protection_total_cents integer;
```

**New columns on `payments`:**
```sql
-- Add to distinguish charge types:
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  charge_type text;  -- 'operator_rental' | 'exotiq_platform' | 'security_deposit'
```

**New table: `protection_products`** (future, placeholder for now):
```sql
CREATE TABLE IF NOT EXISTS protection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  daily_rate_cents integer NOT NULL,
  tier text NOT NULL,  -- premium | standard
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### 6.2 Booking Status Expansion

Add to the booking status enum/check:
```
requested          -- Renter submitted, awaiting operator review
pending_documents  -- Documents needed before payment
pending_payment    -- Awaiting Stripe payment completion
confirmed          -- Paid and operator approved
declined           -- Operator declined the booking
active             -- Rental in progress
completed          -- Rental returned
cancelled          -- Cancelled (by either party)
refunded           -- Fully refunded
```

---

## 7. Edge Functions — New & Modified

### 7.1 New Edge Functions Needed

| Function | Purpose | Called By |
|----------|---------|-----------|
| `renter-create-checkout` | Creates Stripe Checkout for full renter booking (platform + operator + deposit) | Drive Exotiq |
| `renter-quote-booking` | Returns server-side quote with fee breakdown | Drive Exotiq |
| `renter-create-booking-draft` | Creates booking record before payment | Drive Exotiq |
| `public-team-storefront` | Returns public-safe team + vehicle data | Drive Exotiq |
| `public-vehicle-availability` | Returns busy ranges for a vehicle | Drive Exotiq |

### 7.2 Modified Edge Functions

| Function | Change Needed |
|----------|---------------|
| `stripe-webhook` | Handle new event flow: checkout → create platform charge + operator charge + deposit hold |
| `create-payment-checkout` | Update fee from hardcoded 20% → use `teams.platform_fee_percent` (default 0 for Phase 1) |
| `stripe-create-hold` | Remove the 20% fee on deposit holds — deposits should NEVER have broker commission |
| `stripe-connect-dashboard` | Add role check: owner/admin/manager only |

### 7.3 Fee Reconciliation Fix (Critical)

Current `create-payment-checkout` and `stripe-create-hold` both hardcode 20%:
```typescript
// CURRENT (wrong):
platformFee = Math.round(amount * 100 * 0.20);

// CORRECT:
const team = await getTeam(teamId);
const brokerFeeRate = team.platform_fee_percent / 100; // 0 for Phase 1
const brokerCommission = Math.round(rentalSubtotalCents * brokerFeeRate);
// Only on rental subtotal, only for marketplace bookings
```

---

## 8. Drive Exotiq (Avi) — UI Action Items

### 8.1 Payment Screen Updates

The current `PayStep.tsx` and `ReviewStep.tsx` are correctly displaying the split. Minor updates needed:

1. **Add cancellation policy disclosure** before payment button:
   > "Free cancellation up to 48 hours before pickup. Platform fee and protection are non-refundable after the free cancellation window."

2. **Add deposit line** (when applicable):
   - Currently the scaffold says "Security deposits or future authorization holds are not included in the platform-fee base" but doesn't show a deposit amount.
   - Add: "Security deposit hold: $X (authorized, not charged — released after rental)"

3. **Two-charge disclosure** (if using separate charges):
   - "You will see two charges on your statement: one from EXOTIQ.RENT (platform fee + protection) and one from [Operator Name] (rental + extras)."

### 8.2 Totals Model Update

In `domain/booking/totals.ts`, add deposit to the BookingTotals type:
```typescript
export type BookingTotals = {
  // ... existing fields ...
  depositHoldCents: number;      // auth hold amount (not charged)
  brokerCommissionCents: number; // what Exotiq takes from operator (hidden from renter)
};
```

The `grandTotalCents` should remain as `operatorTotal + exotiqTotal` (deposit is NOT included in "total due today" since it's a hold, not a charge).

### 8.3 Confirmation Screen Update

Add deposit hold status to the confirmation:
- "Security deposit: $X authorized (hold on your card — released within 48h of return if no damage)"

### 8.4 Cancellation/Refund Policy Display

Add a collapsible section or link on ReviewStep:
- Free cancellation window
- What's refundable vs. not
- Link to full terms

### 8.5 Service Facade Update

`domain/booking/publicContracts.ts` — the `PublicQuote` type needs:
```typescript
export type PublicQuote = {
  // ... existing fields ...
  depositHoldCents: number;
  cancellationPolicy: {
    freeCancellationDeadlineHours: number;
    platformFeeRefundable: boolean;
    protectionRefundable: boolean;
  };
};
```

---

## 9. Lovable (Command Center) — Backend Action Items

Priority order for implementation:

### P0 — Must Fix Before Any Renter Bookings

1. **Reconcile fee logic:** Change hardcoded 20% → `teams.platform_fee_percent` (default 0)
2. **Remove broker fee from deposit holds:** `stripe-create-hold` should never apply `application_fee_amount`
3. **Add role check to `stripe-connect-dashboard`:** Restrict to owner/admin/manager
4. **Add booking status expansion:** `requested`, `pending_payment`, `declined`, `refunded`

### P1 — Required for Drive Exotiq Launch

5. **New edge function: `renter-quote-booking`** — Server-side quote with fee breakdown
6. **New edge function: `renter-create-booking-draft`** — Creates booking + customer record
7. **New edge function: `renter-create-checkout`** — Orchestrates the multi-charge Stripe flow
8. **Extend `stripe-webhook`** — Handle the new charge orchestration, advance booking status
9. **Add `charge_type` to payments table** — Distinguish platform vs. operator vs. deposit charges
10. **Add public-safe RPCs** — `public_team_by_slug`, `public_vehicle_by_slug`, `public_team_fleet`
11. **Add `vehicles.slug` column** — Required for public URL routing

### P2 — Polish & Hardening

12. **Scheduled hold expiry cleanup** — Mark expired holds in local DB
13. **Remove "Stripe — Coming Soon" from IntegrationsSection**
14. **Add `protection_products` table** (when pricing model is finalized)
15. **Idempotency keys** on PI creation keyed by `booking_id`
16. **Failed payment recovery flow** — Retry UI + webhook handling

---

## 10. Stripe Dashboard Configuration Required

| Setting | Value | Where |
|---------|-------|-------|
| Statement descriptor | `EXOTIQ.RENT` | Settings → Public details |
| Shortened descriptor | `EXOTIQ.RENT` | Settings → Public details |
| Webhook endpoint | `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/stripe-webhook` | Developers → Webhooks |
| Connect events | "Listen to events on Connected accounts" = ON | Developers → Webhooks → endpoint settings |
| Platform type | Express | Connect → Settings |

---

## 11. Example Booking Calculation

**Scenario:** 3-day McLaren 750S rental via Drive Exotiq marketplace

| Line | Calculation | Amount |
|------|------------|--------|
| Daily rate | $1,199/day × 3 days | $3,597.00 |
| Extras (concierge delivery) | flat $150 | $150.00 |
| Extras (additional driver) | $99/day × 3 | $297.00 |
| **Operator subtotal** | | **$4,044.00** |
| Operator taxes (7.8%) | $4,044 × 0.078 | $315.43 |
| **Operator total** | | **$4,359.43** |
| Platform fee (10%) | $4,359.43 × 0.10 | $435.94 |
| Protection (premium) | $89/day × 3 | $267.00 |
| **Exotiq total** | | **$702.94** |
| **Grand total due today** | | **$5,062.37** |
| Security deposit (auth hold) | Operator-set | $2,500.00 |

**What the renter's card statement shows:**
- `EXOTIQ.RENT` — $702.94
- `DESERT EXOTIC RENTALS` — $4,359.43
- `DESERT EXOTIC RENTALS` — $2,500.00 (pending/hold)

**What the operator receives:**
- $4,359.43 minus Stripe processing (≈2.9% + $0.30)
- Phase 1: no broker commission deducted
- Phase 2: minus $359.70 broker commission (10% of $3,597 rental subtotal only)

**What Exotiq receives:**
- $702.94 (platform fee + protection) minus Stripe processing
- Phase 2: + $359.70 broker commission from operator's charge

---

## 12. Open Items (Decisions Not Yet Locked)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Free cancellation window (48h? 72h?) | Product/Legal | TBD |
| 2 | Protection plan final pricing (replacing $89/day placeholder) | Product | In progress (insurance-based pricing coming) |
| 3 | Single checkout vs. separate charges for MVP launch | Engineering | Recommend: single checkout for MVP, separate charges for V2 |
| 4 | Tax treatment of platform fee and protection per state | Legal | TBD |
| 5 | Operator auto-confirm vs. manual approval for marketplace bookings | Product | TBD |
| 6 | Deposit amount — operator-set or vehicle-value-based? | Product | Operator-set (current) |
| 7 | Phase 2 broker commission activation criteria | Business | When marketplace drives measurable volume |

---

## 13. File References

| Document | Path | Audience |
|----------|------|----------|
| This architecture spec | `docs/internal/STRIPE_PAYMENT_ARCHITECTURE.md` | All |
| Internal SOP | `docs/internal/STRIPE_CONNECT_SOP.md` | Exotiq Engineering/Support |
| Customer setup guide | `docs/customer/STRIPE_CONNECT_SETUP_GUIDE.md` | Tenants |
| Renter checkout wireframe | `exotiq-rent/docs/drive-exotiq/checkout-payment-flow-handoff.md` | Avi |
| Integration contracts | `exotiq-rent/docs/drive-exotiq/exotiq-rent-integration-contract-plan.md` | Avi + Lovable |
| Current status | `STRIPE_TODO.md` | Engineering |
