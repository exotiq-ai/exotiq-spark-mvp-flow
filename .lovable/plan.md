# M6 webhook secret + test Connect account + verification

## What changed from the previous plan
- Confirmed `rent-payment-webhook` is registered on the **platform account** (Exotiq Inc test account), not as a connected-account webhook.
- Added explicit step to update `RENT_PAYMENT_WEBHOOK_SECRET` with the signing secret you paste.
- Kept the remaining post-apply steps: create test Connect account, backfill `total_value`, run verification gates.

## Plan

### 1. Update `RENT_PAYMENT_WEBHOOK_SECRET`
Use the secure form to set the secret to the Stripe signing secret from the platform-account test webhook endpoint. I will do this immediately after the plan is approved and we switch to build mode.

### 2. Create test-mode Express Connect account for Exotiq team
- Currency: USD, country: US, to match the tenant and README flag #10.
- Store the returned `acct_…` in `teams.stripe_test_account_id`.
- Return the onboarding link for you to complete before any destination transfers can settle.

### 3. Backfill inflated `total_value`
- One-off SQL migration for marketplace bookings created ≥ 2026-07-22: `total_value = total_value − COALESCE(deposit_cents, 0)` for non-terminal rows.
- Preview the affected count first, then apply.

### 4. Run M6 verification gates against Exotiq test mode
- 5-day-out pickup clamp.
- `payment_stripe_mode='test'` excluded from margin/ledger.
- Full 4242 happy path: 2 PIs, `confirmed`, `paid_at`.
- 0002 decline: stays `pending_payment`.
- 3155 needs-auth: partial-failure path.
- Redelivery: `{received, duplicate}`.
- Manual `expire_overdue_payment_bookings()`: dates released.

## Out of scope
- M6c refunds + deposit-hold PM cloning.
- Live-mode key swap.
- Marketplace tenant self-onboarding.