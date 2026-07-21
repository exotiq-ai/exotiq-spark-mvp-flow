## Goal
Deploy the three merged-but-undeployed Stripe Identity edge functions and confirm they respond.

## Functions to deploy
- `identity-create-session` (JWT required — operator-authenticated)
- `identity-webhook` (`verify_jwt = false`, Stripe signature validated in code)
- `identity-session-status` (`verify_jwt = false`, session token in query)

No code or config edits. `supabase/config.toml` already carries the correct `verify_jwt` overrides for the two public ones.

## Steps

1. **Deploy** all three in a single `supabase--deploy_edge_functions` call:
   `["identity-create-session", "identity-webhook", "identity-session-status"]`

2. **Confirm each responds** (not `function-not-found`) via `supabase--curl_edge_functions`:
   - `GET /identity-session-status?session=vs_x` → expect **404** `Unknown session` (proves routing + public access + DB lookup path).
   - `POST /identity-webhook` with an empty body / bad signature → expect **400** signature-verification error (proves routing + `verify_jwt=false` + Stripe check runs).
   - `POST /identity-create-session` with no auth header → expect **401** unauthorized (proves routing + JWT gate). Then re-invoke with the preview session (auto-injected auth) and a bogus `customer_id` → expect a **4xx** validation/not-found, not 5xx.

3. **Check logs** for each function via `supabase--edge_function_logs` after the probes to confirm boot success and no import/runtime errors.

4. **Secrets sanity check** (read-only): confirm `STRIPE_SECRET_KEY` and `STRIPE_IDENTITY_WEBHOOK_SECRET` are present. If either is missing, stop and request it via `add_secret` before declaring go-live — the functions deploy fine without them but will 500 at runtime.

5. **Frontend smoke** (no code change): from the `/customers` VerificationSection, click **Verify ID** on a test customer and confirm the hosted link dialog appears end-to-end. This exercises `identity-create-session` against real Stripe.

## Report format
Per function: deploy status, probe status code + body snippet, log excerpt (boot + first request), and any secret gaps. Flag anything that isn't the expected 4xx as a blocker.

## Out of scope
No edits to function code, `config.toml`, migrations, or frontend. No new secrets created without explicit approval.
