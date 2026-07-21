## Amended plan — Option A, isolated Identity key

Do **not** touch `STRIPE_SECRET_KEY` (live payments). Introduce a separate test-mode key for Stripe Identity only, matching PR #25's dual-secret fallback (`STRIPE_IDENTITY_SECRET_KEY` preferred, `STRIPE_SECRET_KEY` fallback).

### Step 1 — Store the new Identity key (waits on you)

You provide a test-mode restricted key (`rk_test_…`) with:
- Identity Verification Sessions → Write
- Identity Verification Results → Write (`identity_product_write`)

I'll open the secure form via `update_secret` for `STRIPE_IDENTITY_SECRET_KEY` (falls back to `add_secret` if it doesn't exist yet). Format hint: `rk_test_…` / `sk_test_…`.

No mirroring of payment scopes. `STRIPE_SECRET_KEY` and `STRIPE_IDENTITY_WEBHOOK_SECRET` stay exactly as they are.

### Step 2 — Wait for PR #25 to land on main

The dual-secret preference logic (`STRIPE_IDENTITY_SECRET_KEY` → fallback `STRIPE_SECRET_KEY`) must be present in `supabase/functions/identity-create-session/index.ts` and `supabase/functions/identity-webhook/index.ts` before redeploy. I'll confirm by reading both files. If the fallback code isn't there yet, I stop and wait rather than deploying stale code.

### Step 3 — Redeploy the two Identity functions

`supabase--deploy_edge_functions` with `["identity-create-session", "identity-webhook"]`. Do **not** redeploy `identity-session-status` (unchanged) and do not touch payments functions.

### Step 4 — Verify end-to-end

1. `curl_edge_functions` POST to `identity-create-session` for `gregory.ringler@gmail.com`; expect **200** with `{ url, status: "created" }` and a `vs_test_…` id. Read logs to confirm no `StripePermissionError`.
2. You open the returned hosted URL and complete the sandbox verification flow.
3. Read `identity-webhook` logs to confirm signature verification passes and the `identity.verification_session.verified` event is processed against the same test-mode key.
4. Query `identity_verifications` + `customers.identity_status` for that customer; confirm row lands and `identity_status = 'verified'`.
5. Open `VerificationSection` in the UI, confirm badge flips to **"ID Verified"** and the "View in Stripe" deep-link resolves.

### Step 5 — Report

- Which secret the functions actually resolved (`STRIPE_IDENTITY_SECRET_KEY` present → used) — prefix only, never the value.
- Deploy status for both functions.
- Session id + webhook event id for the successful run.
- Confirmation that `STRIPE_SECRET_KEY` and `STRIPE_IDENTITY_WEBHOOK_SECRET` were not modified.

### Guardrails

- No code changes in this project; PR #25 is the code path.
- No migrations.
- No changes to `identity-session-status`, payments functions, or the sandbox webhook endpoint.
- If PR #25 hasn't merged yet at Step 2, I pause and report — I won't deploy without the fallback in place.

Ready to open the `update_secret` form for `STRIPE_IDENTITY_SECRET_KEY` on your go.
