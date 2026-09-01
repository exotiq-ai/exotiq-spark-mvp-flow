# Sharp Exotics (Becca) — feature requests: verdict and rollout plan

All five requests are reasonable and none of them conflict with how the platform
works today. The important constraint: every one of them must be **additive and
default-off**, because the same pricing/availability code paths serve every
tenant and the public booking app.

## Where things stand today (verified)

- **Tax** lives on the workspace only: `teams.tax_rate_percent`, `tax_label`,
  `tax_inclusive`. The public quote function reads those team values. The
  `locations` table has no tax fields (it does have a free-form `settings` JSON).
- **Availability** is derived, not stored: bookings + out-of-service work orders
  (`src/lib/conflictDetection.ts`), and the public booking site's busy windows
  come from bookings only. There is no way to block a date range by hand.
- **Rates** are per vehicle: 3hr / 6hr / daily / multi-day, edited in the Rate
  Tiers card. No day-of-week logic anywhere.
- **Delivery** is a single flat amount typed per booking (`delivery_fee`).
- **Extra charges** are limited to the gas fee, delivery fee, and a free-form
  adjustment/discount. There is no reusable custom add-on concept.

## Verdict per request

1. **Per-location tax rates — yes, build it.** Real requirement for multi-state
   operators and cheap to add: optional tax override on each location, falling
   back to the workspace default when blank. Bookings already record the pickup
   location, and each booking already snapshots its own tax rate, so history is
   unaffected.
2. **Unavailable-date blocking — yes, highest value.** This is the Turo
   double-booking guard and it is the one gap that can cause a real failure. It
   should be a first-class "blocked dates" record, not a fake booking, so it
   never pollutes revenue, CRM, or utilization numbers.
3. **Day-of-week pricing — parked pending Gregory's answer.** Design is ready
   either way (whole-rental adjustment based on pickup day vs. per-night
   repricing); we hold the build until the rule is confirmed, since the two
   options price multi-day rentals differently.
4. **Variable delivery pricing — yes, later.** Distance-based pricing needs a
   mileage source (address → distance). Interim step that costs almost nothing:
   let the operator save reusable delivery tiers (e.g. 0–25 mi $150, 25–50 mi
   $250) and pick one at booking time instead of retyping. Full automatic
   mileage calculation is a separate phase.
5. **Custom add-ons — yes, and it also replaces hard-coded fees.** A per-workspace
   catalog of add-ons (admin fee, transponder, etc.). Confirmed: **flat
   per-booking amounts, and taxable** — so no per-day math and they sit inside
   the taxed subtotal. Only the actual fee list is still outstanding.

## Recommended sequencing

- **Phase 1 (unblocks Sharp Exotics now):** blocked dates + per-location tax.
- **Phase 2:** custom add-ons catalog (start once Becca sends her list).
- **Phase 3:** pickup-day pricing adjustments.
- **Phase 4:** delivery tiers, then mileage-based delivery if still wanted.

## Technical notes

**Blocked dates**
- New `vehicle_blocked_dates` table (team_id, vehicle_id, start/end, reason,
  source e.g. `manual` / `turo`, note), team-scoped RLS + grants, manager+ write.
- Feed it into the single availability helper in `conflictDetection.ts` as a new
  unavailable reason so the fleet card, booking pickers, and calendar all agree.
- Add it to `public_vehicle_availability` (and the marketplace booking RPC's
  conflict check) so the renter app cannot book over a block.
- UI: block/unblock from the vehicle card and from the calendar, shown as a
  distinct neutral band — visually different from a rental and from
  out-of-service.

**Per-location tax**
- Nullable `tax_rate_percent`, `tax_label`, `tax_inclusive` on `locations`;
  blank = inherit workspace default, so nothing changes for existing tenants.
- Resolve tax at quote/booking time from the booking's pickup location, else the
  team. Update `public_vehicle_quote` and the booking dialogs to use the
  resolved values. Bookings keep snapshotting the rate they were priced at.

**Pickup-day adjustments**
- `vehicles.day_of_week_adjustments` JSON (`{"1":-20,...}`, percent, null =
  none). Applied in the shared pricing helpers (`pricing.ts` / `pricingUtils.ts`)
  and mirrored in `public_vehicle_quote` so operator and renter quotes match.
- Edited inline in the rate-tier card with a preview of the resulting daily rate.

**Add-ons**
- `team_addons` catalog (name, amount, per-day vs flat, taxable, active) plus
  `booking_addons` line items; totals flow through the existing pricing helpers
  and appear on the renter quote, payment record, and invoice.
- Migrate the existing gas fee into this model only after add-ons are proven —
  not in the same change.

**Delivery tiers**
- `team_delivery_tiers` (min/max miles, price); booking dialog offers the tiers
  and still allows a manual override.

## Safety / no-disruption rules for all of the above

- Every new column is nullable or defaulted so existing tenants behave exactly
  as they do today; no backfill changes anyone's numbers.
- All pricing changes go through the shared pricing helpers plus the matching
  public quote function, kept in sync and covered by unit tests, so the operator
  Command Center and the renter app can never quote different totals.
- New tables get grants + team-scoped RLS in the same migration.
- Blocked dates never appear as revenue, bookings, or CRM activity.
- Ship each phase behind the existing feature-flag file where user-visible, and
  verify against Sharp Exotics plus one control tenant before wider exposure.

## Open questions for Becca

- Should the pickup-day discount apply to the whole rental or only nights that
  fall on those days?
- Are her add-ons per-day or per-booking, and are they taxable?
- Are the Turo blocks entered by hand, or does she want an iCal feed from Turo
  imported automatically later?
