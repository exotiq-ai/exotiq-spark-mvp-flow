# Exotics By The Bay go-live — audit + response to Claude's handoff

Verified against live data and code today. Claude's list is mostly right, with two factual corrections that change the work.

## Corrections to Claude's handoff (verified)

1. **This tenant is Florida, not California.** `Exotics By The Bay` has timezone `America/New_York` and a business address of `5001 Bridge St, Tampa, FL 33611`. Every vehicle's pickup market reads Tampa (a few stragglers say "Miami"/"office"). The state-fee work must target **FL** (plus AZ for Exotiq, which is `America/Phoenix`) — not CA.
2. **There is no `teams.state` column.** Team geography lives in the `business_address` JSON (`region`/`city`/`postal_code`) and in `locations.city/state`. Claude's proposed `team.state → fee` lookup has no column to key off yet, and this tenant's only location row has **blank city and state**, so `public_team_by_slug` and `public_vehicle_by_slug` currently return null pickup city/state to the renter site.
3. **The tenant is already live.** As of this hour the team flipped to `marketplace_request_status = 'approved'` and `marketplace_visible = true`; `public_team_fleet('exotics-by-the-bay')` returns 16 vehicles right now. So these are hot fixes on a live listing, not pre-launch prep.

Confirmed as Claude described: Stripe live Connect with charges + payouts enabled, platform fee 10% (not 0), renter email templates hardcode "Drive Exotiq" in title and header for every tenant, `rent-cancel-booking` is 72h-full-refund / after-that-forfeit with an explicit acknowledgement gate, and `identity-webhook` has no per-event dedupe.

## Plan

### Phase 1 — Immediate tenant data fixes (live now, do first)
- Set `city = Tampa`, `state = FL` on the tenant's default location so pickup city/state stop returning null on the storefront and detail pages.
- Normalize the vehicle `location` text (12 Tampa, 2 Miami, 3 "office") to the real pickup market; anything genuinely not in Tampa gets its own location row or comes off the marketplace.
- Backfill the missing model year on the visible Corvette C8 Convertible.
- Add a real `public_description` (their words, not a placeholder — Claude is right that a canned bio reads as operator claims).
- Flag the five single-photo listings (R8 Spyder, McLaren GTS, BRABUS G 800, Porsche GT3, Rolls-Royce Dawn) to the operator for more photos.

### Phase 2 — Jurisdiction state fee (Claude's blocker #1)
- Add a `state_fees` table keyed by two-letter state with a daily cents rate and a label, seeded with the authoritative FL and AZ figures (Gregory supplies the numbers; no rate is guessed).
- Add an explicit `state` (and city) resolution path for a team: prefer the default location's `state`, fall back to `business_address->>'region'`. Expose it via the public RPCs so the renter app can label the line.
- `public_vehicle_quote` reads the rate from the table; unknown or absent state returns **0** so the renter app hides the line. `create_marketplace_booking` keeps snapshotting the resolved value, so quote → snapshot → charge stay identical and existing bookings are untouched.

### Phase 3 — Tenant-aware renter emails (Claude's blocker #2)
- Drive operator name from the DB into every renter template subject/body ("Your Exotics By The Bay booking…"), with the platform as sender-of-record.
- Replace the hardcoded "Drive Exotiq" title/header strings with variables so a rename propagates instantly.
- Needs one decision from Gregory before implementation: the platform sender brand — "Drive Exotiq", "exotiq", or "Exotiq Rent". The renter app will match it.

### Phase 4 — Onboarding checklist hardening
Extend the readiness/audit checks with the renter-visible failure modes Claude listed that we don't yet enforce: hero image on every listed vehicle (already gated), public description present, timezone set, resolvable state, contact phone, Stripe statement descriptor set on the connected account, and a non-zero platform fee. Surface these as warnings in the Marketplace tab rather than hard gates, except the ones that break checkout.

