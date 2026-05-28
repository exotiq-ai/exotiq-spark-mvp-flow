# Lovable Handoff — Stripe Connect & Payment Backend Tasks

**Document Type:** Implementation Handoff  
**Date:** May 28, 2026  
**For:** Lovable (Command Center / app.exotiq.ai backend)  
**Context:** Exotiq is launching a renter-facing booking app (Drive Exotiq / exotiq.rent). A separate coding agent (Hermes/Avi) is building that frontend. Lovable is NOT building any UI for the renter-facing platform. Lovable's role is to ensure the Command Center backend (edge functions, database, webhooks) is ready to support both the operator dashboard AND the incoming renter booking flow.

---

## Important: Scope Boundaries

- **Lovable owns:** Command Center UI, Supabase edge functions, database schema, RLS, webhooks
- **Avi/Hermes owns:** Drive Exotiq (exotiq.rent) renter-facing UI — a separate Next.js app
- **Shared:** The Supabase backend (database + edge functions) serves BOTH apps
- **Do NOT build:** Any renter-facing UI, any exotiq.rent pages, any mobile-web booking screens

The renter app will call Supabase edge functions that Lovable creates. Think of it like building an API that a mobile app consumes.

---

## Current State

Stripe Connect for tenant accounts is fully operational:
- Express account onboarding, dashboard access, webhook sync
- Payment processing via Checkout Sessions on connected accounts
- Security deposit holds (manual capture), capture, release, refund
- Balance and payout retrieval

What needs to change: fee logic corrections, a role restriction fix, and new edge functions to support the renter booking flow.

---

## P0 — Fix Now (Quick Fixes)

These are corrections to existing code. Small changes, high importance.

### Task 1: Reconcile fee logic

**File:** `supabase/functions/create-payment-checkout/index.ts`  
**File:** `supabase/functions/stripe-create-hold/index.ts`

**Problem:** Both hardcode `0.20` (20%) as the platform fee. The correct behavior is to use `teams.platform_fee_percent` (which defaults to 0 for Phase 1 launch).

**Change:**
```typescript
// REMOVE this:
platformFee = Math.round(amount * 100 * 0.20);

// REPLACE with:
const feeRate = (team.platform_fee_percent || 0) / 100;
const brokerCommission = isMarketplace ? Math.round(rentalSubtotalCents * feeRate) : 0;
```

**Important:** The broker commission is calculated on RENTAL SUBTOTAL ONLY (daily rate × days). Not on extras, taxes, delivery, deposits, or any other line item.

### Task 2: Remove broker fee from security deposit holds

**File:** `supabase/functions/stripe-create-hold/index.ts`

**Problem:** The function applies a 20% `application_fee_amount` on security deposit holds. Security deposits are refundable holds — they are NOT revenue and should NEVER have a broker commission.

**Change:** Remove the `application_fee_amount` from the PaymentIntent creation for security deposit holds entirely. The `platformFee` variable and the `if (platformFee > 0)` block should be removed from this function.

### Task 3: Add role check to stripe-connect-dashboard

**File:** `supabase/functions/stripe-connect-dashboard/index.ts`

**Problem:** Any active team member can access the Stripe Express Dashboard. Only owner, admin, and manager roles should have access.

**Change:** Update the team_members query to include role filter:
```typescript
const { data: teamMember } = await supabaseClient
  .from("team_members")
  .select("team_id")
  .eq("user_id", user.id)
  .eq("is_active", true)
  .in("role", ["owner", "admin", "manager"])  // ADD THIS LINE
  .limit(1)
  .single();

if (!teamMember) throw new Error("Only team owners, admins, or managers can access the Stripe Dashboard");
```

### Task 4: Remove "Stripe — Coming Soon" from IntegrationsSection

**File:** `src/components/dashboard/settings/IntegrationsSection.tsx`

**Problem:** The integrations list shows Stripe as "coming soon" while the real Connect flow is already live in the Payments tab. This confuses operators.

**Change:** Remove the Stripe entry from the integrations list, or change its text to link operators to Settings → Payments.

---

## P1 — Required for Renter App Launch

These are new edge functions and schema changes needed before Drive Exotiq can process real bookings. The renter app (built by Avi/Hermes) will call these functions.

### Task 5: Add booking status expansion

**Migration needed.** The bookings table currently supports: `pending, confirmed, active, completed, cancelled`. The renter flow needs additional statuses.

```sql
-- Add new valid statuses for marketplace booking lifecycle
-- If using a check constraint, update it. If free-text, just document.
-- New statuses needed:
--   requested        — renter submitted, awaiting operator review
--   pending_payment  — awaiting Stripe payment completion
--   declined         — operator declined the booking
--   refunded         — fully refunded after cancellation
```

