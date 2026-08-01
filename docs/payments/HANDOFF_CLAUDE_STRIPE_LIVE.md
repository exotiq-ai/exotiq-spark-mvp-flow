# Copy/paste handoff for Claude — Stripe live cutover (Exotiq)

Paste everything below the line into Claude in a checkout of this repo. Claude
needs the **live** Stripe secret key available as `STRIPE_LIVE_KEY` in its
shell. Do not paste the key into the prompt text.

---

You are helping flip Exotiq from Stripe sandbox to Stripe live. The app derives
its mode from the secret key itself (`supabase/functions/_shared/stripeMode.ts`),
so **do not change any application code unless a live price ID turns out to
differ from the hardcoded one**.

Read `docs/payments/STRIPE_LIVE_CUTOVER_RUNBOOK.md` first. Then:

### Task 1 — Pre-flight (read-only)

```bash
STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts
```

Report every PASS/FAIL verbatim. Do not fix anything yet.

### Task 2 — Fix live objects, if the pre-flight failed

- **Missing/archived products or prices**: create them live with these exact
  amounts — Pro $39/vehicle/month and $390/vehicle/year, Business
  $29/vehicle/month and $290/vehicle/year, all USD, recurring. Then replace the
  price IDs in the `PRICES` maps of
  `supabase/functions/create-checkout-session/index.ts` and
  `supabase/functions/switch-subscription/index.ts`. Leave the legacy `prod_…`
  map in `supabase/functions/check-subscription/index.ts` alone — grandfathered
  subscriptions depend on it. If new live product IDs are created, ADD them to
  that map rather than replacing entries.
- **No active billing portal configuration**: create one via
  `POST /v1/billing_portal/configurations` with subscription cancel + payment
  method update enabled. `customer-portal` fails without it.
- **Connect platform profile incomplete**: this cannot be fixed via API. Stop
  and report it — a human must accept loss-liability in the live dashboard.

### Task 3 — Create the live webhook endpoints

```bash
STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts --apply
```

Capture the three printed signing secrets and hand them back to the operator
through a secure channel (password manager, not chat, not a repo file). They
are shown once.

Requirements that must hold:
- `/functions/v1/stripe-webhook` must have `connect: true` (listens on
  connected accounts).
- `checkout.session.completed`, `payment_intent.succeeded`,
  `payment_intent.payment_failed` must be on `rent-payment-webhook` **only**,
  never on `stripe-webhook`. The `(consumer, stripe_event_id)` dedupe design
  depends on that split.

### Task 4 — Report

Produce a short report with: live account ID, the four price IDs actually in
use, the three endpoint IDs, and a checklist of anything a human still has to
do. Do not swap any project secrets yourself — the operator does that in the
Lovable secret form.

### Hard rules

- Never print, log, or commit `STRIPE_LIVE_KEY` or any signing secret to a file
  in the repo.
- Do not delete or modify existing sandbox webhook endpoints.
- Do not run `admin-stripe-webhook-manager` — it is sandbox-only by design.
- Do not create charges, subscriptions, or Connect accounts in live mode. The
  live smoke tests are performed by the operator through the app UI.
