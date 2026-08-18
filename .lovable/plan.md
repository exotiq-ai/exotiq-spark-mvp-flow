# Tenant → renter carryover: what's already covered, what's still missing

## Short answer on support email

Nothing to build there. `teams.support_email` exists, it's editable in Command Center under Settings → Business Profile, Exotics By The Bay already has `info@exoticsbythebay.co` saved, and every renter email uses it as Reply-To via `resolveRenterReplyTo`. The From display name is now the tenant business name.

What is *not* true today: that address is never shown as visible text anywhere — not in the email body, not on the renter site — and the renter app has no way to read it. That's the real gap.

## Gaps found (verified against the live backend)

1. **Operator contact isn't exposed to the renter app.** `public_team_by_slug` returns slug, name, logo, description, city, state, timezone, currency only. No support email. `public_booking_by_ref` returns no contact either, so a confirmation page can't show "Questions? Contact Exotics By The Bay."
2. **No operator phone exists anywhere.** `teams` has no phone column, and both EBTB and Exotiq location rows have `phone = NULL`. For a luxury handoff business, a phone number on the confirmation is table stakes.
3. **No pickup address or handoff instructions reach the renter.** Vehicles expose only `pickup_city` / `pickup_state`. The street address lives on the location row (EBTB's is literally named "5001 Bridge st" with address "Office"), and never leaves Command Center. Renters get a confirmation with no address and no instructions on where to meet.
4. **Mileage terms don't carry onto the booking.** Team defaults (EBTB: 125 mi/day, $4.99 overage) show on the vehicle detail RPC, but they aren't snapshotted onto the booking or returned by `public_booking_by_ref`, and no email mentions them. A renter can be charged overage against a number they never saw at confirmation.
5. **Cancellation policy is behavior, not text.** The 72-hour rule is enforced in code but isn't a field the renter app can read, so platform and renter copy can drift.
6. **Receipt email carries no operator detail.** Templates reference `OPERATOR_NAME` only; no pickup, no contact block, no mileage, no cancellation line.

## Plan

### 1. Operator contact fields
- Add `support_phone` to `teams`; add a phone input next to the existing support email in Business Profile, with light format validation.
- Backfill EBTB's phone once they give it; leave others null.

### 2. Pickup details as first-class tenant data
- Add `pickup_address` and `pickup_instructions` to `teams` (seeded from the default location's address where one exists), edited in Business Profile beside the support fields.
- Clean up EBTB's location record so the address is a real street address rather than "Office".

### 3. Expose all of it through the public RPCs
- `public_team_by_slug` gains `support_email`, `support_phone`, `pickup_city`, `pickup_state`, `pickup_address`, `pickup_instructions`.
- `public_booking_by_ref` gains the same contact + pickup fields, plus `mileage_limit_per_day`, `mileage_overage_rate`, and `cancellation_policy` (platform standard text). All additive columns — Claude's existing calls keep working.

### 4. Snapshot mileage on the booking
- Add `mileage_limit_per_day` and `mileage_overage_rate_cents` to `bookings`, written at creation in `create_marketplace_booking` from the vehicle (falling back to the team default), so terms are frozen at booking time.

### 5. Put it in the renter emails
- Extend the confirmed-receipt and payment-approved templates with an operator block: business name, support email, support phone, pickup address and instructions, mileage allowance and overage rate, and the cancellation line.
- Every caller (`rent-payment-webhook`, `rent-approve-booking`, `rent-payment-scheduler`, `rent-extend-booking`, `rent-cancel-booking`, `rent-refund-booking`) passes the new variables. Blank fields render as omitted rows, never as empty labels.

### 6. Readiness surfacing in Command Center
- Extend the Marketplace readiness checklist with support email, support phone, pickup address, and mileage defaults — each showing the renter-visible consequence of leaving it blank.
- Add a "What renters see" preview panel rendering the exact operator block that goes into emails and the confirmation page.

### 7. Handoff note for Claude
A short copy-paste listing the new RPC fields, their nullability, and the fact that mileage and cancellation text should be read from `public_booking_by_ref` rather than hardcoded.

## Verification
Live quote → booking → receipt on the EBTB storefront: confirm the receipt shows tenant name, their support email and phone, the Tampa pickup address, 125 mi/day with $4.99 overage, and the 72-hour cancellation line — and that a tenant with those fields blank still renders a clean email with no empty rows.
