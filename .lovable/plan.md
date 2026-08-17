# Exotics By The Bay — Marketplace Go-Live Audit

Audited live data for team `Exotics By The Bay` (slug `exotics-by-the-bay`, Tampa / America/New_York, USD).

## Current state (verified)

Green:
- Marketplace request submitted today, status `requested`, awaiting super-admin approval.
- Readiness RPC returns `ready: true`, `real_ready: true`, test mode off, 16 publish-ready vehicles, 0 trashed-but-visible.
- Stripe Connect live account attached: charges enabled, payouts enabled, onboarding complete.
- Platform fee 10% confirmed; terms accepted; logo, business name, address, owner email all set.
- Availability RPC correctly excludes historical bookings and applies the 60-min buffer.

Blockers / risks found:
1. **Pickup city/state are blank.** The tenant's only location record (`5001 Bridge st`) has empty `city` and `state`. All 16 marketplace vehicles point at it, so `public_team_by_slug` and `public_vehicle_by_slug` both return null `pickup_city` / `pickup_state` to the renter site.
2. **Vehicle `location` text is inconsistent** — 12 say `Tampa`, 2 say `Miami`, 3 say `office`. Two of those (Corvette C8, Rolls-Royce Dawn era rows) also read oddly next to a Tampa-only operation.
3. **Missing model years.** The marketplace-visible Corvette C8 Convertible has no `year`; titles will render without a year.
4. **Thin galleries.** Five visible vehicles have only 1 usable photo (R8 Spyder, McLaren GTS, BRABUS G 800, Porsche GT3, Rolls-Royce Dawn). Detail page carousel will look empty.
5. **State fee is hardcoded to $5.89/day in `public_vehicle_quote`,** with an in-code comment saying it breaks for operators outside the original jurisdiction. This is the first Florida operator going live, so every EBTB quote will charge a non-Florida daily surcharge.
6. **`public_team_fleet` hardcodes `min_rental_days = 1`** — no per-vehicle minimum is honored on the marketplace listing.
7. **No public description** on the team, so the operator page has no blurb.

## Plan

### Phase 1 — Tenant data fixes (we do these)
- Fill `city = Tampa`, `state = FL` on the tenant's default location.
- Normalize the `location` text on the 16 visible vehicles to the real pickup market; move any genuinely Miami-based cars to their own location record or set them non-visible for launch.
- Backfill the missing model year(s).
- Add a short public description for the operator page.
- Flag the five single-photo vehicles to the operator (they upload; alternatively we hold those five back from launch).

### Phase 2 — Jurisdiction fee correctness (decision needed)
Confirm the Florida daily surcharge amount, then replace the hardcoded 589 cents with a `state_fees` lookup keyed by pickup state, defaulting to the current value so no existing tenant changes. Quote, `create_marketplace_booking`, and the checkout snapshot all read from the same source.

### Phase 3 — Listing fidelity
Return the real per-vehicle minimum rental days from `public_team_fleet` instead of a hardcoded 1.

### Phase 4 — Approve and verify live
- Flip `marketplace_request_status` to `approved` and `marketplace_visible` to true from the Super Admin marketplace tab.
- Re-run the public RPC set as anonymous: team page, fleet (expect 16), one vehicle detail, availability window, quote for a 3-day rental.
- Run one end-to-end dry booking on the live site with a real card and immediately refund, confirming: destination charge lands on the operator's connect account, exotiq fees split correctly, booking appears in the tenant's dashboard, renter emails deliver.

Nothing is flipped visible until Phases 1 and 4's dry run pass.

## Message for Claude (copy/paste)

```
Exotiq marketplace — Exotics By The Bay go-live (team slug: exotics-by-the-bay)

Backend status: the operator is Stripe-live (charges + payouts enabled), platform
fee 10% confirmed, 16 vehicles pass readiness. The team is still
marketplace_request_status='requested', so all public_* RPCs return EMPTY until we
approve. That is expected — don't treat empty results as a bug before we flip.

Things on the renter site (exotiq.rent) to confirm/handle:

1. pickup_city / pickup_state can come back NULL from public_team_by_slug and
   public_vehicle_by_slug. We're backfilling this tenant's location, but please make
   the UI degrade gracefully (fall back to team name / hide the location line) rather
   than rendering "null" or an empty chip.
2. year can be NULL on a vehicle. Titles must render as "Chevrolet Corvette C8
   Convertible" without a leading blank or "undefined".
3. photos from public_vehicle_by_slug may contain a single item. The gallery/carousel
   must look intentional with 1 photo (no empty thumbnails strip, no arrows).
4. min_rental_days from public_team_fleet is currently hardcoded to 1. We're changing
   it to the real per-vehicle value shortly — read it from the RPC, don't hardcode.
5. Quote fee lines: public_vehicle_quote returns state_fee_cents and
   processing_fee_cents separately from platform_fee_cents and
   protection_total_cents. The state fee is about to become jurisdiction-aware
   (currently a flat $5.89/day). Render whatever the RPC returns and label it
   generically ("State rental fee") — do not compute or hardcode it client-side.
   grand_total_cents is authoritative; never sum locally.
6. Availability: public_vehicle_availability already excludes historical bookings and
   applies a 60-minute buffer, returning busy_start/busy_end as DATES with the buffer
   baked in. Treat the returned range as fully blocked inclusive.
7. Booking creation re-runs the quote server-side and ignores client totals. If your
   displayed total differs from the confirmation, the client is stale — re-fetch the
   quote right before submit.
8. Protection tiers accepted by rent-create-booking are exactly: premium, standard,
   decline. Anything else is a 400. Default is premium.
9. Booking lookup after checkout stays keyed on confirmation_token (booking ref alone
   won't authorize).
10. Rate limit on rent-create-booking is 20/hr per IP — please don't retry-storm on
    failure; surface the error.

We'll ping you the moment the team is flipped visible so you can run a live smoke
booking against the real fleet.
```

## Technical notes
- Team id: `780f425c-3733-40c7-855f-ff3c5addbb60`.
- Gate functions: `is_marketplace_team` requires `marketplace_visible = true` AND `marketplace_request_status = 'approved'`; `is_marketplace_vehicle` additionally requires status in (available, booked) and no archive/trash timestamps.
- Fee math lives entirely in `public_vehicle_quote`; `create_marketplace_booking` snapshots `state_fee_cents` and `processing_fee_cents` at booking time, so a fee change is not retroactive.
