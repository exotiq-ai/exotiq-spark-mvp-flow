# SOP — Connecting a Tenant's Stripe Account (Stripe Connect Express)

Last verified: 2026-08-01

---

## ⚠️ Read this first (platform state)

The platform's `STRIPE_SECRET_KEY` is currently a **sandbox (test) key**
(re-verified 2026-08-01 via `stripe-connect-status` → `mode: "test"`).
Full cutover steps live in `STRIPE_LIVE_CUTOVER_RUNBOOK.md`.


That means any tenant who connects today gets a **sandbox Express account** —
real cards will not be charged and no real payouts happen. The app is now
mode-aware, so the sandbox account is stored in `teams.stripe_test_account_id`
and does **not** touch the tenant's live payment badges.

**Before onboarding a real, money-taking tenant, flip the platform to live:**

1. Complete the **live** Connect platform profile
   (Stripe Dashboard → Connect → Platform profile → accept loss-liability).
2. Replace `STRIPE_SECRET_KEY` with the `sk_live_…` key.
3. Create the **live** webhook endpoints (same URLs as sandbox):
   - `/functions/v1/stripe-webhook` — enable **"Listen to events on connected
     accounts"** and include `account.updated`.
   - `/functions/v1/rent-payment-webhook` — `checkout.session.completed`,
     `payment_intent.succeeded`, `payment_intent.payment_failed`.
4. Update `STRIPE_WEBHOOK_SECRET` and `RENT_PAYMENT_WEBHOOK_SECRET` with the
   live signing secrets.
5. Re-run the verification steps at the bottom of this doc.

No code changes are needed for the flip — mode is derived from the key itself.

---

## What the tenant does (5 minutes)

1. Sign in → **Settings → Payments**.
2. Click **Connect Stripe Account**. A Stripe tab opens.
3. Complete Stripe's form:
   - Business type (individual or company) and legal name
   - EIN / SSN last 4, date of birth, home or business address
   - Bank account for payouts (routing + account number)
   - Phone + email verification code
4. Click **Done / Return to Exotiq** at the end. Stripe sends them back to
   the app on the **Payments** tab.
5. The badge turns **Active** automatically (the app polls Stripe directly for
   up to 60 seconds — it does not wait on webhooks).

### What each badge means

| Badge | Meaning | Action |
|---|---|---|
| **Not connected** | No Stripe account yet | Click *Connect Stripe Account* |
| **Onboarding** | Account created, form not finished | Click *Continue Setup* |
| **Restricted** | Stripe needs more info or is verifying | See the "Stripe still needs:" list on the card, then *Continue Setup* |
| **Active** | Charges + payouts enabled | Nothing — they can take money |

If Stripe is still verifying (common for company accounts), the badge sits at
**Restricted** for a few minutes to a few hours. **Refresh Status** re-checks
Stripe live at any time.

---

## Support playbook

| Symptom | Cause | Fix |
|---|---|---|
| "Stripe platform setup required" toast | Our platform profile is incomplete | Complete Connect → Platform profile in *our* Stripe dashboard, then retry |
| Badge stuck on Onboarding | Tenant closed Stripe before finishing | *Continue Setup* — the link resumes where they left off |
| Badge stuck on Restricted, list shows items | Stripe wants documents (ID, business docs) | *Continue Setup* → upload; then *Refresh Status* |
| "Multiple teams found — pass team_id" | Staff account administers more than one tenant | Switch to the intended team in the team switcher, then retry |
| Onboarding link says expired | Account links are single-use / short-lived | *Continue Setup* generates a fresh link |
| Tenant disconnected us in Stripe | `account.application.deauthorized` | App clears credentials and notifies the owner; they must reconnect |

Only **owners and admins** can connect or manage the account. Managers can open
the Stripe Express dashboard; operators and viewers cannot.

---

## How it works (for us)

- `stripe-connect-onboard` — creates the Express account (country from
  `teams.country_code`, drives payout currency) and returns an account link.
  Writes to `stripe_account_id` in live mode, `stripe_test_account_id` in test.
- `stripe-connect-refresh` — regenerates the onboarding link ("Continue Setup").
- `stripe-connect-status` — **authoritative**: retrieves the account from
  Stripe, syncs `stripe_charges_enabled` / `stripe_payouts_enabled` /
  `stripe_onboarding_complete`, and returns Stripe's outstanding requirements.
  Called on mount, on *Refresh Status*, and while polling after the return trip.
- `stripe-webhook` — `account.updated` keeps the flags fresh in the background;
  it is now a convenience, not a dependency.
- Marketplace visibility additionally requires `platform_fee_percent` to be
  confirmed — connecting Stripe alone does not list a tenant.

## Verification checklist (run after any Stripe key or webhook change)

1. `POST /functions/v1/stripe-connect-status` with no auth → expect **401**.
2. Same call with a tenant session → expect JSON with the correct `mode`
   (`test` or `live`) and `account_id`.
3. Settings → Payments shows a badge consistent with that response.
4. Stripe Dashboard → Webhooks → both endpoints show recent **200** deliveries.
