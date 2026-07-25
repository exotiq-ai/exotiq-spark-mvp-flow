
# Pre-Launch QA Plan (2026-07-25 handoff)

Grounded in the 29-item consolidated handoff. Items already fixed in prior turns are marked ✅ and skipped. Everything below is Lovable (SPARK / Command Center / backend) unless flagged as Claude (renter app) or Gregory decision.

## Already landed (context — skip)
- ✅ #11 cancel/refund gated on PI presence (`isPaidOrCaptured` + edge fns)
- ✅ #18/#19 identity-create-session token gate + strict email eq; rent-create-booking email regex + `.eq`
- ✅ Red-team F1–F7 (persistent rate limit, availability parity, invalid tiers 400, hold-expiry cron, public buckets)
- ✅ `booking_has_captured_leg` SQL helper + `expire_overdue_payment_bookings` excludes captured legs

---

## Phase 1 — Finish Cluster A (webhook + retry) — LAUNCH BLOCKERS
Covers handoff #1, #2, #3, #4, #8, #9, #15.

1. **`rent-payment-webhook` — never drop a captured session.** In `checkout.session.completed`, when the status-guarded UPDATE matches 0 rows:
   - Persist `operator_payment_intent_id` unconditionally (raw UPDATE by `booking_ref`, no status filter).
   - `opsAlert(db, ref, 'renter_payment_after_terminal_state', {status, operatorPi})`.
   - Auto-refund the rental leg with `reverse_transfer: true`, idempotency `auto-refund-rental-${ref}`.
   - Call `stripe.checkout.sessions.expire()` on any still-open session for the same booking on cancel / expiry paths.
2. **Exotiq-leg retry surface.** Add an ops-callable `rent-retry-exotiq-leg` (service-role, JWT-gated) that:
   - Requires `operator_payment_intent_id` set and `exotiq_payment_intent_id` NULL.
   - Creates a fresh Exotiq PI with attempt-scoped idempotency key `exotiq-leg-${ref}-${attempt}` (new `exotiq_leg_attempt` int column, default 0).
3. **CancelBookingCard copy (renter app)** — hand to Claude (needs `rental_captured` in `public_booking_by_ref`; we add it here, see Phase 4).

## Phase 2 — Command Center money integrity — LAUNCH BLOCKERS
Covers #10, #12, #13, #14.

4. **`EnhancedBookingDialog` / `EditBookingDialog`:** for `booking_source='marketplace'` in `pending_payment` | `confirmed`, block edits to `total_value`, `daily_rate`, `start_date`, `end_date`, `pickup_time`; allow only notes / operator-internal fields. Single guard helper reused by both dialogs.
5. **Decline / cancel wiring:** any operator decline/cancel on a marketplace booking with a captured leg (via `isPaidOrCaptured`) routes to `rent-refund-booking` and results in `refunded` / `declined`, never a bare `cancelled`. (Partial wiring landed last turn — audit + finish for both dialogs and bulk actions.)
6. **`PaymentTracker`:** treat marketplace `paid_at`/PI presence as authoritative — exclude those rows from Pending Payments; replace "Collect Deposit / Balance" CTAs with a two-leg receipt view.

## Phase 3 — Fleet delete safety
Covers #5.

7. **DB-level guard first:** `bookings.vehicle_id` → `ON DELETE RESTRICT` (subject to your earlier approval; migration will surface conflict rows first, then convert).
8. **UI:** batch "Delete Selected" in `FleetContext.deleteVehicles` routes through `trashVehicle` (soft) with the same typed confirmation as single-vehicle delete.
9. **Ledger continuity:** webhook mirrors marketplace legs into `payments` (idempotent on `stripe_payment_intent_id`) so PI ids survive booking loss.

## Phase 4 — Deposit hold + ID-drip (Gregory rulings)
Covers #6, #7.

10. **Deposit config migration:** `teams.default_deposit_cents` + `vehicles.deposit_override_cents` + SQL `resolve_deposit_cents(vehicle_id)`; Command Center UI in Tenant Settings (default) and Vehicle rate card (override).
11. **Deposit mechanism:** platform-side manual-capture PI using the card saved from Checkout (`setup_future_usage`). New operator action `stripe-place-hold` (`customer` + `payment_method` + `off_session: true, confirm: true`), records `hold_status`, exposes Capture / Release in `PaymentTracker`. No Stripe.js on renter side.
12. **Post-payment ID drip:** on `checkout.session.completed` (fully paid), if `customer.identity_status !== 'verified'`, promote booking → `pending_documents` and enqueue renter drip "Payment received — verify your ID + insurance" (insurance stub until Claude ships).
13. **`identity-webhook` → session verified:** promote that customer's `pending_documents` marketplace bookings back to `pending_payment` (if unpaid) or `confirmed` (if paid), insert team notification. Command Center approval queue accepts `requested` (already done) + surfaces `pending_documents` for awareness.

