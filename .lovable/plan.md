# Fix the legacy Stripe webhook safely (dedupe first, secret second)

## What I verified

- Both webhooks share one dedupe table (`stripe_webhook_events`) with a **unique constraint on `stripe_event_id` alone** — confirmed in the database. There is no per-consumer key.
- The legacy `stripe-webhook` function writes its dedupe row **before** handling anything, and it has handlers for `checkout.session.completed` and `payment_intent.succeeded` — the same two events the renter payment flow relies on.
- `rent-payment-webhook` treats a unique-violation on that insert as "already processed" and returns early.
- Event history matches the diagnosis: last `account.updated` row is 21 July; the only recent rows (28 July) are the renter payment events. The legacy endpoint has been dead since 21 July.
- The two functions use different signing secrets (`STRIPE_WEBHOOK_SECRET` vs `RENT_PAYMENT_WEBHOOK_SECRET`), so the outage is isolated to the legacy endpoint.

Conclusion: the race Claude describes is real. Restoring the secret before changing the dedupe key would let the legacy endpoint win the race on live payments — rental charged, Exotiq fee leg never fires, no receipt, and the expiry sweep later cancels a paid booking.

## Plan

### Step 1 — Make the dedupe key per-consumer (must ship first)
- Migration: add a `consumer` text column to `stripe_webhook_events` (default `'legacy'`, backfilled), drop the unique constraint on `stripe_event_id`, and add a unique constraint on `(consumer, stripe_event_id)`.
- Update `rent-payment-webhook` to insert/delete with `consumer: 'rent'`, and `stripe-webhook` with `consumer: 'legacy'`. Both keep their existing duplicate-detection and error-rollback behaviour.
- Result: each endpoint dedupes only against its own past deliveries; neither can suppress the other.

### Step 2 — Restore the signing secret
- Once step 1 is deployed, update `STRIPE_WEBHOOK_SECRET` to the current test-mode endpoint secret so the legacy endpoint verifies again. This needs the value from the Stripe dashboard for that endpoint (or a recreate, which rotates it).

### Step 3 — Reduce overlap on the legacy endpoint
- Review the legacy handlers for `checkout.session.completed` and `payment_intent.succeeded`. The checkout handler only acts when `session.metadata.booking_id` is set by the operator-side flow; the PI handler updates `payments.payment_status` by PI id. Add explicit guards so both **ignore marketplace/renter events** (those carrying renter booking metadata), keeping them for the operator hold flows only.
- Keep `payment_intent.succeeded` subscribed on the legacy endpoint — its hold/capture plumbing still needs it — but the guard makes overlap inert regardless of subscription.

### Step 4 — Verify
- Re-check `teams.stripe_charges_enabled` updates by replaying an `account.updated` delivery.
- Run one sandbox booking end-to-end and confirm both legs charge, the receipt sends, and both webhooks record their own dedupe row without either bailing as a duplicate.

## Notes

Nothing renter-facing is broken today; the legacy endpoint only affects operator plumbing (Connect status, payouts, subscriptions, margin fee logging). The visible gap until step 2 is that `teams.stripe_charges_enabled` stops updating — relevant before onboarding operator #2.

Step 2 requires the webhook signing secret from Stripe; I'll ask for it when we get there.
