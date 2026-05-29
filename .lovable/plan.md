# Harden Tenant Stripe Connect Activation

## Goal
Make the tenant Stripe Connect activation flow bulletproof before the first real tenant activates. Currently zero tenants are connected — we have a clean runway to fix the 2 critical bugs and 5 gaps the audit surfaced.

## Critical fixes (P0)

### 1. Frontend return-URL handler
**Problem:** After completing Stripe onboarding, tenants land at `/dashboard?stripe_onboard=complete` with no feedback. The UI keeps showing "Onboarding" until they manually click Refresh.

**Fix in `src/pages/Dashboard.tsx`:**
- Read `stripe_onboard` and `stripe_refresh` from `searchParams`.
- On `stripe_onboard=complete`:
  - Call `refreshTeam()` to re-fetch the team row.
  - Show a toast: "Connecting your account — Stripe is verifying your details. This usually takes under a minute."
  - Strip the param from the URL (`navigate('/dashboard', { replace: true })`) and redirect to `/dashboard/settings?tab=payments` so the tenant sees the updated badge.
  - Poll `refreshTeam()` every 5s for up to 60s while `stripe_charges_enabled` is still false (the webhook is usually <5s but can be delayed).
- On `stripe_refresh=true`: redirect back to `/dashboard/settings?tab=payments` and call the existing "Continue Setup" flow.

### 2. Hard-fail missing tenant in `create-payment-checkout`
**Problem:** If `teamMember` lookup returns null, the function falls through and creates a Stripe Checkout session on the **platform account** — revenue lands on Exotiq, not the tenant.

**Fix in `supabase/functions/create-payment-checkout/index.ts`:**
- Change `if (teamMember)` block to: `if (!teamMember) throw new Error("No active team membership found for this user. Cannot route payment.");`
- Also hard-fail if `team.stripe_account_id` is null OR `team.stripe_charges_enabled` is false, with a clear error: "Tenant Stripe account is not active. Please complete payment setup in Settings → Payments."
- Return a 409 (Conflict) status with the human-readable message so the UI can surface it to the operator clearly.

## High-priority fixes (P1)

### 3. Role check on `stripe-connect-dashboard`
**Problem:** Any active team member (including Viewer role) can open the Express dashboard.

**Fix in `supabase/functions/stripe-connect-dashboard/index.ts`:**
- Add `.in("role", ["owner", "admin", "manager"])` to the `team_members` query, mirroring `stripe-connect-onboard`. Manager+ is appropriate per the RBAC memory.

### 4. Add Stripe fields to the `Team` TypeScript interface
**Fix in `src/contexts/TeamContext.tsx`:**
- Extend `Team` interface with:
  ```ts
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  stripe_onboarding_complete?: boolean;
  ```
- Remove the `as any` cast in `PaymentMethodsSection.tsx:44` and any other downstream consumers.

### 5. Handle `account.application.deauthorized` webhook
**Problem:** If a tenant disconnects the app from Stripe's side, our DB stays "active" forever with an invalid account ID.

**Fix in `supabase/functions/stripe-webhook/index.ts`:**
- Add a case for `account.application.deauthorized` that:
  - Looks up team by `stripe_account_id`.
  - Sets `stripe_account_id = null`, `stripe_charges_enabled = false`, `stripe_payouts_enabled = false`, `stripe_onboarding_complete = false`.
  - Inserts a record into `notifications` for the team owner: "Your Stripe account has been disconnected. Reconnect to resume accepting payments."
- Verify in the Stripe Dashboard (or document for the user) that the `account.application.deauthorized` event is subscribed on the webhook endpoint.

## Lower-priority cleanup (P2 — only if time permits in same pass)

### 6. Remove fabricated balance fallback in `stripe-get-balance`
- Either delete the `totalCollected * 0.85` fallback entirely and return `using_fallback: true` with `balance: null`, OR
- Surface "Estimated from local records — Stripe temporarily unavailable" warning prominently in the BalanceCard UI when `using_fallback: true`.

### 7. Add migration for `stripe_details_submitted`
- New migration adding `stripe_details_submitted boolean NOT NULL DEFAULT false` to `teams`.
- Update the `account.updated` webhook handler to also write `details_submitted` from the Stripe payload.
- Use it in the UI state machine to distinguish "submitted but not yet enabled" (Stripe is reviewing) from "not submitted" (tenant didn't finish the form).

## Files touched

- `src/pages/Dashboard.tsx` — return URL handler + polling
- `src/contexts/TeamContext.tsx` — extend `Team` interface
- `src/components/settings/PaymentMethodsSection.tsx` — remove `as any` casts
- `src/components/settings/BalanceCard.tsx` (or wherever the balance is rendered) — surface fallback warning if we keep it
- `supabase/functions/create-payment-checkout/index.ts` — hard-fail missing tenant/account
- `supabase/functions/stripe-connect-dashboard/index.ts` — role check
- `supabase/functions/stripe-webhook/index.ts` — `account.application.deauthorized` case
- `supabase/functions/stripe-get-balance/index.ts` — remove or label fallback
- New migration: `stripe_details_submitted` column

## Validation plan

1. **Manual end-to-end test on a real test account:**
   - Click Connect Stripe → complete Stripe Express onboarding in test mode → confirm we land on Settings → Payments with a toast and "Active" badge within ~10s.
   - Confirm the Dashboard URL param is stripped after handling.
2. **Failure-path tests:**
   - Call `create-payment-checkout` from a user with no team_member row → confirm 409 with clear error (use `supabase--curl_edge_functions`).
   - Call `stripe-connect-dashboard` as a viewer-role member → confirm 403.
3. **Webhook test:**
   - Use Stripe CLI to fire `account.application.deauthorized` against the test endpoint → confirm `stripe_account_id` is nulled out on the team row.
4. **Type safety:** confirm `tsc --noEmit` (handled by harness build) passes after removing `as any` casts.

## Out of scope (do separately)

- Partner payouts (Mercury vs Stripe Connect — separate decision still pending).
- Separate Connect webhook endpoint with its own secret (P3 — nice to have, not blocking).
- Stripe Connect Standard vs Express comparison (already on Express, no change planned).

## Risk

Low. All changes are additive or tightening checks. The biggest risk is the polling loop in #1 — bounded at 60s with 5s intervals (12 calls max) to avoid runaway requests if the webhook never fires.
