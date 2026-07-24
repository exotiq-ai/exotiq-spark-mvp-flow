# M6 apply plan (Lovable side)

All 6 files are now in hand. Claude owns exotiq-rent; I own everything below.

## Order of operations

### 1. Save the patch record
Copy the 6 uploaded files into `docs/rent/patches/m6a/` and `docs/rent/patches/m6b/` for the audit trail (no functional effect).

### 2. Apply M6a migration verbatim
`supabase/migrations/20260723090000_m6a_payment_foundations.sql` — widens `bookings_status_check` to include `payment_expired`, adds `payment_due_at` / `paid_at` / `payment_stripe_mode`, adds `teams.stripe_test_account_id`, installs `set_payment_due_at` BEFORE UPDATE trigger, installs `expire_overdue_payment_bookings()` service-role sweep.

### 3. Drop `_shared/stripeMode.ts` in place
Copy verbatim to `supabase/functions/_shared/stripeMode.ts`.

### 4. Command Center surface for `payment_expired`
- `src/lib/bookingStatus.ts`: add `payment_expired` → label "Payment window expired", terminal, neutral grey.
- Sweep any `useMarginData` / ledger / payments-list hooks and exclude rows where `payment_stripe_mode = 'test'`. Confirmed hook: `src/hooks/useMarginData.ts`; will also check `usePayments`, `useLedger`-adjacent reads before shipping.

### 5. Test-mode Connect account for Exotiq (team `c1de6533-…`)
One-shot super-admin edge function `admin-create-test-connect` that:
- Calls Stripe (test-mode `sk_test_`) to create an Express account, **USD, US** to match the tenant (README flag #10).
- Writes the returned `acct_…` into `teams.stripe_test_account_id`.
- Returns the onboarding link for me to paste to you.
Deleted after use (single-use utility, not shipped to tenants).

### 6. Secrets
- `STRIPE_SECRET_KEY` → swap to `sk_test_…` for the QA window. **Blast radius:** every already-deployed function (Identity, `stripe-create-hold`, `create-payment-checkout`, tenant Connect onboarding, refunds) will hit Stripe test until we flip back. Since Claude and I are the only ones touching money for the next couple days, I'll proceed with the straight swap unless you say otherwise.
- `RENT_PAYMENT_WEBHOOK_SECRET` → add after you register the test endpoint at `/functions/v1/rent-payment-webhook` in the Stripe test dashboard.

### 7. Apply M6b migration verbatim
`supabase/migrations/20260723120000_m6b_renter_payment.sql`.

### 8. Deploy the three edge functions
- `rent-checkout` — overwrite existing draft with uploaded `index.ts`.
- `rent-payment-webhook` — new, plus `config.toml` block with `verify_jwt = false`.
- `rent-create-booking` — overwrite with uploaded `index-3.ts` (fixes the deposit-in-`total_value` bug).

**One deviation from the uploaded webhook file:** deployed `stripe_webhook_events` column is `stripe_event_id`, not `event_id` (README-2 flag #4 anticipated this). I'll rename that reference in the webhook before deploy; nothing else changes.

### 9. Approval email + T-24h reminder (README-2 step 5)
On `requested → pending_payment`:
- New Lovable Emails template `rent-payment-request` → sends tokened URL `https://book.exotiq.rent/booking/{ref}?t={token}`, subject "Complete your booking — payment link inside".
- Trigger fires from the RPC/edge that flips the status (need to confirm which surface owns the transition — likely `approve-marketplace-booking` or the Command Center action).
- Reminder: pg_cron job every 15 min invoking a small edge function that finds `pending_payment` rows where `now() BETWEEN payment_due_at − interval '24h30m' AND payment_due_at − interval '24h'` and haven't been reminded yet (add `payment_reminder_sent_at bigint` in a small follow-up migration to prevent duplicates — call this out before shipping).

### 10. Backfill inflated `total_value`
One-off SQL migration: for marketplace bookings created ≥ 2026-07-22, non-terminal only, `total_value = total_value − COALESCE(deposit_cents, 0)`. Preview count first via `read_query`, then apply.

### 11. M6a + M6b verification gates
Run every check in both READMEs against Exotiq's test-mode Connect account:
- Trigger clamps (5-day-out vs tomorrow pickup).
- Sweep permission matrix.
- `payment_stripe_mode='test'` absent from margin.
- Full 4242 happy path → 2 PIs, `confirmed`, `paid_at`.
- 0002 decline → stays `pending_payment`.
- 3155 needs-auth → partial-failure path.
- Redelivery → `{received, duplicate}`.
- Manual `expire_overdue_payment_bookings()` → dates released.

## Open confirmations (won't block starting, but flag them now)

1. **`STRIPE_SECRET_KEY` blast radius** — straight swap to test, or would you rather I branch every existing function to a `STRIPE_SECRET_KEY_TEST` var? Straight swap is much less code; the tradeoff is no real Identity / hold / tenant-onboarding runs until we swap back.
2. **Test Connect account currency = USD** to match Exotiq tenant per README flag #10 — confirming.
3. **Approval email in this apply?** README-2 step 5 lists it as a Lovable dependency. I'll build it as part of this apply unless you want it split into M6b.5.
4. **Which surface flips `requested → pending_payment` today?** I'll trace this before wiring the email trigger; if it's client-only (dashboard button hitting the RPC directly), the email has to move server-side into an edge or a DB AFTER UPDATE trigger. Flagging now, will resolve in build mode.

## Not in this apply
- M6c refunds + M6c deposit-hold PM cloning.
- Live-mode flip.
- Marketplace tenant self-onboarding.
