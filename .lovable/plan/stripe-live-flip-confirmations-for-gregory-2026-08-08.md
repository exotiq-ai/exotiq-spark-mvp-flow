# Stripe live flip — confirmations for Gregory

I read the brief. Nothing to build; my part is two confirmations, a deploy freeze, and standby. I verified both confirmations against the live project rather than from memory.

## Confirmation 1 — cron tokens match the deployed secret: YES (with one correction)

There are **four**, not three, scheduled jobs that send `x-cron-token`:

| Job | Schedule | Function |
| --- | --- | --- |
| check-fleet-alerts-hourly | 0 * * * * | check-fleet-alerts |
| rent-payment-scheduler-every-15-min | */15 * * * * | rent-payment-scheduler |
| retention-sweeper-daily | 0 3 * * * | retention-sweeper |
| daily-generate-recurring-expenses | 0 3 * * * | generate-recurring-expenses |

All four carry the same token value, and it matches the deployed secret in practice: every HTTP response from these jobs in the last 6 hours returned **200** (30 of 30 completed calls), with zero 401/403. A token mismatch would surface as 401 on every run, so the cron config and the edge-function secret are in sync.

Naming correction for the runbook: the env var is `CRON_TRIGGER_TOKEN` (read in `_shared/serviceAuth.ts` and in `check-fleet-alerts`), not `CRON_SECRET`. Nothing in the flip touches it — leave it alone and the schedulers keep running.

## Confirmation 2 — no cached Stripe secrets at module scope: CONFIRMED

Scanned every function for module-scope `Deno.env.get` of any `STRIPE*` / `RENT_PAYMENT_WEBHOOK_SECRET` name. Zero hits — all Stripe key and signing-secret reads happen inside the request handler, so a secret swap takes effect on the next invocation with **no redeploy required**. The only module-level Stripe constants are the `STRIPE_PRICES` price-ID maps in `create-checkout-session` and `switch-subscription`, which are IDs, not secrets — but see the flag below.

Nothing needs to be sequenced inside the window for secret pickup.

## Flag before the window (one item, not in the brief)

`create-checkout-session` and `switch-subscription` hold hardcoded **subscription price IDs**. Price IDs do not carry across from sandbox to live — if those maps still hold `price_...` values created in test mode, subscription checkout in Command Center will fail immediately after the key swap even though the secret swap itself is clean. Worth confirming the live-mode price IDs exist and match before you flip; if they differ, that is a one-line code change and should happen **before** the freeze starts, not during it.

## Signing-secret env names the deployed code actually reads (for contingency 3)

- `stripe-webhook` → `STRIPE_WEBHOOK_SECRET` (platform) and `STRIPE_CONNECT_WEBHOOK_SECRET` (connect); it tries both against the same signature
- `rent-payment-webhook` → `RENT_PAYMENT_WEBHOOK_SECRET`
- `identity-webhook` → `STRIPE_IDENTITY_WEBHOOK_SECRET`

Matches the brief exactly. No renames needed.

## My commitments

1. **Deploy freeze** from "flipping" to "clear": no edge-function deploys, no edits to function code, no migrations.
2. **Standby** for the signature-failure contingency above.
3. **Standing rule after clear:** any change touching `stripe-*`, `rent-*` money functions, `create-payment-checkout`, or webhook handlers gets flagged to Gregory before deploy.

## What I need from you

Confirm whether the live-mode subscription price IDs match what is hardcoded today. If they do not, tell me the live IDs and I will patch them before the freeze window opens.
