# Go-Live Plan — Switch Stripe from Sandbox to Live

Goal: flip the platform Stripe key to live without breaking (a) Command Center subscription billing, (b) Stripe Connect tenant onboarding, (c) renter-app payments — and prove each one works after the flip.

Mode is derived from the key itself (`_shared/stripeMode.ts`), so no code change is needed to switch. The risk is entirely in secrets, webhooks, product/price IDs, and the connected-account columns.

## Current state (verified)

- Only one tenant has Connect accounts: **Drive Exotiq** — live `acct_1TvnfgQfNJmCrgjR`, sandbox `acct_1TwYk2HpKoA2ZJg1`, charges enabled, marketplace visible, 10% fee.
- Subscription price IDs are hardcoded in `create-checkout-session` and `switch-subscription` (Pro/Business, monthly/annual).
- Three webhook consumers exist: `stripe-webhook` (`STRIPE_WEBHOOK_SECRET`), `rent-payment-webhook` (`RENT_PAYMENT_WEBHOOK_SECRET`), `identity-webhook` (`STRIPE_IDENTITY_WEBHOOK_SECRET`).
- The platform key's mode will be re-confirmed as step 0 before anything else.

## Phase 0 — Pre-flip audit (no changes)

1. Confirm the current `STRIPE_SECRET_KEY` mode by calling `stripe-connect-status` and reading the returned `mode`.
2. Verify in the **live** Stripe account that the 4 subscription price IDs above exist and are active. If they only exist in sandbox, they must be recreated live and the two edge functions updated with the live IDs.
3. Confirm the live Connect platform profile is complete (loss-liability accepted) — otherwise every `accounts.create` fails with `platform_profile_incomplete`.
4. Snapshot which teams have live vs test account IDs so nothing is orphaned.

## Phase 1 — Live Stripe objects (via API where possible)

- Create/verify live Products + Prices for Pro ($39/veh/mo, $390/yr) and Business ($29/veh/mo, $290/yr) using the Stripe API.
- If any live price ID differs from the hardcoded one, update `create-checkout-session` and `switch-subscription`, and keep legacy product IDs mapped in `check-subscription` so grandfathered subs still resolve.
- Activate the live Customer Portal configuration (required by `customer-portal`).

## Phase 2 — Webhooks (live endpoints)

Create three live endpoints pointing at the same function URLs as sandbox:

| Endpoint | Events | Secret |
|---|---|---|
| `/stripe-webhook` | `account.updated`, `account.application.deauthorized`, subscription lifecycle (`customer.subscription.*`, `invoice.*`) — **with "listen on connected accounts" enabled** | `STRIPE_WEBHOOK_SECRET` |
| `/rent-payment-webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` | `RENT_PAYMENT_WEBHOOK_SECRET` |
| `/identity-webhook` | `identity.verification_session.*` | `STRIPE_IDENTITY_WEBHOOK_SECRET` |

Keep the checkout/payment events **off** the legacy endpoint so the dedupe work from the earlier webhook fix is preserved.

## Phase 3 — Secret cutover (the only true downtime window)

Order matters. Between the key swap and the secret swaps, webhook signature checks will fail, so do them back to back:

1. Pause the renter payment scheduler sweep (or accept a short window).
2. Replace `STRIPE_SECRET_KEY` with `sk_live_…`.
3. Replace `STRIPE_WEBHOOK_SECRET`, `RENT_PAYMENT_WEBHOOK_SECRET`, `STRIPE_IDENTITY_WEBHOOK_SECRET` with the live signing secrets.
4. If `STRIPE_IDENTITY_SECRET_KEY` is set separately, flip it too.
5. Redeploy the Stripe-touching functions so they pick up new env values.

**I will flag you here** — I cannot read or paste live secrets. You supply each via the secure secret form; I sequence and verify.

## Phase 4 — Reconnect the tenant (Connect)

Live mode reads `teams.stripe_account_id`, not the sandbox column, so nothing is lost. For Drive Exotiq:

- Run `stripe-connect-status` and confirm `mode: "live"`, correct `account_id`, and `charges_enabled` / `payouts_enabled`.
- If the live account is stale or restricted, use *Continue Setup* to finish it.
- Any weekend tenant onboarding then follows the existing SOP unchanged.

## Phase 5 — Post-flip verification (live, small real amounts)

1. **Subscriptions:** start a checkout on a throwaway team with a real card, confirm the subscription appears, `check-subscription` returns the right tier, `switch-subscription` prorates, and the customer portal opens. Cancel and refund immediately.
2. **Connect:** confirm badge shows **Active**; confirm `account.updated` deliveries return 200.
3. **Renter payments:** run one real low-value marketplace booking end to end — quote → hold → checkout → `rent-payment-webhook` marks paid → confirmation email → then `rent-refund-booking` to return the money. Confirm the 10% Exotiq leg and the operator destination charge both land in the right accounts.
4. Confirm every live endpoint shows recent **200** deliveries and `stripe_webhook_events` has rows for each consumer with no duplicate-key errors.
5. Re-run the SOP verification checklist and update `docs/payments/STRIPE_CONNECT_ONBOARDING_SOP.md` to drop the sandbox warning banner.

## Rollback

Re-setting `STRIPE_SECRET_KEY` back to the sandbox key plus the sandbox webhook secrets fully reverts behaviour; live-created objects stay in Stripe untouched. Live payments taken before rollback must be refunded manually in the Stripe dashboard.

## Things I need from you

- Live Stripe secret key and the three live webhook signing secrets (entered via the secure form — never pasted in chat).
- Confirmation that the live Connect platform profile is complete.
- A real card for the Phase 5 smoke tests, and go-ahead to charge/refund small amounts.

## Claude handoffs

Where work is better done outside this project (live Stripe dashboard config, price re-creation scripts against the live key), I'll produce copy/paste handoff blocks in `docs/payments/` with exact commands and acceptance criteria rather than doing it silently.