Also add a `charge_type` column to payments:
```sql
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS
  charge_type text;  -- 'operator_rental' | 'exotiq_platform' | 'security_deposit'
```

### Task 6: Add vehicles.slug column

The renter app uses URL-friendly slugs for vehicles (e.g., `mclaren-750s-spider`). This column doesn't exist yet.

```sql
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_team_slug ON public.vehicles(team_id, slug);
```

Backfill logic: generate slug from vehicle name (lowercase, hyphenated). Example: "McLaren 750S Spider" → "mclaren-750s-spider".

### Task 7: New edge function — `public-team-storefront`

**Purpose:** Returns public-safe team and vehicle data for the renter app. No auth required (public endpoint).

**Input:** `{ team_slug: string }`

**Returns:**
```typescript
{
  team: {
    slug: string;
    name: string;
    logo_url: string | null;
    city: string | null;
    state: string | null;
    timezone: string | null;
  },
  vehicles: Array<{
    slug: string;
    name: string;
    make: string;
    model: string;
    year: number;
    daily_rate: number;  // dollars
    hero_image_url: string | null;
    min_rental_days: number | null;
  }>
}
```

**Security:** Must NOT expose: VIN, license plate, user_id, stripe_account_id, internal settings. Must filter to marketplace-visible teams and vehicles only.

### Task 8: New edge function — `public-vehicle-availability`

**Purpose:** Returns busy date ranges for a vehicle. No auth required.

**Input:** `{ team_slug: string, vehicle_slug: string, range_start: string, range_end: string }`

**Returns:**
```typescript
{
  busy_ranges: Array<{ start: string; end: string }>;
  min_rental_days: number;
  rental_buffer_minutes: number;
}
```

**Security:** Must NOT expose booking IDs, customer names, payment status, or any other booking details. Only return date ranges that are unavailable.

### Task 9: New edge function — `renter-quote-booking`

**Purpose:** Server-side quote calculation for a renter booking. This is the source of truth for pricing — the frontend should display these numbers, not calculate its own.

**Input:**
```typescript
{
  team_slug: string;
  vehicle_slug: string;
  start_date: string;  // YYYY-MM-DD
  end_date: string;
  extras?: string[];   // IDs of selected extras (future)
  protection_tier: "premium" | "standard" | "decline";
}
```

**Returns:**
```typescript
{
  currency: "usd";
  rental_days: number;
  daily_rate_cents: number;
  rental_subtotal_cents: number;
  extras_subtotal_cents: number;
  operator_taxes_cents: number;
  operator_total_cents: number;
  platform_fee_rate: 0.10;
  platform_fee_cents: number;         // 10% of operator_total
  protection_daily_rate_cents: 8900;  // hardcoded $89/day for now
  protection_total_cents: number;
  exotiq_total_cents: number;         // platform_fee + protection
  grand_total_cents: number;          // operator_total + exotiq_total
  deposit_hold_cents: number;         // operator's security deposit amount
  cancellation_policy: {
    free_cancellation_hours: 72;
    platform_fee_refundable_in_window: true;
    protection_refundable_in_window: true;
  };
}
```

