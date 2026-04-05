

# Stripe Connect — Final Bulletproof Implementation Plan

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────────┐
│  FLOW A: SaaS Subscriptions (Exotiq Revenue)                  │
│  Tenant subscribes to Exotiq platform                          │
│  create-checkout-session → check-subscription → customer-portal│
│  Products: price_1Shm* (acct HO7nC3pJiP) ← CORRECT           │
│  check-subscription uses price_1RZX* (acct FGjqTt8mxe) ← BUG │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  FLOW B: Tenant Payments (Connect Express)                     │
│  Tenant's customer pays for vehicle rental                     │
│  Funds go to tenant's Stripe account minus platform fee        │
│  Direct booking: 0% fee                                        │
│  Marketplace (Drive Exotiq OTA): 20% fee                       │
│  NOT BUILT YET                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  FLOW C: Tenant Financial Operations                           │
│  Auth holds, captures, releases, refunds                       │
│  All via connected account's PaymentIntents                    │
│  NOT BUILT YET                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Fix SaaS Subscription (Critical Bug)

**Problem**: `check-subscription` uses `price_1RZX*` IDs from a different Stripe account. `create-checkout-session` uses `price_1Shm*` from the correct account `acct_1S30O7HO7nC3pJiP`. Subscriptions are created correctly but **never verified**.

**Fix**: Rewrite `check-subscription` to match by **product ID** instead of price ID. The active products are:
- `prod_Tf6ZIe5FJJRq4f` — Starter
- `prod_Tf6ZJrXCE8rqBU` — Professional
- `prod_Tf6ZPadpmCqJl2` — Business
- `prod_Tf6rFVSylQOnHt` — Enterprise (name "Exotiq Enterprise")

This future-proofs against price changes and billing interval differences.

**File**: `supabase/functions/check-subscription/index.ts`

---

## Phase 2: Database Migration

### `teams` table — Add Connect columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `stripe_account_id` | text | null | Connect Express account ID (e.g. `acct_xxx`) |
| `stripe_onboarding_complete` | boolean | false | Has finished Express onboarding |
| `stripe_charges_enabled` | boolean | false | Can accept payments (synced via webhook) |
| `stripe_payouts_enabled` | boolean | false | Can receive payouts (synced via webhook) |
| `platform_fee_percent` | numeric(5,2) | 0.00 | Default 0 for direct bookings; overridden per-booking for marketplace |

### `bookings` table — Add source tracking

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `booking_source` | text | 'direct' | `'direct'` (tenant-acquired) or `'marketplace'` (Exotiq OTA) |

### `payments` table — Add hold/refund tracking

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `stripe_charge_id` | text | null | For refund lookups |
| `stripe_refund_id` | text | null | Links to Stripe refund object |
| `hold_status` | text | null | `'authorized'` / `'captured'` / `'released'` / `'expired'` |
| `hold_expires_at` | timestamptz | null | When the auth hold expires |
| `original_amount` | numeric | null | Original hold amount (before partial capture) |
| `refund_amount` | numeric | null | Amount refunded |
| `refund_reason` | text | null | `'duplicate'` / `'fraudulent'` / `'requested_by_customer'` / `'damage_deduction'` |
| `platform_fee` | numeric | null | Exotiq's cut on this payment |

### `payouts` table — Add team scoping

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `team_id` | uuid (FK teams) | null | Which tenant this payout belongs to |

### New table: `stripe_webhook_events`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `stripe_event_id` | text UNIQUE | Idempotency — prevent double-processing |
| `event_type` | text | e.g. `checkout.session.completed` |
| `processed_at` | timestamptz | When we handled it |
| `payload` | jsonb | Full event payload for debugging |

---

## Phase 3: Connect Onboarding (2 Edge Functions)

### `stripe-connect-onboard`
- Authenticated tenant (owner/admin only) calls this
- Creates a Stripe Express account with `type: 'express'`
- Sets `business_type: 'company'`, `capabilities: { card_payments: {requested: true}, transfers: {requested: true} }`
- Stores `stripe_account_id` on the `teams` row
- Generates an Account Link URL (`type: 'account_onboarding'`)
- Returns URL for frontend redirect
- On return, frontend hits `stripe-connect-refresh` if onboarding incomplete

### `stripe-connect-refresh`
- Generates a new Account Link if the previous one expired (they expire in minutes)
- Reads `stripe_account_id` from `teams`, creates new Account Link, returns URL

### Frontend: Settings > Payments
- Replace "Stripe Connect Soon" badge with real onboarding flow
- States: Not Connected → Onboarding In Progress → Active → Restricted
- "Connect Your Stripe Account" button → calls `stripe-connect-onboard` → redirect
- Once connected: show account status, "View Stripe Dashboard" link, disconnect option

---

## Phase 4: Webhook Handler (1 Edge Function — the backbone)

