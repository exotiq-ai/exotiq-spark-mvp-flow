# Stripe live-cutover work order — verified review + revised plan

I checked each item against current `main`. Seven of nine hold up. One is already
done, and one part of item 1 would actively break money processing if shipped.

## Where Claude is wrong

**1a. "The webhook verifies against one secret" — already fixed.**
`stripe-webhook/index.ts:31-68` already builds a candidate list from
`STRIPE_WEBHOOK_SECRET` (consumer `legacy`) *and* `STRIPE_CONNECT_WEBHOOK_SECRET`
(consumer `legacy_connect`) and tries both before rejecting. Dual-secret support
and the per-consumer dedupe key both landed. No code change needed here — the
real gap is that `scripts/stripe/live-preflight.ts:41-56` still declares a
*single* endpoint (`connect:true`, secret name `STRIPE_WEBHOOK_SECRET`), so
`--apply` would create one endpoint and print its secret under the platform name.
That is a docs/preflight fix, not a handler rewrite.

**1b. Adding `checkout.session.completed`, `payment_intent.succeeded` to the
connect endpoint is a regression — do not do it.**
Those three events are deliberately routed to `rent-payment-webhook` only. The
`(consumer, stripe_event_id)` dedupe is per-consumer, so the same event arriving
at `stripe-webhook` under a different consumer key would be processed a *second
time* — double payment rows, double fee expense rows. Renter charges are
destination charges created on the platform account, so they surface as platform
events anyway; a connect endpoint would not add coverage. Keep the split as-is.
`charge.captured` / `charge.succeeded` / `payment_intent.amount_capturable_updated`
handlers exist in `stripe-webhook` and are safe to list on the **connect**
endpoint only (deposit/manual-capture legs on connected accounts).

**5 is worse than described, and it is broken today, not only in live.** Confirmed
against the live schema: `payments.user_id` and `payments.payment_type` are both
NOT NULL and there is no `paid_at` column. So every extension payment insert has
*always* failed, and the error is swallowed at `rent-extend-booking/index.ts:291`.
This should be item 1, ahead of the webhook topology work.

## Confirmed and worth doing

- **2** Platform-account leak — real. `stripe-get-balance/index.ts:101-124` and
  `stripe-payment-history/index.ts:84-105` fall through to the platform account
  when `stripeAccountId` is null.
- **3** Six service-role functions unauthenticated — real. `rent-payment-scheduler`
  lists `x-cron-token` in CORS but never reads it; the other five have no gate at
  all. `slack-notify`'s `{test, webhookUrl}` branch (`:37-69`) is an open relay.
- **4** No `sk_test_` guard on either admin util — real.
- **6** Open redirect — real; `create-checkout-session:119-126` echoes `Origin`
  and interpolates `returnPath`/`cancelPath` unvalidated.
- **7** Preflight identity spec missing `processing` + `redacted` — real.
- **8** DJB2 idempotency hash at `:580-594` — real, low blast radius.
- **9** Refund clamp — real, defense-in-depth only.

## Revised order of work

### Ship before live money
1. **`rent-extend-booking` ledger** — add `user_id` (acting user) and
   `payment_type`, replace `paid_at` with `transaction_date`, and **throw** on
   insert error so the existing both-legs refund rollback fires. Clamp
   `rate_cents_per_day` to the vehicle's stored rate (currently only `>= 0`).
   Role-gate to admin/manager via the existing `team_members` lookup at `:125`.
   Backfill check: query completed extensions with no matching `payments` row and
   report the list (no auto-write).
2. **Platform-account leak** — return `{ connected: false }` + empty arrays
   instead of platform balance/payments.
3. **Service-role auth** — apply the `check-fleet-alerts:285-296` pattern
   (`x-cron-token` OR valid JWT) to all six; delete the `slack-notify` relay branch.
4. **`sk_test_` guard** on `admin-stripe-account-link` and
   `admin-stripe-verify-person`, matching `admin-stripe-webhook-manager:27`.
5. **Preflight topology** — split the spec into a connect endpoint
   (`account.updated`, `account.application.deauthorized`, `payout.paid`,
   `charge.refunded`, `charge.dispute.created`, `charge.captured`,
   `charge.succeeded`, `payment_intent.amount_capturable_updated`,
   secret `STRIPE_CONNECT_WEBHOOK_SECRET`) and a platform endpoint
   (`customer.subscription.updated/deleted`, `invoice.payment_failed`,
   `charge.refunded`, `charge.dispute.created`, secret `STRIPE_WEBHOOK_SECRET`),
   add `api_version=2025-08-27.basil` to `--apply` creates, and add the two
   identity events. Update `docs/payments/STRIPE_LIVE_CUTOVER_RUNBOOK.md` and
   `HANDOFF_CLAUDE_STRIPE_LIVE.md` to the two-endpoint topology and the canonical
   secret names.

### Same day, after
6. Origin allowlist + `^/[^/]` path validation in `create-checkout-session`.
7. SHA-256 (Web Crypto) idempotency key from the charge id in `stripe-webhook`.
8. Refund amount clamp to the original charge total.

## Verification

- `curl` with no auth against both admin fns and all six service fns → 401/403.
- Deno type-check on every touched function; `bunx vitest run` full suite.
- Seeded extension with card-on-file → two `payments` rows written, and a forced
  insert failure rolls back both Stripe legs.
- `stripe-get-balance` / `stripe-payment-history` for a team with no connected
  account → `connected: false`, empty arrays, no platform figures.
- Preflight dry-run against live reports both endpoints with correct event sets.

## Open question

Item 1 as written would have put renter payment events on a second endpoint. I am
excluding that. If the intent was to cover **direct** charges on connected
accounts (a future non-destination flow), say so and I will add them behind a
shared dedupe consumer key instead.
