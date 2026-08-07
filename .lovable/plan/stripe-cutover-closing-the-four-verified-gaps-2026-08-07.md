# Stripe cutover — closing the four verified gaps

I re-checked each of Claude's four points against the current code. All four hold.

- `admin-stripe-account-link` and `admin-stripe-verify-person` have super-admin gates
  but no `sk_test_` refusal. The functions I checked last round
  (`admin-stripe-webhook-manager`, `admin-create-test-connect`) were the wrong ones.
- `create-payment-checkout:128` does pass `{ stripeAccount: stripeAccountId }`, so its
  `checkout.session.completed` / `payment_intent.succeeded` are connected-account events.
  The current preflight spec puts them on the `connect:false` endpoint, where they will
  never arrive. That is a real regression of the tenant-payment flow.
- The preflight identity spec still lists only `verified`, `requires_input`, `canceled`.
- `chargeIdToUuid` at `stripe-webhook:580` is still the DJB2 construction. The SHA-256
  work I did last round was on the extension idempotency key, a different thing.

## Work

### 1. `sk_test_` guards on the two admin utilities
Add the `admin-stripe-webhook-manager:27` refusal (400 + "STRIPE_SECRET_KEY is not
sk_test_ — refusing") to `admin-stripe-account-link` and `admin-stripe-verify-person`,
placed before the auth check so a live key is refused regardless of caller.

### 2. Preflight endpoint topology
Adopt Claude's event sets verbatim.

- Connect endpoint (`connect: true`, `STRIPE_CONNECT_WEBHOOK_SECRET`):
  `account.updated`, `account.application.deauthorized`, `payout.paid`,
  `charge.refunded`, `charge.dispute.created`, `charge.captured`, `charge.succeeded`,
  `payment_intent.amount_capturable_updated`, `checkout.session.completed`,
  `payment_intent.succeeded`.
- Platform endpoint (`connect: false`, `STRIPE_WEBHOOK_SECRET`):
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`.

Also add `api_version=2025-08-27.basil` to the `--apply` create calls, and add
`identity.verification_session.processing` and `.redacted` to the identity endpoint spec.

One caveat worth naming: `charge.refunded` and `charge.dispute.created` now sit on both
endpoints. They come from different accounts so in practice each event lands once, but
the dedupe key is `(consumer, stripe_event_id)` — it would not stop the same charge being
processed twice if an event ever reached both consumers. Before flipping, I'll confirm the
refund and dispute handlers key their writes on the charge/payment id rather than the
event id, and tighten them if they don't. No new endpoint work, just a guard check.

### 3. SHA-256 charge-id hash in `stripe-webhook`
Replace the DJB2 `chargeIdToUuid` with a Web Crypto SHA-256 of the charge id, formatted
into the same UUID v5-style layout, and make the function `async` (the single call site at
`:543` is already inside an async handler). This changes the derived
`vehicle_expenses.source_record_id` for future rows only — existing processing-fee rows
keep their old ids, so the unique-on-charge guard still holds going forward. I will not
backfill.

### 4. Documentation
Rewrite `docs/payments/STRIPE_LIVE_CUTOVER_RUNBOOK.md` and
`docs/payments/HANDOFF_CLAUDE_STRIPE_LIVE.md` to the two-endpoint topology, the canonical
secret names, and four endpoints total (not three). The rule "never put
`checkout.session.completed` on `stripe-webhook`" becomes: renter-leg
`checkout.session.completed` / `payment_intent.succeeded` belong to
`rent-payment-webhook` only; the `isRenterMoneyObject` metadata guard in `stripe-webhook`
is what enforces that split, so tenant legs on the connect endpoint are safe.

## Verification

- `curl` with no auth against `admin-stripe-account-link` and `admin-stripe-verify-person`
  → 401; with a valid super-admin JWT while `STRIPE_SECRET_KEY` is `sk_live_` → 400 refusal.
- Tenant payment through `RecordPaymentDialog` → exactly one `payments` row, recorded via
  the `legacy_connect` consumer, no duplicate-key error in `stripe_webhook_events`.
- Renter marketplace booking → `stripe-webhook` logs the skip line and writes no row.
- Processing-fee expense row written with the new SHA-256 id; a replayed
  `charge.succeeded` for the same charge is rejected by the unique constraint.
- Preflight dry-run against live reports four endpoints with the exact event sets above.
- Deno type-check on every touched function; full `bunx vitest run`.
