# Lovable review + build record — 30-Day Trial & Per-Vehicle Billing

Source handoff: `docs/payments/LOVABLE_HANDOFF_TRIAL_BILLING_2026-09-14.md`
Scope: app.exotiq.ai only. The exotiq.ai marketing/pricing page stays with Gregory.
Status: built and deployed (WP-1 through WP-7). WP-8 (Stripe test-clock run) is the only open item.

---

## 1. Corrections to the handoff (facts, not opinions)

1. **"trial_end IS NULL means grandfathered" was false.** `teams.trial_start` / `trial_end` carried
   `now()` / `now() + 14 days` defaults, so nearly every team had trial dates and the rule would have
   grandfathered almost nobody. Implemented instead: grandfather where there is no Stripe
   subscription and `created_at < 2026-09-15T00:00:00Z` (constant `BILLING_CUTOVER_ISO`), plus all
   demo accounts. The trial-date defaults were dropped; those columns are now written only by Stripe
   webhooks.
2. **There is no `expenses` table** — expenses live in `vehicle_expenses`. Real table names used
   throughout.
3. **The read-only lock cannot be done with table rules alone.** `create_marketplace_booking` is
   SECURITY DEFINER and the webhooks run as service role, so both bypass RLS. Implemented in both
   places: RLS on bookings/payments now requires `team_can_transact(team_id)`, and
   `is_marketplace_team()` now also requires billing in good standing, which gates the marketplace
   RPC path.
4. **`docs/clickwrap-acceptance-spec.md` does not exist in the repo.** The existing mechanism was
   reused: `record-terms-acceptance`, `legal_document_versions`, `src/lib/legal/versions.ts`.
5. **The webhook did not resolve teams by team id** — subscription events were matched by Stripe
   customer email. That was a replacement, not an extension. New resolution order:
   `subscription.metadata.team_id` → `teams.stripe_subscription_id` → `teams.stripe_customer_id` →
   customer metadata → customer email via `profiles`. Backfill ran before the new handlers went live.

Also worth knowing: `teams` has `support_email`, not `contact_email`; tier bounds were duplicated in
four places and now come from one definition per side (`_shared/billing.ts` on the server,
`useBillingStatus.ts` in the app).

## 2. Decisions taken (Gregory approved 2026-09-15)

- **Signup order (item 6).** Because we pre-load the fleet before the call, the wizard is now
  business info → activate with card → everything else, and the activate step shows the real
  pre-loaded vehicle count. The `pending_activation` lock blocks bookings, payments and
  renter-facing actions but never blocks loading fleet, locations or business info.
  Two new super-admin actions per tenant: **Restart setup** and **Start / stop demo**
  (`super-admin-tenant-lifecycle`, audit-logged to `role_audit_log`).
- **50-vehicle cap (item 7).** Cap kept — no automatic Enterprise billing — but over-cap accounts
  are now a standing list in the command center ("Over the 50-vehicle cap"), not a one-time task.
- **Rate lock (item 8).** Wording changed rather than storing activation price ids per team.
  Terms §5.5 now reads: *"The per-vehicle rate for your tier at the time you activated your
  subscription continues to apply for the duration of your continuous subscription. If your active
  vehicle count later moves you to a different tier, the rate then published for that tier applies."*
  Same promise, no per-team price machinery.
- **Recount safety (item 9).** `invoice.upcoming` stays the primary recount hook; a nightly
  reconciliation (`billing-reconcile`, pg_cron `billing-reconcile-nightly`) compares billed quantity
  to live active-vehicle count for every live subscription, corrects drift, and surfaces mismatches
  in the command center. It is also the home for the annual true-up.

## 3. What shipped

**Database**
- `teams`: `stripe_customer_id`, `stripe_subscription_id`, `billing_status`, `billing_interval`,
  `billed_tier`, `billed_quantity`, `current_period_end`, `cancel_at_period_end`, `activated_at`,
  `annual_offer_shown_at`, `annual_offer_dismissed_at`. Trial-date defaults dropped.
- `billing_email_log` with dedupe on `(team_id, email_type, stripe_event_id)`.
- Helpers: `team_active_vehicle_count`, `billing_tier_for_count`, `team_is_writable` (setup writes
  allowed during `pending_activation`), `team_can_transact` (bookings/payments blocked during
  `pending_activation`, `unpaid`, `canceled`).
- `get_super_admin_subscription_health()` — super-admin-only report: billed vs live vehicle count,
  status, trial/renewal dates, mismatch and over-cap flags.
- Terms `2026-09-16` published in `legal_document_versions`.

**Edge functions**
- `create-checkout-session` — server-derived tier/quantity, 30-day trial, card always required,
  trial eligibility decided server-side, enterprise fleets returned as a sales referral (409).
- `stripe-webhook` — `customer.subscription.created/updated/deleted`, `trial_will_end`,
  `invoice.upcoming`, `invoice.paid`, `invoice.payment_failed`, team-aware, idempotent.
- `billing-reconcile` — nightly + on-demand, `?dry_run=true` supported.
- `super-admin-tenant-lifecycle` — restart setup, start/stop demo, require activation.
- `_shared/billing.ts` (single source of truth: 30 days, tier bounds, live price ids, five email
  templates) and `_shared/billingSync.ts`.

**App**
- `useBillingStatus` + rewritten `useTrialStatus`, `TrialBanner`, `SubscriptionSection`,
  `ActivateSubscriptionDialog`, `OnboardingActivateCard` in the setup wizard.
- Command center: `SubscriptionHealthPanel` (trial health, payment trouble, count mismatch,
  over-cap list, "Check now") and `TenantLifecycleSection` in the tenant drawer.
- Trial copy corrected everywhere from "14-day, no credit card" to "30-day, card required, nothing
  charged for 30 days", shipping in the same release as the Terms bump.

## 4. Open items

- **WP-8 Stripe test-clock acceptance run (13 cases)** — needs the Stripe dashboard; see
  `docs/payments/BILLING_ACCEPTANCE_CHECKLIST.md`.
- **Platform webhook subscriptions** — Gregory owns adding the new events to the platform endpoint
  in the Stripe dashboard: `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.upcoming`,
  `invoice.paid`, `invoice.payment_failed`. Until then the nightly reconciliation is the only thing
  keeping quantities aligned.
- **Item 5 of the doc's rollout** (pricing page on exotiq.ai) — Gregory's.
