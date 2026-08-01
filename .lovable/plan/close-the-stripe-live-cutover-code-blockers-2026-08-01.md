# Close the Stripe live-cutover code blockers

Stripe-side objects are green (live prices, portal config, three endpoints, dedupe split preserved). What remains is on our side: two security holes, one undercharge bug, and the missing connected-account webhook path. All four are confirmed by reading the current function code.

## What is actually broken right now

1. **Two admin Stripe functions have no authentication at all.** `admin-stripe-account-link` and `admin-stripe-verify-person` read the JSON body and call Stripe immediately — no bearer token, no super-admin check. With the live key now installed, anyone who knows the URL can mint an onboarding link for any connected account, or push document verification onto any person on any account. This is the highest-severity item.

2. **`stripe-create-refund` is under-gated.** It authenticates the caller but then refunds any `payment_intent_id` the caller passes, on that team's connected account, with no check that the payment intent belongs to a booking on that team and no role restriction. Any active member of any team — including a Viewer — can issue refunds.

3. **`rent-retry-exotiq-leg` undercharges.** It builds the Exotiq leg from `platform_fee_cents + protection_total_cents` only. `rent-payment-webhook` builds the same leg from four components, adding `state_fee_cents + processing_fee_cents`. Every retried leg silently loses the state and processing fees.

4. **No connected-account events are being received.** The live `/stripe-webhook` endpoint is platform-events-only. Connect events (`account.updated`, operator payouts, hold captures) need a second Stripe endpoint on the same URL with "listen on connected accounts" enabled — which means a second signing secret, which the function does not currently accept. Until then, onboarding status depends entirely on `stripe-connect-status` polling.

## The work

### 1. Lock down the two admin functions
Apply the same gate already used by `admin-create-test-connect`: require a bearer token, resolve the user, call the `is_super_admin` RPC, return 401/403 otherwise. Also validate the request body (`account`, `person`, `file_token`) rather than passing it straight through, and drop the `file_identity_document_success` test-token fallback in `admin-stripe-verify-person` — that is a sandbox artifact that must not run against a live account.

### 2. Gate refunds properly
In `stripe-create-refund`:
- Resolve the caller's team membership and role; restrict to Owner/Admin (Manager+ if you prefer — say the word).
- Look up the booking that owns the supplied payment intent (`operator_payment_intent_id` or `exotiq_payment_intent_id`) and reject if its `team_id` does not match the caller's team.
- Reject marketplace bookings, pointing at `rent-refund-booking`, which already walks the two legs and the extension rows. Direct refunds on marketplace payment intents bypass that logic.

### 3. Fix the retry leg
Change the Exotiq amount in `rent-retry-exotiq-leg` to the same four-component sum used by `rent-payment-webhook`, and select the two missing columns. Add a regression test asserting the two functions compute the same total from the same booking row.

### 4. Two-secret support for connected-account events
Accept either signing secret in `stripe-webhook`: try `STRIPE_WEBHOOK_SECRET` first, fall back to a new `STRIPE_CONNECT_WEBHOOK_SECRET` when signature verification fails, and 400 only if both fail. Record events under distinct consumer keys (`legacy` for platform, `legacy_connect` for connected-account deliveries) so the existing `(consumer, stripe_event_id)` dedupe stays intact and a platform event and its connected-account twin do not suppress each other.

Then create the live connected-accounts endpoint pointing at the same `/stripe-webhook` URL with `connect: true` and the account/payout/charge events. Checkout and payment-intent events stay off it — the dedupe split with `rent-payment-webhook` must be preserved.

**I will need you here:** the new endpoint's signing secret is shown once at creation. I can create the endpoint via the Stripe API, but you will have to paste the secret into the secure form as `STRIPE_CONNECT_WEBHOOK_SECRET`.

## Verification before you take real money

- Unauthenticated `curl` against both admin functions returns 401.
- A non-admin member calling `stripe-create-refund` gets 403; a cross-team payment intent gets rejected; a marketplace payment intent is redirected to `rent-refund-booking`.
- Retry-leg total equals webhook-leg total on a seeded booking with non-zero state and processing fees.
- `stripe-connect-status` for Drive Exotiq reports `mode: "live"`, account `acct_1TvnfgQfNJmCrgjR`, charges and payouts enabled.
- Both `/stripe-webhook` endpoints show recent 200s, and `stripe_webhook_events` has rows under both consumer keys with no duplicate-key errors.

## Not in this plan

Live smoke tests with real money (subscription checkout, one marketplace booking end to end, refund) stay yours to run through the UI, per the runbook. I will drive verification of the results.

## Technical notes

Files changed: `supabase/functions/admin-stripe-account-link/index.ts`, `admin-stripe-verify-person/index.ts`, `stripe-create-refund/index.ts`, `rent-retry-exotiq-leg/index.ts`, `stripe-webhook/index.ts`, plus a new test. New secret: `STRIPE_CONNECT_WEBHOOK_SECRET`. No database migration required. No change to the four live price IDs — the preflight confirmed they exist and are active, so `create-checkout-session` and `switch-subscription` stay as they are.
