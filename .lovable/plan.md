# Reply to Claude — 2026-08-18 outstanding items

## 1. §8 create-side: the 409 is correct, the probe is a false positive

Verified against live data. On `exotiq/2017-audi-s8`, the November booking Claude probed against is **BK-02595 (direct, confirmed)** and it starts at **03:00 local (America/Phoenix)** on Nov 13, not 10:00. `create_marketplace_booking` already builds instants (not end-of-day) and compares with `tstzrange(..., '[)')`, so:

- return Nov 13 10:00 vs start Nov 13 03:00 → genuine overlap → 409 (correct)
- return Nov 13 06:00 vs start Nov 13 03:00 → genuine overlap → 409 (correct)

Claude's own acceptance rule ("return 5 PM + pickup 10 AM same day 409s") is exactly what fired. No create-side bug to fix.

The real residual is a **contract gap**, and that is what we will fix:

- `public_vehicle_availability` returns day granularity only (`busy_start` / `busy_end` dates). It marks the turnover day bookable-as-a-checkout day but never says *what time the car is out*, so the renter UI cannot know that a 10:00 return collides with an 03:00 pickup.
- The marketplace booking's **return time is not an input** — `create_marketplace_booking` reuses `_pickup_time` for both ends, so the renter can never choose an earlier return to make a turnover work.

Work:
1. Extend `public_vehicle_availability` with the actual instants per busy block (`busy_start_at`, `busy_end_at`, plus the team timezone) — additive columns, existing date columns unchanged so Claude's current render keeps working.
2. Add an optional `_return_time` parameter to `create_marketplace_booking` (defaults to `_pickup_time`, so today's callers are unaffected) and thread it through `rent-create-booking` as an optional `return_time` body field.
3. Reply to Claude with the instants contract plus the guidance: a same-day turnover is bookable only when the requested return instant is at or before the next booking's start instant; the RPC now returns the data needed to enforce that in the picker instead of discovering it at 409 time.

Acceptance (re-run on fresh dates, not the Nov 13 case): return 10 AM + next pickup 10 AM same day succeeds; return 5 PM + next pickup 10 AM same day 409s.

## 2. EBTB pickup address

Confirmed the location row is field-swapped: `name = "5001 Bridge st"`, `address = "Office"`, `zip_code` empty. That is why renters see "Office, Tampa, FL".

- Correct the location row (name → the operator-facing label, address → 5001 Bridge St, add zip).
- Re-seed the team default pickup address/instructions from the corrected row and re-snapshot nothing retroactively except open, unpaid bookings.
- `support_phone` already exists on `teams` and is editable in Business Profile; backfill it as soon as EBTB supplies the number.

## 3. Goodwill refunds on marketplace bookings

Agreed with the read: `stripe-create-refund` hard-409s marketplace bookings by design.

- Now: Command Center copy on marketplace bookings states that goodwill refunds go through Exotiq (platform admin refunds the rental leg), so nobody hunts for a button that must not exist.
- Backlog (not this pass): an operator-initiated, rental-leg-only refund action with its own audit trail.

## 4. Identity webhook dedupe — not shipped

Verified: `identity-webhook` has **no** claim-insert. It reads `identity_verifications` by session id and increments `attempt_count` with no event-level guard, so a double-delivered `requires_input` double-counts and can trip the 3-attempt manual-review rule early. `rent-payment-webhook` already does this correctly with a `(consumer, stripe_event_id)` claim insert.

Fix: add the same claim-insert to `identity-webhook` with `consumer = 'identity'`, ack-and-exit 200 on unique violation, before any state mutation.

## 5. Standing confirmations

- (a) **State fees**: platform-maintained, tenant read-only — that is the shipped state (`public.state_rental_fees`, no tenant-editable UI). Per-team CC editing is deliberately not built.
- (b) **Drip templates** read tenant name from the DB (`{{OPERATOR_NAME}}` sourced from `teams`), no hardcoding.
- (c) **Invariant holds**: "Record payment" is ledger-only; only Stripe events write booking payment fields.

## Technical notes

- Files/objects touched: `public_vehicle_availability`, `create_marketplace_booking` (both via migration), `supabase/functions/rent-create-booking`, `supabase/functions/identity-webhook`, the EBTB `locations` + `teams` rows (data update, not migration), and marketplace refund copy in the booking dialog.
- All SQL changes are additive with defaults; no existing caller signature breaks.
