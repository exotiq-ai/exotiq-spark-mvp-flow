# Runbook — Stripe sandbox → live cutover

Last updated: 2026-08-01
Owner: platform (Exotiq Inc)

Verified state at time of writing: `stripe-connect-status` returns `mode: "test"`.
The platform `STRIPE_SECRET_KEY` is a **sandbox** key. Nothing on the platform
can take real money until step 3 below.

Mode is derived from the key (`supabase/functions/_shared/stripeMode.ts`).
**No code change is required to go live.** Everything below is secrets,
Stripe-side objects, and verification.

---

## What breaks if you do this out of order

Between swapping `STRIPE_SECRET_KEY` and swapping the four webhook signing
secrets, every incoming webhook fails signature verification and returns 400.
Stripe retries, so nothing is permanently lost, but do steps 3.1–3.4 back to
back within a few minutes.

---

## Step 0 — Confirm current mode (done, re-run any time)

```bash
curl -s -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/stripe-connect-status \
  -H "Authorization: Bearer <a signed-in tenant JWT>" \
  -H "Content-Type: application/json" \
  -d '{"team_id":"c1de6533-ab44-4973-a123-007a8007b5ba"}'
```

`mode` in the response is authoritative.

## Step 1 — Live-side pre-flight (read-only)

Run the pre-flight with the **live** key held locally (never store it in the
repo, never paste it into chat):

```bash
STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts
```

It checks, against live:

- platform account reachable and charges-enabled
- the two subscription products and four price IDs hardcoded in
  `create-checkout-session` / `switch-subscription` exist and are active
- an active Billing customer-portal configuration exists (`customer-portal`
  fails without one)
- Connect is reachable
- the four required webhook endpoints exist with the right events (two of them
  share the `/stripe-webhook` URL and are matched on the `connect` flag)


Anything reported FAIL must be fixed before step 3.

### If the price IDs are missing in live

They must be recreated live with the same amounts (Pro $39/veh/mo, $390/veh/yr;
Business $29/veh/mo, $290/veh/yr), then the new IDs pasted into:

- `supabase/functions/create-checkout-session/index.ts` (PRICES map)
- `supabase/functions/switch-subscription/index.ts` (PRICES map)

Leave `check-subscription`'s legacy `prod_…` map untouched — it keeps
grandfathered subscriptions resolving.

### Connect platform profile

Confirm Connect → Platform profile is complete in the **live** dashboard
(loss-liability accepted). If it is not, every `accounts.create` fails and
`stripe-connect-onboard` returns `platform_profile_incomplete`.

## Step 2 — Create the live webhook endpoints

```bash
STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts --apply
```

It creates whatever is missing and prints each signing secret **once**. Copy
them somewhere safe for step 3; Stripe will not show them again via the API.

Endpoints created (same URLs as sandbox — note that `/stripe-webhook` carries
**two** endpoints, one platform and one Connect, each with its own signing
secret; the handler verifies against either):

| URL | Events | Secret |
|---|---|---|
| `/functions/v1/stripe-webhook` — **connect: false** | `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created` | `STRIPE_WEBHOOK_SECRET` |
| `/functions/v1/stripe-webhook` — **connect: true** | `account.updated`, `account.application.deauthorized`, `payout.paid`, `charge.refunded`, `charge.dispute.created`, `charge.captured`, `charge.succeeded`, `payment_intent.amount_capturable_updated`, `checkout.session.completed`, `payment_intent.succeeded` | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| `/functions/v1/rent-payment-webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` | `RENT_PAYMENT_WEBHOOK_SECRET` |
| `/functions/v1/identity-webhook` | `identity.verification_session.verified`, `.requires_input`, `.processing`, `.redacted`, `.canceled` | `STRIPE_IDENTITY_WEBHOOK_SECRET` |

Why `checkout.session.completed` and `payment_intent.succeeded` sit on the
Connect endpoint: `create-payment-checkout` mints tenant payment sessions **on
the connected account**, so those events only ever arrive over Connect, and
`stripe-webhook` is the only recorder for them. The earlier rule "never put
`checkout.session.completed` on `stripe-webhook`" applies to **renter legs
only** — those are owned by `rent-payment-webhook`, and `stripe-webhook`
enforces the exclusion in code via its `isRenterMoneyObject` metadata guard.
Dedupe stays correct because the key is `(consumer, stripe_event_id)`, with
`legacy` for the platform secret and `legacy_connect` for the Connect secret.

Note: `admin-stripe-webhook-manager` refuses to run unless the key is
`sk_test_`, so it cannot be used for the live endpoints. That guard is
intentional — use the script above. `admin-stripe-account-link` and
`admin-stripe-verify-person` carry the same `sk_test_` refusal.


## Step 3 — Swap the secrets (short window)

Do these back to back:

1. `STRIPE_SECRET_KEY` → `sk_live_…`
2. `STRIPE_WEBHOOK_SECRET` → live signing secret from step 2
3. `RENT_PAYMENT_WEBHOOK_SECRET` → live signing secret from step 2
4. `STRIPE_IDENTITY_WEBHOOK_SECRET` → live signing secret from step 2
5. If `STRIPE_IDENTITY_SECRET_KEY` is set separately, swap it too
6. Redeploy the Stripe-touching edge functions so they pick up the new env

## Step 4 — Connect tenants

Live mode reads `teams.stripe_account_id`; the sandbox account stays parked in
`teams.stripe_test_account_id` and is ignored. Nothing to migrate.

Drive Exotiq already has a live account: `acct_1TvnfgQfNJmCrgjR`. After the
flip, run `stripe-connect-status` for that team and confirm:

- `mode: "live"`
- `account_id: acct_1TvnfgQfNJmCrgjR`
- `charges_enabled: true`, `payouts_enabled: true`

If it comes back restricted, use *Continue Setup* in Settings → Payments.
New tenants follow `STRIPE_CONNECT_ONBOARDING_SOP.md` unchanged.

## Step 5 — Live smoke tests (real money, refund immediately)

1. **Subscription** — checkout on a throwaway team with a real card. Confirm
   the subscription exists, `check-subscription` returns the right tier,
   `switch-subscription` prorates, and the customer portal opens. Cancel + refund.
2. **Connect** — badge reads **Active**; `account.updated` deliveries return 200.
3. **Renter payment** — one low-value marketplace booking, end to end: quote →
   hold → checkout → `rent-payment-webhook` marks paid → confirmation email →
   `rent-refund-booking` returns the money. Verify the 10% Exotiq application
   fee landed on the platform and the operator leg on `acct_1TvnfgQfNJmCrgjR`.
4. Confirm all three live endpoints show recent **200** deliveries and
   `stripe_webhook_events` has rows per consumer with no duplicate-key errors.
5. Delete the sandbox-only helpers once confident: `admin-create-test-connect`,
   `admin-stripe-webhook-manager`.

## Rollback

Re-set `STRIPE_SECRET_KEY` and the three webhook secrets back to the sandbox
values. Behaviour reverts entirely; live objects stay in Stripe. Any live
payments already taken must be refunded manually in the dashboard.