## Phase 5 — Schema + reporting hygiene
Covers #17, #20, #21, #22, #23, #27.

14. Explicit migration adding `bookings.operator_payment_intent_id` / `exotiq_payment_intent_id` (idempotent `ADD COLUMN IF NOT EXISTS`) so migrations rebuild cleanly; regen types.
15. Drop `DEFAULT 0` on `create_marketplace_booking(_platform_fee_cents, _protection_total_cents)` → required.
16. Backfill `teams.platform_fee_percent` for every marketplace-visible team to 10.00 (unless contracted otherwise); change column default to 10.00; `approve_marketplace_request` rejects fee=0 on visible teams.
17. Fix `payment_due_at` double-tz shift in the trigger — drop the naive `::timestamp` cast; format email `{{PAYMENT_DEADLINE}}` with explicit IANA zone.
18. `useMarginData`: exclude `payment_stripe_mode='test'`; expand `REVENUE_EXCLUDED_STATUSES` to include `requested`, `pending_documents`, `pending_payment`, `payment_expired`, `refunded`; `RevenueBySourceCard` uses `countsForRevenue`.

## Phase 6 — Observability
Covers #28.

19. Rewrite `uptime-check` to probe (a) `https://book.exotiq.rent` for a real marker string, (b) shallow `rent-checkout` health, (c) shallow `rent-payment-webhook` health. Schedule every 5 min via `pg_cron`. Ensure ops-alert table columns exist so partial-failure alerts persist and page a human on `renter_payment_partial_failure`.

## Hand-back to Claude (`exotiq-rent` repo)
- #15 CancelBookingCard copy (after Phase 4 exposes `rental_captured`).
- #16 delivery extra pre-selection.
- #24 `adaptTeam` map `platform_fee_percent` (also expose on `public_team_by_slug` from our side).
- #25 pickup_time in `public_booking_by_ref` — SPARK adds field to RPC; Claude wires it in ConfirmationScreen + calendar invite.
- #26 PayStep copy ("Request your reservation" + "Estimated total — nothing charged yet").
- #29 `expected_total_cents` agreement check (renter sends; SPARK's `rent-create-booking` compares vs re-run `public_vehicle_quote` and returns 409 with both figures on drift).

---

## Technical details

**Cluster A webhook flow (Phase 1 §1):**
```text
checkout.session.completed
 ├─ locate booking by booking_ref (no status filter)
 ├─ UPDATE ... SET operator_payment_intent_id = pi.id WHERE booking_ref = $1 AND operator_payment_intent_id IS NULL
 ├─ if booking.status NOT IN (pending_payment, confirmed):
 │    ├─ opsAlert('renter_payment_after_terminal_state', {status, pi})
 │    └─ refunds.create({payment_intent: pi.id, reverse_transfer: true},
 │                       {idempotencyKey: `auto-refund-rental-${ref}`})
 └─ else: existing confirm-if-fully-paid path
```

**Marketplace edit lock (Phase 2 §4):**
Single helper in `src/lib/bookingEditGuards.ts`:
```ts
export function isMarketplaceLocked(b: Booking) {
  return b.booking_source === 'marketplace'
      && (b.status === 'pending_payment' || b.status === 'confirmed');
}
```
Used by `EnhancedBookingDialog`, `EditBookingDialog`, and the underlying update mutation (defense-in-depth).

**Deposit resolution (Phase 4 §10):**
```sql
create or replace function public.resolve_deposit_cents(_vehicle_id uuid)
returns bigint language sql stable as $$
  select coalesce(v.deposit_override_cents, t.default_deposit_cents, 100000)
  from vehicles v join teams t on t.id = v.team_id
  where v.id = _vehicle_id;
$$;
```

**Rollout order:** 1 → 2 → 5 → 3 → 4 → 6. Phases 1, 2, 5 are independent and can land as parallel PRs; Phase 3's `ON DELETE RESTRICT` needs a pre-scan for existing violations.

## What I need from you
1. Approve this ordering (or reorder).
2. Confirm Phase 3 §7 — you previously OK'd `ON DELETE RESTRICT`; still good?
3. Confirm Phase 4 §11 deposit mechanism (platform-side manual-capture PI with the saved card) vs. any alternative you want.
