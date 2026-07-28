
# Exit Exotiq from the deposit flow

Renter now settles the damage deposit directly with the operator at pickup. Exotiq still collects rental + booking fee + protection at booking — unchanged. Deposit fields stay in the schema but become operator-only reference data.

## Phase A — Quote migration (do first, atomically)

Single migration that supersedes `public_vehicle_quote` from `20260725151456`:

- Keep the return signature identical, including `deposit_cents bigint`.
- Compute `deposit_cents` as `0` (constant) in the SELECT.
- Compute `operator_total_cents = daily_rate_cents * rental_days` (no deposit).
- Compute `grand_total_cents = operator_total_cents + platform_fee_cents + protection_total_cents` (no deposit).
- Preserve every other column, grants (`anon, authenticated`), and behavior.

Verification query (must return `deposit_cents = 0`, `grand_total = rental + fee + protection`, no $10k):

```text
SELECT deposit_cents, operator_total_cents, grand_total_cents
  FROM public_vehicle_quote('exotiq','2023-bugatti-chiron-sport',
    (now()+interval '30 days')::date,(now()+interval '33 days')::date,
    '{"protection":"premium"}'::jsonb);
```

This ordering is safe: renter-side adapters subtract `deposit_cents` from totals; with `deposit_cents=0` the subtraction is a no-op, and totals don't inflate.

## Phase B — Remove renter-facing deposit surfaces

1. **DepositPanel** (`src/components/dialogs/DepositPanel.tsx`) — remove the "Request deposit card" button that calls `stripe-create-deposit-setup-session`. Keep the optional hold/capture/release controls (operators may use them on their own Stripe account); relabel the panel to make it clear this is an optional operator tool, not an Exotiq-mediated flow. Update copy referencing "we email the renter".
2. **Edge function `stripe-create-deposit-setup-session`** — replace body with an immediate `410 Gone` returning `{ error: "deposit_flow_removed", see: "2026-07-28 decision" }`. Leave the file in place (do not delete deployed function) with a header comment linking this decision.
3. **Email template `depositCardRequested`** (`supabase/functions/send-renter-email/templates.ts`) — delete the template and any `sendRenterEmail({ templateName: "depositCardRequested" ... })` call sites.
4. **`receiptConfirmed` template** — remove the deposit sentence at line ~373 ("...will email you a secure link about 72 hours before pickup..."). Nothing replaces it.
5. **T-72h scheduler sweep** — remove the deposit-request branch from `rent-payment-scheduler` permanently (payment-expiry and 24h-reminder branches stay). If a `cron.unschedule(...)` is needed for a dedicated deposit job, include it in Phase A migration.
6. **Stop writing** `bookings.deposit_card_requested_at` and `bookings.operator_stripe_customer_id` anywhere in the codebase. Leave the columns in place. Grep to confirm no remaining writers.

## Phase C — Repurpose deposit fields as operator reference

Kept and relabeled Command-Center-only:

- `resolve_deposit_cents(vehicle_id)` RPC, `teams.default_deposit_cents`, `vehicles.deposit_override_cents`.
- `TeamSettingsSection.tsx` "Security deposit" subsection — relabel to: **"Deposit you collect at pickup (reference only — Exotiq does not collect this)"**. Remove the `deposit_source_confirmed_at` write on save.
- `RateTiersPanel.tsx` "Deposit Hold" column — relabel header to **"Deposit at pickup (operator reference)"** with matching helper copy.
- `DepositPanel.tsx` (kept parts) — update header/blurb to say the hold is optional and runs on the operator's own Stripe account.

## Phase D — Swap marketplace-readiness gate to platform fee

Current gate keys off `deposit_source_confirmed_at`; that no longer matches Exotiq's money flow. Replace it with an **explicitly-chosen** platform-fee confirmation, mirroring the same "default doesn't satisfy the gate" pattern.

Migration:

- `ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS platform_fee_confirmed_at timestamptz;`
- Backfill `platform_fee_confirmed_at = now()` for teams already `marketplace_visible = true` (so we don't break the one live tenant).
- Replace `enforce_deposit_source_on_marketplace_visible` trigger logic on `teams` and `vehicles` to check `platform_fee_confirmed_at IS NOT NULL AND platform_fee_percent > 0` instead of `deposit_source_confirmed_at`. Keep the existing `20260727213240` `> 0` check as a belt.
- Keep existing 10% default and backfill — that migration already ran.

UI:

- `MarketplaceReadinessPanel.tsx` — read `platform_fee_confirmed_at` + `platform_fee_percent` instead of `deposit_source_confirmed_at`; show "Platform fee confirmed" row; add an admin action "Confirm platform fee" that stamps `platform_fee_confirmed_at = now()` (only enabled when `platform_fee_percent > 0`). Remove deposit-source row entirely.
- Add a "Platform fee" input to Super Admin (or team settings, admin-only) that writes `platform_fee_percent` and clears `platform_fee_confirmed_at` on change, forcing re-confirmation.

## Phase E — Carry-over items from prior prompt

Still open, unchanged priority:

1. **Item 1 — Stripe webhook endpoint check**: enumerate live vs test webhook endpoints via Stripe API and confirm `rent-payment-webhook` (test) and `stripe-webhook` (live) are the only subscribers for `checkout.session.completed` / `payment_intent.succeeded`. Report findings; no code change unless a duplicate subscription exists.
2. **Item 3 — `bookingEditGuards.LOCKED_STATUSES`**: already updated in prior turn to include `active` and `pending_documents`. Re-verify no regression.
3. **Item 4 — `PaymentTracker.tsx` marketplace guard**: already gated in prior turn. Re-verify.

## Deferred / downgraded

- Sandbox deposit rehearsal — downgraded from launch gate to nice-to-have.
- Extended-authorization (30-day) MCC enrollment with Stripe — cancelled.
- `stripe-create-hold` / `stripe-capture-hold` / `stripe-release-hold` — kept as optional operator tool, no longer a launch dependency.

## Verification checklist

- Quote returns `deposit_cents = 0` for the Chiron example.
- `rent-create-booking` and renter-side `adaptQuote` produce identical `_total_value` as before (delta = 0 because we removed the same amount from both sides).
- No code writes `deposit_card_requested_at` or `operator_stripe_customer_id`.
- `stripe-create-deposit-setup-session` returns 410.
- `receiptConfirmed` renders with no deposit sentence.
- Marketplace toggle refuses to set `marketplace_visible = true` unless `platform_fee_confirmed_at IS NOT NULL AND platform_fee_percent > 0`.
- Editing `platform_fee_percent` clears the confirmation stamp.

## Technical notes

- All work is additive to schema (one new column, one trigger replacement, one view/function replacement). Zero downtime.
- Two migrations total: one for the quote function, one for the trigger swap + `platform_fee_confirmed_at` column + backfill. Split so a failure in the trigger swap doesn't hold up the money-critical quote change.
- Edge-function-only changes deploy on save. No renter-app coordination needed thanks to the `deposit_cents = 0` no-op strategy; the exotiq-rent repo can drop its subtraction on its own schedule.
