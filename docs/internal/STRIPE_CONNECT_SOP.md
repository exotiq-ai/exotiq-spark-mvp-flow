# Stripe Connect for Tenant Accounts — Internal SOP

**Document Type:** Internal Standard Operating Procedure  
**Last Updated:** May 27, 2026  
**Audience:** Exotiq Engineering, Operations, Support

---

## 1. Architecture Overview

Exotiq uses **Stripe Connect Express** to enable each tenant (rental business) to accept card payments, hold security deposits, and receive payouts — all under Exotiq's platform Stripe account.

### How It Works (Platform ↔ Tenant Model)

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  End Customer   │─────▶│  Exotiq Platform │─────▶│  Tenant (Connected) │
│  (Renter)       │ pays  │  Stripe Account  │ routes│  Express Account    │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
                                  │
                                  ▼
                          Platform fees stay
                          in Exotiq's account
```

- **Platform Account:** Exotiq's master Stripe account. All API calls originate from here.
- **Connected Account:** Each tenant gets a Stripe Express account. They receive payouts to their own bank.
- **Platform Fee:** For marketplace-sourced bookings, Exotiq takes a 20% `application_fee_amount`. Direct bookings: 0%.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Account type | Express | Stripe handles KYC/compliance; tenants manage payouts via Express Dashboard |
| Capabilities | `card_payments` + `transfers` | Needed for charges and receiving payouts |
| Fee model | Conditional 20% on marketplace bookings | `booking_source` field determines fee applicability |
| Capture method | `manual` for security deposits | Enables hold → partial/full capture → release flow |

---

## 2. System Components

### 2.1 Edge Functions (Supabase)

| Function | Purpose | Auth | Role Check |
|----------|---------|------|------------|
| `stripe-connect-onboard` | Creates Express account + returns onboarding link | JWT token | Owner/Admin only |
| `stripe-connect-refresh` | Regenerates onboarding link for incomplete setups | JWT token | Owner/Admin only |
| `stripe-connect-dashboard` | Returns Express Dashboard login link | JWT token | Any team member |
| `create-payment-checkout` | Creates Checkout Session on connected account | JWT token | Any team member |
| `stripe-create-hold` | Creates manual-capture PaymentIntent (security deposit) | JWT token | Any team member |
| `stripe-capture-hold` | Captures full or partial hold amount | JWT token | Any team member |
| `stripe-release-hold` | Cancels/voids a hold (releases funds) | JWT token | Any team member |
| `stripe-create-refund` | Issues full or partial refund on connected account | JWT token | Any team member |
| `stripe-get-balance` | Retrieves connected account balance + payout history | JWT token | Any team member |
| `stripe-payment-history` | Returns payment records (Stripe + local DB) | JWT token | Any team member |
| `stripe-webhook` | Handles all Stripe webhook events | Signature verification | N/A (system) |

### 2.2 Database Schema (teams table — Connect columns)

```sql
stripe_account_id         text          -- Stripe Express account ID (acct_xxx)
stripe_onboarding_complete boolean      -- true when charges + payouts both enabled
stripe_charges_enabled    boolean       -- can process charges
stripe_payouts_enabled    boolean       -- can receive payouts
platform_fee_percent      numeric(5,2)  -- reserved for custom fee overrides
```

### 2.3 Database Schema (payments table — Connect columns)

```sql
stripe_payment_intent_id  text          -- PaymentIntent ID (pi_xxx)
stripe_charge_id          text          -- Charge ID (ch_xxx)
stripe_refund_id          text          -- Refund ID (re_xxx)
hold_status               text          -- pending | authorized | captured | released | expired
hold_expires_at           timestamptz   -- 7-day expiry for manual captures
original_amount           numeric       -- original hold/payment amount
refund_amount             numeric       -- amount refunded
refund_reason             text          -- reason code
platform_fee              numeric       -- fee amount kept by Exotiq
```

### 2.4 Webhook Events Handled

| Event | Action |
|-------|--------|
| `account.updated` | Syncs `charges_enabled`, `payouts_enabled`, `onboarding_complete` to `teams` |
| `checkout.session.completed` | Inserts payment record for booking |
| `payment_intent.succeeded` | Marks payment as completed |
| `payment_intent.amount_capturable_updated` | Sets `hold_status: authorized` + calculates expiry |
| `charge.captured` | Sets `hold_status: captured` |
| `charge.refunded` | Updates refund amounts and status |
| `charge.dispute.created` | Creates in-app notification |
| `payout.paid` | Records payout in `payouts` table |
| `customer.subscription.updated` | Notification (SaaS subscription) |
| `customer.subscription.deleted` | Notification (SaaS subscription) |
| `invoice.payment_failed` | Notification (SaaS subscription) |

### 2.5 UI Components

| Component | Location | Function |
|-----------|----------|----------|
| `PaymentMethodsSection` | Settings → Payments tab | Connect onboarding, status display, dashboard access |
| `PaymentTracker` | Dashboard | Hold capture/release, refunds |
| `RecordPaymentDialog` | Booking actions | Initiates Checkout Session via `create-payment-checkout` |
| `PaymentsSection` | Dashboard | Balance display, payout history |

---

## 3. Tenant Onboarding Flow

### Sequence

1. **Tenant clicks "Connect Stripe Account"** in Settings → Payments
2. Frontend calls `stripe-connect-onboard` edge function
3. Function checks user is owner/admin on their team
4. If no `stripe_account_id` exists: creates Express account via `stripe.accounts.create()`
5. Stores `stripe_account_id` on the `teams` record
6. Generates `accountLink` (onboarding URL) and returns it
7. Frontend opens the URL in a new tab → tenant completes Stripe KYC
8. On completion, Stripe fires `account.updated` webhook
9. Webhook handler checks `charges_enabled` + `payouts_enabled` → updates team record
10. Tenant returns to Exotiq → Settings shows "Active" status

### Refresh Flow (Incomplete Onboarding)

If the tenant abandons onboarding midway:
- Settings shows "Onboarding" status with "Continue Setup" button
- Calls `stripe-connect-refresh` → generates fresh `accountLink` for the existing account
- Tenant resumes where they left off

### Express Dashboard Access

Once onboarded, tenants can access their Stripe Express Dashboard:
- Click "View Stripe Dashboard" in Settings → Payments
- Calls `stripe-connect-dashboard` → returns login link via `stripe.accounts.createLoginLink()`
- Opens in new tab → tenant sees balance, payouts, tax docs

---

## 4. Payment Processing Flow

### Standard Payment (Checkout Session)

1. Staff clicks "Record Payment" on a booking
2. `RecordPaymentDialog` calls `create-payment-checkout` with amount, booking ID, customer info
3. Edge function:
   - Verifies team has `stripe_charges_enabled = true`
   - Checks `booking_source` — if `marketplace`, adds 20% `application_fee_amount`
   - Creates or finds Stripe Customer on the connected account
   - Creates Checkout Session with `stripeAccount` option
4. Returns Checkout URL → customer pays
5. `checkout.session.completed` webhook → inserts payment record
6. `payment_intent.succeeded` webhook → marks completed

### Security Deposit Hold

1. `stripe-create-hold` creates PaymentIntent with `capture_method: 'manual'`
2. Customer confirms payment (client-side, or via Checkout)
3. `payment_intent.amount_capturable_updated` webhook → `hold_status: authorized`
4. Hold is valid for **7 days** (Stripe's authorization window)
5. Staff can:
   - **Capture full**: `stripe-capture-hold` with no amount → captures entire hold
   - **Capture partial**: `stripe-capture-hold` with `capture_amount` → partial charge, remainder released
   - **Release**: `stripe-release-hold` → cancels PaymentIntent, releases all funds

### Refunds

1. Staff clicks "Refund" on a completed payment
2. `stripe-create-refund` called with `payment_intent_id`, optional `amount`, optional `reason`
3. Valid reasons: `duplicate`, `fraudulent`, `requested_by_customer`, `damage_deduction`
4. `charge.refunded` webhook updates payment record with refund amount/status

---

## 5. Fee Structure

| Booking Source | Platform Fee | Where Fee Goes |
|---------------|-------------|----------------|
| `direct` | 0% | Tenant keeps 100% (minus Stripe processing) |
| `marketplace` | 20% | Exotiq platform account |

The fee is set via `application_fee_amount` on the PaymentIntent or Checkout Session. Stripe automatically splits the funds.

**Stripe processing fees** (typically 2.9% + 30¢) are deducted from the connected account's share, not from the platform fee.

---

## 6. Environment & Secrets

| Secret | Location | Used By |
|--------|----------|---------|
| `STRIPE_SECRET_KEY` | Supabase Edge Function secrets | All Stripe functions |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Function secrets | `stripe-webhook` only |

### Stripe Dashboard Configuration Required

- **Webhook endpoint:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/stripe-webhook`
- **Connect events enabled:** "Listen to events on Connected accounts" must be ON
- **Platform type:** Express
- **Country availability:** US (expand in Stripe Dashboard as needed)

