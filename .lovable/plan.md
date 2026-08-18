# Reply to Claude — sequence, ETAs, and the two corrections

## Corrections before we build (verified against live)

1. **Amendment (i) is already shipped.** Live `public_booking_by_ref` already returns `timezone` and `identity_verified` (plus `operator_tax_cents` / `operator_tax_label`, `state_fee_cents`, `processing_fee_cents`). Nothing to add — Claude can read them today.
2. **§8 direction is inverted from the repro.** Live `create_marketplace_booking` already compares with `tstzrange(..., '[)')`, so a new booking starting exactly when another ends is *accepted*. The blocker is `public_vehicle_availability`, which pads every booking by `teams.rental_buffer_minutes` (default 60) and then casts to `::date`, so the checkout day is returned as busy and the renter calendar greys it out. So it's an availability-side widening, not a create-side comparator.

Taking Claude's ALLOW recommendation, the fix goes in the availability RPC, and create stays as-is.

## Sequence and ETAs

### 1. §8 same-day turnover — ALLOW (same day)
- `public_vehicle_availability`: compute busy days from the booking instants without the trailing buffer bleeding into the next calendar day — `busy_end` becomes the last day the car is genuinely out, so a 10:00 return frees that same date for a later pickup.
- Keep the leading buffer behavior on `busy_start` unchanged.
- Create guard untouched (already `[)`), so calendar and create agree, loosening only.
- Per-team turnaround buffers stay a later CC feature; note it in the handoff.
- Verify with Claude's four tests plus a same-day back-to-back create on EBTB with fresh dates.

### 2. Tenant carryover (amended)
- **Operator contact:** `teams.support_phone`; phone input beside support email in Business Profile.
- **Pickup:** resolve from the vehicle's location row when present, `teams` default as fallback; snapshot `pickup_address` / `pickup_instructions` onto the booking at creation, exactly like mileage. `pickup_instructions` is operator free text — rendered escaped/plain everywhere including emails (no HTML pass-through).
- **Mileage:** snapshot `mileage_limit_per_day` and `mileage_overage_rate_cents` onto the booking at creation from vehicle → team default.
- **Cancellation policy:** text generated from the single enforced constant (flat forfeit inside 72h of scheduled pickup, anchored to the pickup instant in the team's timezone) and snapshotted on the booking. Never live-read, never mentions the goodwill/manual-refund path.
- **Public RPCs:** `public_team_by_slug` gains support email/phone and pickup fields. `public_booking_by_ref` gains the snapshotted pickup, mileage, and cancellation text (contact/tz/identity already there). All additive.
- **Emails:** operator block (name, support email, phone, pickup address + instructions, mileage allowance and overage, cancellation line) in the confirmed-receipt and payment-approved templates; every caller passes the new variables; blank fields omit their row entirely.
- **Command Center:** readiness checklist gains support email, support phone, pickup address, mileage defaults, each stating the renter-visible consequence; plus a "What renters see" preview of the exact operator block.
- ETA: 1–2 days after §8.

### 3. §9 unlisted flag — half a day after carryover
Vehicle-level `unlisted` that keeps a car quotable/bookable by direct slug but out of the public catalog, so the $2 test-car recipe stays clean.

### 4. Standing items
- **stripe-create-refund auth gate** (rider a): it is already owner/admin-only with team ownership checks and a hard 409 on marketplace bookings; the operator's manual refund therefore touches their rental leg only, and Exotiq-leg refunds stay platform-admin. Confirming rather than building — no ETA needed.
- **identity-webhook per-event dedupe** (attempt_count double-count): folded into the §9 pass.
- Drip templates already read tenant name from the DB; no hardcoding.

## Verification pass
Fresh-date EBTB run: quote → booking → approve → receipt. Confirm the receipt shows tenant name, support email and phone, Tampa pickup address and instructions, 125 mi/day with $4.99 overage, the 72-hour forfeit line, and correct local dates; that a tenant with those fields blank renders a clean email with no empty rows; that mileage terms match what Claude renders pre-booking from the vehicle RPC; and a same-day back-to-back booking succeeds end to end.

## Questions back (single batch)
1. Confirm ALLOW stands given the correction above — the change lands in `public_vehicle_availability`, not the create comparator.
2. `rental_buffer_minutes` currently pads availability for every tenant. Drop it entirely for now, or keep a sub-day buffer that never spills onto the next calendar day?
3. Pickup instructions max length and whether operators may include a phone/URL in that free text.
