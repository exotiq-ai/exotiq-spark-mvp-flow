
# External audit — final fix plan

Answers logged:
- **#1 webhooks**: sandbox `rent-payment-webhook` and live `stripe-webhook` are separate URLs → Stripe delivers each event to only one endpoint per mode → **#2 race can't happen today**. Skipping the consumer-key migration. Logging as latent: when you add `rent-payment-webhook` in live mode, if `stripe-webhook` (live) is also subscribed to `checkout.session.completed` / `payment_intent.succeeded`, revisit.
- **#5 charges_enabled**: skip the `stripe_test_charges_enabled` column (test-mode only, not worth the extra state).
- **#6 backfill**: set all 17 tenants to 10% now; keep the 10% column default.

## Phase A — Frontend/UI fixes

**A1. `src/lib/bookingEditGuards.ts`**
- `LOCKED_STATUSES` → `['pending_payment','pending_documents','confirmed','active','completed']`
- Removes dead `'in_progress'` entry; adds real `'active'` and `'pending_documents'` states

**A2. `src/components/dashboard/PaymentTracker.tsx`**
- Gate "Collect Deposit" (line ~470) and the sibling "Take Payment" button on `!booking.isMarketplace`
- Marketplace deposit flows go through setup-session → off-session hold, never the Record Payment dialog

## Phase B — Edge functions (mode-aware Stripe routing)

**B1. Update 8 functions to use `teamConnectedAccountId(team, mode)` from `_shared/stripeMode.ts`**
- `stripe-create-hold`, `stripe-create-deposit-setup-session`, `stripe-capture-hold`, `stripe-release-hold`, `stripe-create-refund`, `create-payment-checkout`, `stripe-get-balance`, `stripe-payment-history`
- Each: change `.select("stripe_account_id, ...")` → `.select("stripe_account_id, stripe_test_account_id, ...")`, then resolve via helper
- Unblocks sandbox deposit rehearsal (Phase D)

**B2. `create-payment-checkout` hardening**
- Fetch booking by `booking_id`; resolve `team_id` from the booking (not the caller's first team membership)
- Assert caller's active membership in booking's team
- Hard-refuse when `booking_source = 'marketplace'` (defense-in-depth with A2)
- Non-marketplace direct-charge path continues to accept operator-supplied `amount`

## Phase C — Backend / SQL

**C1. Migration: backfill all tenants + enforce marketplace fee gate**
- `UPDATE teams SET platform_fee_percent = 10.00 WHERE platform_fee_percent = 0.00` (17 rows)
- Add a trigger (mirroring `enforce_deposit_source_on_marketplace_visible`) that blocks `marketplace_visible = true` when `platform_fee_percent <= 0`
- Column default already 10.00 — new tenants inherit
- No changes to `approve_marketplace_request` needed; trigger fires on the UPDATE it performs

## Phase D — Sandbox deposit rehearsal (after B1 deploys)

One end-to-end run on a test marketplace booking:
1. Request card (setup session on connected test account)
2. Save card in Stripe test Checkout
3. Place hold via `stripe-create-hold` — assert PI `amount == resolve_deposit_cents(vehicle_id)`
4. Release hold
5. Report PI id + amount

This is the gate before the live flip — the deposit path must not run for the first time against a real renter's card.

## Not in scope

- **#2 consumer-key migration** — different URLs per mode makes it inapplicable today; will re-check when you deploy live `rent-payment-webhook`
- **`stripe_test_charges_enabled` column** — skipped per your call

## Technical notes

- All Phase A changes are UI-only, no data/schema impact
- Phase B changes are edge-function-only, all functions already deploy on save
- Phase C is one migration (data + trigger); zero downtime
- Phase D is manual verification with a real Stripe test-mode transaction