**Logic:**
- Look up team by slug, vehicle by slug
- Use vehicle's `current_rate` (or `daily_rate`) for the daily rate
- Operator tax rate: use team's configured rate or default to 0
- Platform fee: always 10% of operator total (charged to renter by Exotiq)
- Protection: $89/day × rental days (hardcoded for now)
- Deposit: use vehicle's or team's configured security deposit amount
- No broker commission in quote (that's operator-side, invisible to renter)

### Task 10: New edge function — `renter-create-booking`

**Purpose:** Creates a booking draft from the renter app and initiates payment.

**Input:**
```typescript
{
  team_slug: string;
  vehicle_slug: string;
  start_date: string;
  end_date: string;
  pickup_time: string;
  driver: {
    name: string;
    email: string;
    phone: string;
    date_of_birth?: string;
  };
  extras?: string[];
  protection_tier: "premium" | "standard" | "decline";
}
```

**Server-side actions:**
1. Re-validate team/vehicle exist and are marketplace-visible
2. Re-check availability (no double-booking)
3. Re-compute quote server-side (never trust frontend math)
4. Create or find customer record (team-scoped)
5. Create booking with `status: 'pending_payment'`, `booking_source: 'marketplace'`
6. Snapshot platform fee onto booking record
7. Create Stripe Checkout Session (V1 approach — see below)
8. Return checkout URL + booking_ref

**Stripe Checkout Session (V1 — single checkout):**
```typescript
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [
    {
      price_data: {
        currency: "usd",
        product_data: { name: `Rental: ${vehicle.name} (${days} days)` },
        unit_amount: operatorTotalCents,
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        product_data: { name: "Exotiq Platform Fee (10%)" },
        unit_amount: platformFeeCents,
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        product_data: { name: `Exotiq Protection (${protectionTier})` },
        unit_amount: protectionTotalCents,
      },
      quantity: 1,
    },
  ],
  payment_intent_data: {
    metadata: {
      booking_id: booking.id,
      booking_ref: booking.booking_ref,
      team_id: team.id,
      type: "renter_marketplace_booking",
      operator_total_cents: String(operatorTotalCents),
      platform_fee_cents: String(platformFeeCents),
      protection_cents: String(protectionTotalCents),
    },
    transfer_data: {
      destination: team.stripe_account_id,
    },
    application_fee_amount: platformFeeCents + protectionTotalCents,
    // Exotiq keeps the platform fee + protection; operator gets the rest
  },
  success_url: `https://exotiq.rent/booking/${booking.booking_ref}?status=confirmed`,
  cancel_url: `https://exotiq.rent/${team.slug}/${vehicle.slug}/book?payment=cancelled`,
  metadata: {
    booking_id: booking.id,
    booking_ref: booking.booking_ref,
  },
});
```

**Note on V1 approach:** In this model, the FULL amount goes through Exotiq's platform account, and Stripe automatically transfers `operatorTotalCents` to the connected account (full amount minus `application_fee_amount`). The renter's statement shows "EXOTIQ.RENT" for the full charge. This is acceptable for MVP.

**Returns:**
```typescript
{
  checkout_url: string;
  booking_ref: string;
}
```

### Task 11: Extend stripe-webhook for renter bookings

**File:** `supabase/functions/stripe-webhook/index.ts`

When a `checkout.session.completed` event fires with `metadata.type === "renter_marketplace_booking"`:

1. Update booking status: `pending_payment` → `confirmed` (or `requested` if operator approval required)
2. Insert payment record with `charge_type: 'exotiq_platform'` for the platform fee + protection portion
3. Insert payment record with `charge_type: 'operator_rental'` for the operator portion
4. After successful payment, create the security deposit hold on the connected account:
   ```typescript
   const depositPI = await stripe.paymentIntents.create({
     amount: depositHoldCents,
     currency: "usd",
     capture_method: "manual",
     customer: connectedCustomerId,
     metadata: { booking_id, type: "security_deposit_hold" },
   }, { stripeAccount: team.stripe_account_id });
   ```
5. Insert payment record for the deposit hold with `charge_type: 'security_deposit'`, `hold_status: 'pending'`
6. Send notification to operator (new marketplace booking received)
7. Send confirmation notification to renter (via email if available)

### Task 12: Security deposit hold from Command Center

**Problem:** The `stripe-create-hold` edge function exists but has no frontend caller.

**Change:** In `RecordPaymentDialog.tsx`, when `payment_type` is "security_deposit" and payment method is "stripe", call `stripe-create-hold` instead of `create-payment-checkout`. This generates a Checkout Session link the operator can send to the customer.

Alternatively, wire a "Place Security Deposit Hold" action in the booking detail or PaymentTracker view.

---

## P2 — Polish (After Launch)

These are improvements that can wait until after the first renter bookings are live.

- Scheduled function to clean up expired holds (`hold_status` = "authorized" but `hold_expires_at` < now)
- Add test/live mode indicator in PaymentMethodsSection UI
- Populate `STRIPE_OVERAGE_PRICES` in PricingData.ts
- Add `protection_products` table (when pricing model is finalized beyond $89/day)
- Idempotency keys on PaymentIntent creation keyed by `booking_id`
- V2 upgrade: separate charges instead of single checkout (better statement descriptors)

---

## Stripe Dashboard Setup (Manual)

Exotiq team must configure these in the Stripe Dashboard:

| Setting | Value |
|---------|-------|
| Statement descriptor | `EXOTIQ.RENT` |
| Webhook: "Listen to events on Connected accounts" | ON |
| Connect platform type | Express |

---

## Reference Documents

- Full architecture spec: `docs/internal/STRIPE_PAYMENT_ARCHITECTURE.md`
- Current Connect SOP: `docs/internal/STRIPE_CONNECT_SOP.md`
- Renter app integration contracts: `exotiq-rent/docs/drive-exotiq/exotiq-rent-integration-contract-plan.md`
- Renter app checkout wireframe: `exotiq-rent/docs/drive-exotiq/checkout-payment-flow-handoff.md`

---

## Summary for Lovable

You are NOT building the renter UI. You ARE building the backend plumbing that makes the renter app work. Think of your edge functions as an API that the renter app (and the Command Center) both consume. The renter app is a separate Next.js project maintained by a different team (Avi/Hermes). Your job is to make the Supabase backend serve both clients correctly and securely.

Priority: P0 tasks first (quick fixes), then P1 tasks 5-10 (new functions for renter launch), then P1 tasks 11-12 (webhook extension and hold UI).