---

## 7. Testing Procedures

### Sandbox Testing

All testing uses Stripe test mode keys. Test card numbers:
- `4242 4242 4242 4242` — Succeeds
- `4000 0000 0000 0002` — Declines
- `4000 0000 0000 3220` — 3D Secure required

### Test Scenarios

| Scenario | How to Test | Expected Result |
|----------|-------------|-----------------|
| Connect onboarding | Click "Connect Stripe Account" in Settings | Redirects to Stripe Express onboarding form |
| Payment collection | Record payment → complete checkout | Payment appears in PaymentTracker as "completed" |
| Security deposit hold | Create hold → verify in Stripe Dashboard | Hold shows as "authorized" with 7-day window |
| Partial capture | Capture less than full hold amount | Remaining is released, payment shows partial amount |
| Full release | Release hold before capture | Hold cancelled, funds returned |
| Refund | Refund a completed payment | Refund amount shown, status "refunded" or "partially_refunded" |
| Marketplace fee | Create booking with `booking_source: 'marketplace'` → pay | 20% fee visible in platform account |
| Webhook sync | Complete onboarding → check team record | `stripe_charges_enabled = true` after webhook fires |

---

## 8. Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| "Stripe account is not yet enabled for charges" | Onboarding incomplete or account restricted | Tenant must complete onboarding via "Continue Setup" |
| "No Stripe account connected" | Team has no `stripe_account_id` | Tenant must initiate onboarding first |
| Hold expired | 7 days passed without capture | Cannot capture; must create new hold |
| Webhook events not processing | Secret mismatch or endpoint misconfigured | Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard signing secret |
| Duplicate webhook delivery | Network retry from Stripe | Handled by idempotency check (`stripe_webhook_events` table) |

