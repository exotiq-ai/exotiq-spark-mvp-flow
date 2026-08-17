# Exotics By The Bay — marketplace readiness audit + fixes

Audit run against live data for the tenant (16 publish-ready vehicles, Stripe live
account connected with charges + payouts enabled, platform fee confirmed at 10%,
terms accepted, logo set). The account is close — three blockers, a data-hygiene
problem, and two platform-level gaps found while checking their fleet.

## What we found

**Blocking go-live (one field)**
- Business address is empty on the team record. It is the only failing check in
  the go-live checklist, so the team cannot be flipped marketplace-visible.
- Team marketplace visibility is still off, and no marketplace review has been
  requested yet. Only Exotiq is publicly visible today.

**Data hygiene in their fleet**
- 10 vehicles were sent to trash (Aug 9 and Aug 14) but still carry
  `marketplace_visible = true`. Among them: 2021 BRABUS Rocket 800 GLE, 2016
  McLaren 650S, 2023 Porsche 911 T, 2025 Escalade ESV, Cadillac Escalade /
  Escalade V, Lamborghini Urus, Mercedes G63, GLE53, S580.
- 6 active vehicles have no model year (Escalade V, Corvette C8 Convertible,
  Lamborghini Urus, G63, GLE53, S580) — they render as "— Make Model" to renters.
- 3 vehicles list their pickup location as the literal text "office"; their only
  saved location is named "5001 Bridge st" with address "Office", no city/state.
  Vehicles labelled Miami all point at that single Tampa-area location record.
- Photo depth is thin: 10 of the publish-ready vehicles have exactly 1 photo
  (the hero). Passes the gate, but it is a weak listing page.
- One stale booking: BK-01475, still `confirmed`, ended 2026-04-30, on a vehicle
  that is now in the trash.
- Tenant-level mileage defaults are unset; per-vehicle mileage is inconsistent
  (125 mi with $4.99/mi overage on most, $1.50/mi on the Miami-labelled cars).

**Platform gaps (affect every tenant, surfaced by this audit)**
- The public marketplace RPCs (`public_team_fleet`, `public_vehicle_by_slug`,
  `public_vehicle_availability`, `public_vehicle_quote`, `create_marketplace_booking`)
  do not filter `trashed_at`. A trashed-but-visible vehicle stays listable and
  bookable — exactly the state this tenant is in today.
- Those same RPCs do not filter `is_historical`, so back-filled past bookings
  can participate in availability/conflict logic.

## Plan

### 1. Platform fixes (we do this — highest value, protects every tenant)
- Add `trashed_at IS NULL` to all public marketplace RPCs, including the
  availability check and the booking-creation path, so a trashed vehicle is
  never listed, quoted, or booked.
- Add `is_historical = false` to booking reads inside the availability and
  conflict paths of those RPCs.
- Extend the go-live checklist RPC with a visible warning row when a team has
  trashed vehicles still flagged marketplace-visible.

### 2. Tenant cleanup (we push through with their OK)
- Clear `marketplace_visible` on the 10 trashed vehicles.
- Close out BK-01475 (mark completed) so the calendar and fleet availability
  are clean.
- Set tenant mileage defaults (proposed: 125 mi/day, $4.99/mi overage) and offer
  the fleet-wide apply so the Miami cars stop reading $1.50/mi.

### 3. What Exotics By The Bay must do themselves
- Enter the business address in Settings (unblocks go-live).
- Add model years to the 6 vehicles missing them.
- Rename the "5001 Bridge st" location to a real pickup name with city/state,
  and add a second location if Miami is a genuine pickup point; then reassign
  the Miami-labelled vehicles. Replace "office" as a pickup label.
- Upload 4-6 more photos for the 10 single-photo listings (front three-quarter,
  rear three-quarter, interior, wheels).
- Confirm rate tiers are intentional — 3hr/6hr/multi-day are currently uniform
  ratios of the daily rate across the fleet.

### 4. Booking dry run (before they take a real renter)
Once the above is done: request marketplace review, flip visibility, then run a
full end-to-end on one vehicle — public listing loads, availability blocks their
own booked dates, quote returns the 10% fee plus state and processing fees,
Checkout charges both legs, booking lands `confirmed` in their Command Center,
then cancel and refund it. Verified on desktop and mobile.

## Technical notes
- Team `780f425c…`, slug `exotics-by-the-bay`, USD, America/New_York, live
  Stripe account `acct_1U45i2…`, no test account configured — so the dry run is
  either a small real charge that we refund, or we register a test Stripe
  account for them first. Worth deciding before step 4.
- RPC changes ship as one migration with `CREATE OR REPLACE FUNCTION`; no
  signature changes, so the renter app needs no update.
- Tenant data cleanup runs as scoped updates against that single `team_id`.
