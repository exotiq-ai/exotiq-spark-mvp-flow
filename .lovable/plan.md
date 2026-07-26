## Review of Claude's deposit handoff

Claude's plan is accurate and complete. I verified the two bugs he called out:

- `stripe-capture-hold` (lines 42–53) and `stripe-release-hold` (lines 38–49) both still derive `team_id` from `team_members` on the caller — same class of bug I already fixed in `stripe-create-hold`. Confirmed.
- The tenant-default gap on `teams.default_deposit_cents` matches what we saw when building the CC settings UI: no tenant has a default set, so blank per-vehicle overrides silently resolve to the $1,000 platform floor.

One thing to flag, not disagree with: the M6-D1 rev 2 decision (deposits are operator-owned, no PM cloning, setup-mode Checkout on the connected account) means every renter has to complete a second Stripe screen 72h before pickup. That's the right call for money-safety, but it will produce support volume the first few weeks — worth pre-writing a canned "why am I being asked for a card again?" reply for tenants. Not a code change, just an ops heads-up.

Proceeding with all five workstreams below.

---

## 1. `stripe-create-hold` — add off-session confirm path

Keep the existing unconfirmed / client-secret path as fallback (card-present at counter). Add an off-session branch used by the CC "Place hold" button:

- New optional body param `mode: "off_session" | "client_secret"` (default `client_secret` for back-compat).
- In `off_session` mode: list PMs on the operator's connected customer (`stripe.paymentMethods.list({customer, type:"card"}, {stripeAccount})`). If none → return `409 {error:"no_card_on_file"}`.
- Create PI with `payment_method`, `off_session: true`, `confirm: true`, `capture_method: "manual"`.
- Add `bookings.deposit_hold_attempt integer not null default 0` and use `deposit-hold-{booking_ref}-{attempt}` as `idempotencyKey`. Bump attempt on each retry.
- Catch `StripeCardError` with `code === "authentication_required"` → return `402 {error:"authentication_required", requires_action:true}` so the CC can show "renter must confirm" and re-send the setup/hold email instead of marking the hold placed.
- Persist the resulting PI into `payments` with `hold_status` reflecting `requires_action` vs `requires_capture`.

## 2. New function: `stripe-create-deposit-setup-session`

Setup-mode Checkout (never Payment Link) on the connected account so the renter's card lands on the operator's customer:

- Input: `{ booking_id }`. Derive team + vehicle from booking (same booking-scoped auth pattern as create-hold).
- Ensure a Stripe `Customer` exists on the connected account for that renter (email match, else create). Store the connected-account customer id on the booking (new column `bookings.operator_stripe_customer_id text`) so #1 can look up PMs without re-searching.
- `stripe.checkout.sessions.create({ mode:"setup", payment_method_types:["card"], customer, success_url, cancel_url, metadata:{booking_ref, purpose:"deposit_card_on_file"} }, { stripeAccount })`.
- Return `{ url }` for the email link and the CC "Request deposit card" button.

## 3. Renter email + scheduler

- New `depositCardRequested` template in `send-renter-email` with `{{OPERATOR_NAME}}`, `{{VEHICLE_SHORT}}`, `{{DEPOSIT_AMOUNT}}`, `{{SETUP_URL}}`. Uses `resolveRenterReplyTo` (tenant support_email).
- Extend `rent-payment-scheduler` (pg_cron jobid 10) with a T-72h sweep over `confirmed` marketplace bookings where `operator_stripe_customer_id` is null OR no card is on file yet, calling `stripe-create-deposit-setup-session` and sending the email. Idempotent via a `deposit_card_requested_at` timestamp column.

## 4. Command Center — Deposit panel

New `DepositPanel.tsx` inside `EnhancedBookingDialog`, visible only for `confirmed` marketplace bookings:

- Line 1: resolved deposit (via `supabase.rpc('resolve_deposit_cents',{_vehicle_id})`) — never editable here.
- Line 2: card-on-file state (green check if PM found, "Not on file" otherwise). Manager+ can click **Request deposit card** → calls #2, toasts success.
- Line 3: hold state + authorization age. If `requires_capture`, show days since `created` and warn at ≥5 days ("expires in Xd"). Buttons **Place hold** (#1 off_session), **Release**, **Capture** — already wired to existing functions.
- Handle `authentication_required` response by showing "Renter must confirm — link re-sent" and auto-triggering #3.

Also add a note: extended authorizations (30-day) on MCC 7512 are worth confirming with Stripe for these connected accounts — out of scope for code, but I'll drop a TODO on the panel.

## 5. Fix pre-existing team-scoping bugs

`stripe-capture-hold` and `stripe-release-hold`: replace the `team_members`-derived team lookup with the same pattern as fixed `stripe-create-hold`:

1. Load booking by `booking_id` → get `team_id` + `vehicle_id`.
2. Assert `team_members` membership of the caller for **that** booking's `team_id`.
3. Load the team's `stripe_account_id` from the booking's team, not the caller's.

## 6. Tenant default backfill + marketplace-visibility gate

- One-off SQL: `UPDATE teams SET default_deposit_cents = 100000 WHERE default_deposit_cents IS NULL;` (safe floor; tenants adjust in CC).
- Add trigger `enforce_deposit_source_on_marketplace_visible`: when flipping `teams.marketplace_visible = true`, require `default_deposit_cents IS NOT NULL`. When flipping `vehicles.marketplace_visible = true`, require `resolve_deposit_cents(id) IS NOT NULL`. Mirrors the platform-fee gate.
- Backfill note for `fredo-d-lima`: their 21 vehicles all resolve to the $1,000 floor today. Inert while unlisted; the trigger will force a real default before they can be flipped visible.

## 7. Repo hygiene (Claude's standing ask)

Not a code change from this plan, but I'll also commit the currently-deployed money functions (`rent-checkout`, `rent-payment-webhook`, `rent-cancel-booking`, `rent-refund-booking`, `rent-approve-booking`, `rent-retry-exotiq-leg`, updated `send-renter-email`, updated `identity-webhook`, plus the new `stripe-create-deposit-setup-session` and revised `stripe-create-hold` / `-capture-hold` / `-release-hold`) to `supabase/functions/` so a redeploy from `main` can't revert them.

## Verify

- Off-session hold on a test booking with a saved PM → PI lands `requires_capture` under `deposit-hold-BK-XXXX-1`.
- Force `authentication_required` (Stripe test card `4000002500003155`) → function returns 402, CC surfaces "renter must confirm", email re-sends.
- Setup session on a fresh renter → PM appears on the connected account's customer; second hold call succeeds off-session.
- Manually run capture and release on a different booking with a two-team user → both succeed against the booking's team, not the caller's.
- `UPDATE teams SET marketplace_visible=true` on a tenant with null default_deposit_cents → rejected by trigger.

## Out of scope

- Extended-authorization (30-day) enrollment with Stripe — ops task, not code.
- Anything in `exotiq-rent` (renter checkout copy already handled per Claude's note).