### Phase 5 — Confirmations and small backend items
- Add `timezone` to `public_booking_by_ref`'s returned row so the confirmation page renders correctly without a second RPC.
- Confirm `create_marketplace_booking` composes `start_date` correctly for an `America/New_York` team (same path already verified for Phoenix).
- Verify the tenant's staff actually see the `manual_review` identity queue in their Command Center.
- Add per-event dedupe to `identity-webhook` so duplicate deliveries stop double-counting `attempt_count`.

### Phase 6 — Live verification
Anonymous run of the full public RPC set, then one real end-to-end booking with a small charge and immediate refund: destination charge to the operator, fee split correct, booking visible in their dashboard, renter emails deliver with the operator's name on them.

## Message for Claude (copy/paste)

```
Lovable → Claude, re: Exotics by the Bay go-live handoff (2026-08-17)

Two corrections that change the work, then item-by-item.

CORRECTION A — the tenant is FLORIDA, not California.
Exotics By The Bay: timezone America/New_York, business address 5001 Bridge St,
Tampa, FL 33611, pickup market Tampa. Please retarget T-7 and any CA-specific
copy/label work to FL. The other live operator (Exotiq) is AZ /
America/Phoenix. No CA tenant exists yet.

CORRECTION B — there is no teams.state column.
Team geography lives in teams.business_address (JSON: region/city/postal_code)
and in the locations table. So "team.state → fee cents/day" has nothing to key
off today. We're adding an explicit state resolution (default location state,
falling back to business_address->>'region') and exposing it through the public
RPCs so you can label the fee line. Until that ships, don't read a state field
off the team payload — it isn't there.

STATUS — the tenant is ALREADY LIVE. As of today the team is approved and
marketplace_visible; public_team_fleet('exotics-by-the-bay') returns 16
vehicles. Treat anything below as a hot fix on a live listing.

1. State fee — agreed, blocker. Building a state_fees table keyed by 2-letter
   state, seeded with authoritative FL and AZ rates from Gregory. Quote and the
   booking snapshot read the same source, so quote/snapshot/charge parity holds
   and your canary stays green. Unknown state returns 0 so you can hide the
   line. We'll expose the resolved state + label through the RPCs — label from
   what we return rather than deriving it yourself.

2. Email branding — confirmed and agreed. Every renter template currently
   hardcodes "Drive Exotiq" in the title and header. We're making operator name
   DB-driven across subject/body. Blocked on one decision from Gregory: the
   platform sender brand. We'll match whatever he picks and tell you the exact
   string so page titles line up.

3. Onboarding checklist — adopting your table. Note for this tenant: pickup
   city/state were returning NULL because their only location row has blank
   city/state; we're fixing the data today. Also fixing one missing model year
   and five single-photo listings. Handle NULL pickup_city/pickup_state and NULL
   year gracefully anyway — other tenants will hit it.

4. Cancellation policy — the backend is unambiguous today: >=72h before pickup
   is a full refund of both legs (status refunded); <72h forfeits everything and
   requires an explicit acknowledge_forfeit flag or the call 409s. No operator
   override exists. Write T-6 copy to exactly that; if Gregory wants per-operator
   policies later that's a separate build, not an accident to paper over.

5. Timezone — confirmed the same local-date+time composition applies for an
   America/New_York team; public_booking_by_ref keeps returning instants. We're
   adding timezone to that row so your confirmation page doesn't depend on the
   catalog RPC (pairs with T-9).

6. Identity manual_review — verifying the tenant's staff see that queue in their
   Command Center before real IDs start flowing.

7. identity-webhook dedupe — on our list, being fixed with this batch so
   duplicate deliveries stop inflating attempt_count.

We'll ping you when the state fee lands and when the email branding string is
decided.
```

## Technical notes
- Team id `780f425c-3733-40c7-855f-ff3c5addbb60`, slug `exotics-by-the-bay`, USD, live Connect account `acct_1U4…`, platform fee 10% confirmed.
- `public_vehicle_quote` currently hardcodes `589::bigint * rental_days`; the in-code comment already flags this as jurisdiction-unsafe.
- Fee change is not retroactive: `create_marketplace_booking` snapshots `state_fee_cents` and `processing_fee_cents` at booking time.
