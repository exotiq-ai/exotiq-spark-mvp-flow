# M6 — Revised design after Gregory's 2026-07-23 rulings

Locks in the three answers, folds them back into the M6 plan, and lists exactly what Claude (exotiq-rent) and Lovable (spark/edge) each own before M6a code starts. Review only — no code this turn.

## Confirmed rulings

- **M6-D1 (rev):** One card entry, two charges. **Rental first, on-session, inside Checkout** as a **destination charge** (`on_behalf_of` + `transfer_data.destination = <operator connected acct>`), so the renter's statement shows the **operator's descriptor** and funds settle on the operator. Card is saved platform-side via `setup_future_usage: 'off_session'`. Webhook then charges **Exotiq fee + protection off-session, second, on the platform account**, with `statement_descriptor_suffix: 'EXOTIQ RENT'`. Checkout is **card-only** (`payment_method_types: ['card']`).
- **PM cloning:** removed from the payment path. Survives only as an M6c nicety for the deposit-hold flow (platform → connected), so `stripe-create-hold` can reuse the saved card at pickup instead of re-prompting.
- **M6-D3 fn choice:** **evolve `rent-checkout` in place.** No `rent-create-payment` function. Reuse existing `bookings.exotiq_payment_intent_id` / `operator_payment_intent_id` columns — the M6a migration adds no new PI columns (only `payment_due_at`, `paid_at`, and expiry plumbing).
- **M6-D7 (new):** Refund default <72h: **operator rental non-refundable.** Operators can override upward (more generous) later; platform never overrides downward. Booking fee + protection remain non-refundable per M6-D5.

## What changes vs the original spec

1. `rent-checkout` (already deployed) is repurposed, not replaced:
   - Drops the direct-charge-on-connected path.
   - Creates one hosted Checkout Session on the **platform** account with `mode: 'payment'`, `payment_method_types: ['card']`, `customer_creation: 'always'`, `payment_intent_data: { on_behalf_of, transfer_data: { destination }, setup_future_usage: 'off_session', capture_method: 'automatic', metadata: {...} }`.
   - Persists the resulting operator PI id into the **existing** `operator_payment_intent_id` column.
   - Returns hosted URL, not raw client secrets. Frontend no longer double-loads Stripe.js.
2. New webhook (or extension of the existing one) handles `checkout.session.completed`:
   - Reads the saved payment_method off the session's customer.
   - Creates the platform PI (fee + protection) with `off_session: true, confirm: true, payment_method: <pm>, customer: <platform_customer>, statement_descriptor_suffix: 'EXOTIQ RENT'`.
   - Writes the id into `exotiq_payment_intent_id`.
   - Transitions booking → `confirmed` **only when both PIs are `succeeded`.** Partial-failure: rental captured + Exotiq off-session declined → status stays `pending_payment`, ops alert fires, retry surface shown on confirmation page.
3. No PM cloning in the checkout webhook. Cloning code (if any lingers from the earlier design) is removed.
4. `stripe-create-hold` (M6c) gains a "prefer saved platform PM, clone to connected on demand" branch. This is the only surviving cloning path.
5. Refund engine (M6c) ships with the M6-D7 default; operator override lives behind a per-tenant setting to be scoped later — not required for M6c launch.

## What still stands from the original plan

- Sandbox-first, config-not-code flip (§2 of the spec).
- 48h payment window with pickup-time clamp (`min(approved_at + 48h, pickup_at - 2h)`).
- Per-tenant mode-aware Stripe key + connected account resolution.
- `stripe_webhook_events` dedup; state driven by "both PIs succeeded", not by a single event.
- Guest checkout; renter customer created on platform account only (operator side gets the customer via `on_behalf_of`, no cloning needed for payment).
- Descriptor: verify `EXOTIQ RENT` (space, no dot) against the platform account's statement descriptor rules before hardcoding; use `statement_descriptor_suffix`, not full override.
- Out-of-scope tags unchanged (extras at pickup, multi-currency post-M6, payouts scheduling, rebrand).

## Ownership split for the next handoffs

**Claude / exotiq-rent (frontend):**
- Confirmation page `pending_payment` state: approved copy, countdown to `payment_due_at`, "Pay now" CTA → calls evolved `rent-checkout`, redirects to `session.url`.
- Confirmation page `confirmed` receipt: two line items (operator rental / Exotiq fee + protection), with the note that they'll appear as two separate statement lines.
- Cancel affordance with window-aware copy tied to M6-D5 + **M6-D7** (no partial rental refund <72h).
- Decline-protection legal copy still pending Gregory's pass (blocks M6c, not M6a/b).

**Lovable / spark (backend, when M6a patch arrives):**
- Apply M6a migration (`payment_due_at`, `paid_at`, expiry status handling — no new PI columns).
- Create a **test-mode Express Connect account** for the Exotiq team and store its id in a mode-aware slot (e.g. `teams.stripe_test_account_id` if the patch adds it, otherwise the helper's config map).
- Register a **test-mode webhook endpoint** at the evolved `rent-checkout` (or the shared webhook the patch designates) and drop its `whsec_…` into edge env.
- Confirm `STRIPE_SECRET_KEY` in edge env is the **test key** for the QA window (currently the IDV test key — verify it's the platform account's `sk_test`, not a restricted key).
- Add a guard so nothing in test mode writes to `payments` / `payouts` / margin rollups; QA traffic must not pollute the operator ledger.

**Gregory (before M6e only):**
- Final decline-terms + refund legal copy.
- Live-flip go/no-go after the ~$1 real-card descriptor check (mirroring the 2026-07-21 $1 hold test).

## Open items to close before code

1. **Test Connect account creation** — confirm this happens via the spark patch (API-created Express) vs manually in the Stripe test dashboard. Preferred: API in the patch so it's reproducible per tenant.
2. **Test webhook endpoint URL** — confirm it's the evolved `rent-checkout` function URL or a separate `stripe-webhook` handler. The existing `stripe_webhook_events` table implies a shared handler; if so, the patch should route `checkout.session.completed` there rather than into `rent-checkout` itself.
3. **Operator-refund override storage** — pick a location now (probably `teams.refund_policy_json`) so M6c doesn't have to invent it late. Not blocking M6a.
4. **Descriptor validation** — quick check against the platform account's descriptor rules (22 chars, allowed punctuation) for `EXOTIQ RENT`. If rejected, fall back to `EXOTIQRENT`.

Once Claude's exotiq-rent PR draft lands and the M6a patch is on its way, I'll turn the "Lovable" bullet list into the concrete apply-and-verify handoff (test account creation, webhook registration, secret verification, ledger guard) and reconcile against the current `rent-checkout` deployment.