### Monitoring

- Edge function logs: Supabase Dashboard → Edge Functions → Logs
- Webhook events: Query `stripe_webhook_events` table for event history
- Stripe Dashboard: Events & webhooks section shows delivery status

---

## 9. Security Considerations

- **All edge functions use service role key** — authenticated users are verified via JWT token extraction
- **Role-based access:** Onboarding/refresh restricted to owner/admin; dashboard/payments available to all active team members
- **Webhook signature verification:** Every webhook call is verified with `stripe.webhooks.constructEventAsync()`
- **Idempotency:** Duplicate webhook events are detected and skipped via `stripe_webhook_events` table
- **No Stripe keys in client code:** All Stripe API calls happen server-side in edge functions
- **CORS headers:** Set to `*` (appropriate for Supabase edge functions behind auth)

---

## 10. Known Gaps & Future Work

1. **`stripe-create-hold` has no frontend caller** — The edge function is deployed but no UI button invokes it directly. Holds are currently created via the backend but the PaymentTracker UI handles capture/release of existing holds.

2. **`STRIPE_TODO.md` is partially stale** — Many items listed as TODO are actually implemented. Should be updated to reflect current state.

3. **IntegrationsSection shows Stripe as "coming soon"** — This is in the general integrations list (`SettingsLayout → Integrations` tab) even though the real Connect flow is live in the Payments tab.

4. **No automated hold expiry handling** — When a 7-day hold expires, Stripe auto-releases it, but the local `hold_status` may remain "authorized" until the next webhook or manual refresh. Consider a scheduled function to clean up expired holds.

5. **`platform_fee_percent` column is unused** — The migration added this column but fee logic is hardcoded to 20% in the edge functions. Could be made configurable per-team.

6. **No test mode indicator** — The UI doesn't distinguish between test mode and live mode connected accounts.

7. **`stripe-connect-dashboard` doesn't check role** — Unlike onboarding/refresh (owner/admin only), the dashboard link function allows any active team member to access it. This may be intentional but should be documented as a policy decision.

8. **Overage price IDs are empty** — `STRIPE_OVERAGE_PRICES` in `PricingData.ts` has empty strings for professional/business/enterprise tiers.
