# Test payment: two separate things happened

## 1. The "weird ID preview page" — harmless, and it's your setup

Stripe redirected you back to `success_url`, which is built from the `origin` header of whatever page started checkout. You started it from the Lovable preview, so Stripe sent you to
`https://id-preview--40709742-...lovable.app/dashboard?payment=success&...`.

That domain is correct, but the tab opened as a top-level page rather than inside the editor iframe, and browser storage for an embedded preview is partitioned — so the new tab had no logged-in session and the app bounced you to `/auth`. Doing the same flow from `app.exotiq.ai` would have landed you on the dashboard.

Optional hardening (not required for correctness):
- Prefer a configured public app URL over the raw `origin` header for `success_url` / `cancel_url` in `create-payment-checkout`, so preview sessions still return to the real app.
- Add a small handler for `?payment=success` on the dashboard so the return shows a confirmation toast and refreshes the booking's payment panel, instead of silently landing on a plain dashboard.

## 2. The real finding — the $1 charge was never recorded in the app

Verified against live data:
- No `$1` row exists in `payments` (latest rows are a wire for $5,384 and Stripe rows from Jul 28).
- The only webhook event received tonight is `charge.succeeded` on the `legacy_connect` consumer at 03:50 UTC. No `checkout.session.completed` and no `payment_intent.succeeded` arrived.

Cause: `create-payment-checkout` creates the session **on the tenant's connected account**, so its events are connected-account events. The Connect endpoint created during the live cutover subscribes only to account / payout / charge / dispute events, and `stripe-webhook`'s booking-payment insert lives in the `checkout.session.completed` branch. So operator-initiated Record Payment charges settle in Stripe but never write a `payments` row or update the booking.

### Fix
1. Add `checkout.session.completed` and `payment_intent.succeeded` to the live Connect webhook endpoint's event list (Stripe API, no code change needed for the subscription itself).
2. In `stripe-webhook`, make the booking-payment path safe for the connected-account consumer: accept the event when it arrives on the connect consumer, resolve the team from the session metadata (`team_id`), and keep the existing renter/marketplace skip so `rent-payment-webhook` stays the sole owner of marketplace legs.
3. Keep dedupe intact — insert into `stripe_webhook_events` with `(consumer, stripe_event_id)` before processing, as today.
4. Backfill tonight's $1 test: read the charge from Stripe and insert the matching `payments` row (or refund it and re-test cleanly — your call).
5. Re-test with a second $1 charge from `app.exotiq.ai` and confirm a `payments` row appears and the booking's paid total moves.

## Technical notes
- Files touched: `supabase/functions/stripe-webhook/index.ts` (connect-consumer branch for checkout/payment_intent), optionally `supabase/functions/create-payment-checkout/index.ts` (return URL) and the dashboard route handler for `?payment=success`.
- Stripe-side: update endpoint `we_1TznmqHO7nC3pJiP7FGkh8mo` (connect) enabled events. The platform endpoint `/stripe-webhook` and `/rent-payment-webhook` split stays exactly as is.
- No migration required.