### `stripe-webhook`
- **No JWT verification** (Stripe sends raw POST)
- Validates `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`
- Idempotency: checks `stripe_webhook_events` for duplicate `stripe_event_id` before processing
- Handles these events:

| Event | Action |
|-------|--------|
| `account.updated` | Update `teams.stripe_charges_enabled`, `stripe_payouts_enabled` based on account capabilities |
| `checkout.session.completed` | If `mode: 'payment'`: insert into `payments` table with `payment_status: 'completed'`, update `bookings.payment_status`. If `mode: 'subscription'`: log SaaS subscription activation |
| `payment_intent.succeeded` | Update matching `payments` row status to `completed` |
| `payment_intent.amount_capturable_updated` | Update `payments.hold_status` to `authorized`, record `hold_expires_at` |
| `charge.captured` | Update `payments.hold_status` to `captured` |
| `charge.refunded` | Insert refund record in `payments`, update original payment's `refund_amount` |
| `charge.dispute.created` | Create notification for team members, flag booking |
| `payout.paid` | Insert/update `payouts` table with `team_id` |
| `customer.subscription.updated` | Sync SaaS tier changes |
| `customer.subscription.deleted` | Mark subscription cancelled |

**New secret required**: `STRIPE_WEBHOOK_SECRET`

---

## Phase 5: Tenant Payment Operations (4 Edge Functions)

### `stripe-create-hold`
- Creates PaymentIntent with `capture_method: 'manual'` on connected account
- Uses `Stripe-Account` header with tenant's `stripe_account_id`
- Applies `application_fee_amount` based on `booking_source`:
  - `'direct'` → $0 fee
  - `'marketplace'` → 20% of amount
- Inserts into `payments` with `hold_status: 'authorized'`, `payment_type: 'security_deposit'`
- Hold duration: 7 days default (Stripe limit), some networks allow 31 days

### `stripe-capture-hold`
- Captures a previously authorized PaymentIntent (full or partial)
- Accepts optional `capture_amount` parameter (for partial capture, e.g. $200 of $500 hold)
- Updates `payments.hold_status` to `captured`, records actual captured amount
- Used when: damage found, tenant wants to keep deposit

### `stripe-release-hold`
- Cancels an uncaptured PaymentIntent
- Updates `payments.hold_status` to `released`
- Used when: clean return, no damage, release customer's card hold

### `stripe-create-refund`
- Refunds a captured payment (full or partial)
- Accepts: `payment_intent_id`, `amount` (optional, for partial), `reason` enum
- Creates refund on connected account via `Stripe-Account` header
- Inserts refund record in `payments` table
- Supports multiple partial refunds up to original amount

---

## Phase 6: Refactor Existing Payment Functions

### `create-payment-checkout` (refactor)
- Look up tenant's `stripe_account_id` from `teams` via `team_id`
- Create checkout session **on the connected account** using `stripe_account` param
- Apply `application_fee_amount`:
  - Check `booking_source` on the booking row
  - `'direct'` → 0
  - `'marketplace'` → `Math.round(amount * 100 * 0.20)`
- If tenant has no `stripe_account_id` or `stripe_charges_enabled` is false → return error with clear message

### `stripe-get-balance` (refactor)
- Accept `team_id` from request body
- Look up `stripe_account_id` from `teams`
- Query connected account's balance using `stripe_account` header
- Falls back to local DB estimates if Connect not set up

### `stripe-payment-history` (refactor)
- Accept `team_id` from request body
- Query connected account's charges/payment intents using `stripe_account` header
- Update SDK to `stripe@18.5.0`

### `stripe-connect-dashboard` (new)
- Creates a Stripe Express Dashboard login link
- Tenant can view: payouts, tax docs (1099), financial reports, dispute details
- Returns URL for frontend to open in new tab

---

## Phase 7: Frontend Updates

### PaymentMethodsSection (Settings)
- Replace "Stripe Connect Soon" badge with real onboarding card
- Show: Not Connected / Onboarding / Active / Restricted states
- "Connect Stripe Account" → calls `stripe-connect-onboard`
- "View Stripe Dashboard" → calls `stripe-connect-dashboard`
- Show `stripe_charges_enabled` and `stripe_payouts_enabled` status indicators

### RecordPaymentDialog
- New "Place Authorization Hold" payment type for security deposits
- When `hold_status: 'authorized'` exists on a booking's payments:
  - Show "Capture Hold" button (full or partial amount input)
  - Show "Release Hold" button
- "Issue Refund" button on completed payments (full or partial amount input)
- All actions call corresponding edge functions

### PaymentsSection (Dashboard)
- Balance cards show connected account data when available
- Payment history shows tenant's charges (not platform-wide)
- Payout schedule from connected account
- "View Stripe Dashboard" link

### PaymentTracker
- Security deposit holds show real Stripe status from `payments.hold_status`
- "Release Deposit" → calls `stripe-release-hold`
- "Capture Deposit" → calls `stripe-capture-hold`
- Visual indicators for hold expiry countdown

---

## Capability Matrix

| Capability | Supported | Notes |
|-----------|-----------|-------|
| Accept card payments via Checkout | Yes | On connected account |
| Authorization holds (security deposits) | Yes | `capture_method: 'manual'`, up to 7 days |
| Partial capture | Yes | Capture less than authorized |
| Release holds | Yes | Cancel uncaptured PaymentIntent |
| Full refunds | Yes | Via Refunds API |
| Partial refunds | Yes | Specify amount |
| Multiple partial refunds | Yes | Up to original charge |
| Automatic payouts to tenant bank | Yes | Stripe's schedule |
| Receipt emails to customers | Yes | Automatic via Stripe |
| Dispute notifications | Yes | Via webhook |
| Tax reporting (1099) | Yes | Stripe handles for Express |
| Apple Pay / Google Pay | Yes | Automatic with Checkout |
| Platform fee on marketplace bookings | Yes | 20% `application_fee_amount` |
| Zero fee on direct bookings | Yes | `application_fee_amount: 0` |
| Tenant financial dashboard | Yes | Express Dashboard login link |

### Limitations

| Limitation | Reason |
|-----------|--------|
| Holds > 7 days (most cards) | Card network limit. Must re-authorize after expiry |
| Instant payouts | Requires Stripe verification + eligible bank |
| Full Stripe Dashboard | Express accounts get simplified dashboard only |
| Custom Checkout branding per tenant | Express uses Stripe's hosted page |
| Crypto payments | Not supported via Connect |
| Split payment across multiple tenants | One charge = one connected account |

---

## New Secrets Required

| Secret | Purpose | How to Get |
|--------|---------|-----------|
| `STRIPE_WEBHOOK_SECRET` | Validate webhook signatures | Created when you configure the webhook URL in Stripe Dashboard → Developers → Webhooks |

---

## Implementation Order

1. **Fix `check-subscription`** — use product IDs, fix the broken SaaS verification (30 min)
2. **Database migration** — add all new columns to `teams`, `bookings`, `payments`, `payouts` + new `stripe_webhook_events` table
3. **`stripe-connect-onboard` + `stripe-connect-refresh`** — onboarding flow
4. **`stripe-webhook`** — single handler for all events + `STRIPE_WEBHOOK_SECRET` secret
5. **`stripe-create-hold` / `stripe-capture-hold` / `stripe-release-hold`** — deposit operations
6. **`stripe-create-refund`** — refund operations
7. **Refactor `create-payment-checkout`** — use connected account + marketplace fee logic
8. **Refactor `stripe-get-balance` + `stripe-payment-history`** — query connected account
9. **`stripe-connect-dashboard`** — Express Dashboard login link
10. **Frontend: Settings payment onboarding UI**
11. **Frontend: RecordPaymentDialog hold/capture/release/refund actions**
12. **Frontend: PaymentsSection + PaymentTracker connected account data**

## Files Changed

| File | Change |
|------|--------|
| DB Migration | Add columns to `teams`, `bookings`, `payments`, `payouts` + `stripe_webhook_events` table |
| `supabase/functions/check-subscription/index.ts` | Rewrite to use product IDs |
| `supabase/functions/create-payment-checkout/index.ts` | Add connected account + marketplace fee |
| `supabase/functions/stripe-get-balance/index.ts` | Query connected account, update SDK |
| `supabase/functions/stripe-payment-history/index.ts` | Query connected account, update SDK |
| **NEW** `supabase/functions/stripe-connect-onboard/index.ts` | Express onboarding |
| **NEW** `supabase/functions/stripe-connect-refresh/index.ts` | Refresh expired onboarding links |
| **NEW** `supabase/functions/stripe-webhook/index.ts` | All event handling |
| **NEW** `supabase/functions/stripe-create-hold/index.ts` | Auth hold for deposits |
| **NEW** `supabase/functions/stripe-capture-hold/index.ts` | Capture held funds |
| **NEW** `supabase/functions/stripe-release-hold/index.ts` | Release auth hold |
| **NEW** `supabase/functions/stripe-create-refund/index.ts` | Full/partial refunds |
| **NEW** `supabase/functions/stripe-connect-dashboard/index.ts` | Express Dashboard link |
| `supabase/config.toml` | Add `verify_jwt = false` for webhook + new functions |
| `src/components/settings/PaymentMethodsSection.tsx` | Connect onboarding UI |
| `src/components/dashboard/PaymentsSection.tsx` | Connected account balance/history |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Hold/capture/release/refund |
| `src/components/dashboard/PaymentTracker.tsx` | Real hold status |

