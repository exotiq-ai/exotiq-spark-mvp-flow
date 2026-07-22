# Marketplace Testing — Renter App Handoff

_Last verified: 2026-07-22 · Test tenant: **Exotiq** (`slug: exotiq-`)_

## TL;DR

Public catalog, media, quoting, availability, Stripe payouts, and ID
verification are **live and working with the anon key** against the Exotiq
tenant. The renter-side agent can start integrating.

Three known gaps to work around before end-to-end capture is possible — none
block UI/browse work, but all block a real booking:

1. **No renter-side booking-creation endpoint yet** (M6). Nothing in
   `supabase/functions/` or as an RPC accepts an anonymous
   `create booking + capture payment` call. The operator app writes bookings
   through the authenticated `FleetContext` path. This must be built before
   the renter can complete checkout.
2. **`teams.platform_fee_percent = 0.00` on Exotiq**, so
   `public_vehicle_quote` returns `platform_fee_cents: 0`. Independently,
   `create-payment-checkout` / `stripe-create-hold` **hardcode 20%** for
   `booking_source='marketplace'`. Quote UI and Stripe capture will disagree
   until this is reconciled (FLAGGED.md F-BUG-2).
3. **Photo coverage: 22 of 52 marketplace-visible Exotiq vehicles have a
   hero image; 30 have none** (no `vehicles.image_url` and zero rows in
   `vehicle_photos`). Renter cards will render blank for those. Either
   filter them out client-side by falling back on `hero_image_url IS NOT NULL`,
   or seed hero images before user testing.

Everything else is green.

---

## Live surface for the renter app (anon key only)

Anon key: `eyJhbGciOi...` (publishable, already in the renter app).
Base URL: `https://jlgwbbqydjeokypoenoc.supabase.co`.

### RPCs (`POST /rest/v1/rpc/{name}`)

| RPC | Args | Verified |
| --- | --- | --- |
| `public_team_by_slug` | `_team_slug` | ✅ returns brand, city, timezone, currency |
| `public_team_fleet` | `_team_slug` | ✅ 52 rows for `exotiq-`; ordered by rate desc |
| `public_vehicle_by_slug` | `_team_slug`, `_vehicle_slug` | ✅ full detail + photos array |
| `public_vehicle_availability` | `_team_slug`, `_vehicle_slug`, `_range_start`, `_range_end` | ✅ busy ranges only; includes team `rental_buffer_minutes` |
| `public_vehicle_quote` | `_team_slug`, `_vehicle_slug`, `_start_date`, `_end_date`, `_options` | ✅ all money in integer cents |

Quote `_options` currently supports `{ "protection": "premium" \| "standard" \| "decline" }`.
Protection catalog is hard-coded ($289 / $89 / $0) in the RPC until M6.

### Edge function

`GET /functions/v1/rent-public-media?team=<slug>&vehicle=<slug>` → 1-hour
signed URLs from the private `vehicle-photos` bucket. Verified 200 + valid
`signedUrl` on vehicles that have photos (Audi S8 returned 20). Vehicles with
no photos return `{ photos: [] }` — that's expected, not a failure.

### Zero-PII guarantee

Every RPC is `SECURITY DEFINER` with locked `search_path`, gated by
`is_marketplace_team` / `is_marketplace_vehicle`, and explicit column lists.
No VIN, plate, Stripe IDs, customer data, notes, or internal statuses are
exposed. Availability returns date ranges only — no booking IDs or names.

---

## Test tenant state

- Team: **Exotiq** (`c1de6533-ab44-4973-a123-007a8007b5ba`, slug `exotiq-`)
- `marketplace_visible: true` · `marketplace_request_status: approved`
- `marketplace_test_mode: true` (bypasses the 5-photo readiness gate — do
  not treat other tenants as ready without disabling this)
- Stripe Connect: `acct_1TvnfgQfNJmCrgjR` — charges ✅, payouts ✅,
  onboarding complete ✅
- Fleet: 55 total, 54 `marketplace_visible`, 49 also `status = 'available'`
- Hero coverage: **22/52 vehicles have a hero image** — see gap #3

To seed a demo renter, no signup is needed for browse; when we wire the
booking endpoint, the renter identity will come from `identity-create-session`
→ Stripe Identity → `identity-webhook` (already live, already tested).

---

## Known items to work around

### 1. No renter-side booking creation (blocker for capture)

There is no equivalent of `public_create_booking` or `rent-create-booking`.
When Claude's UI needs to close a booking it must call something we haven't
built. Recommended shape for M6:

- Edge function `rent-create-booking` (anon-callable) that:
  - Re-validates the vehicle via `is_marketplace_vehicle`
  - Re-runs `public_vehicle_quote` server-side (never trust client totals)
  - Re-checks availability (busy-range overlap) inside a serializable
    transaction to guard against the missing DB-level exclusion constraint
    (FLAGGED F-BUG-1-DB)
  - Requires a completed `identity_verifications` row for the renter's
    email before creating the row
  - Writes `bookings` with `booking_source = 'marketplace'` so the margin
    trigger + application-fee path fires
  - Returns a Stripe Checkout URL from `create-payment-checkout`

Until that exists, the renter UI can be fully built against the read-only
surface + a mocked "reserve" action.

### 2. Platform fee mismatch (must be resolved before real money moves)

- `public_vehicle_quote` uses `teams.platform_fee_percent` — Exotiq is set
  to `0.00`, so the renter sees no fee.
- `create-payment-checkout` and `stripe-create-hold` hardcode **20%** of
  the payment amount as `application_fee_amount` on marketplace bookings.
- The margin trigger uses `teams.platform_fee_percent` on the rental base.

Three different numbers. This is FLAGGED.md F-BUG-2 and needs a business
decision before capture. For the testing pass, either:
- Set Exotiq's `platform_fee_percent` to 20 so the surfaces align, **or**
- Route the test capture through a fee-free path and treat fee reconciliation
  as a separate milestone.

### 3. Sparse hero images

30 of 52 marketplace-visible Exotiq vehicles have neither `vehicles.image_url`
nor any `vehicle_photos` row. `public_team_fleet.hero_image_url` will be
`NULL` for them. Two options for Claude:
- Filter `hero_image_url IS NOT NULL` in the listing view.
- Or we seed hero images against those 30 vehicles before user testing.

---

## Non-blocker context Claude should still know

- **No DB-level double-booking guard** yet (FLAGGED F-BUG-1-DB). Client-side
  overlap check exists on the operator app; the renter path must run its
  own overlap check inside the booking-creation transaction.
- **ID verification is mandatory before capture.** Flow:
  `identity-create-session` → hosted Stripe URL → `identity-webhook` sets
  `customers.identity_status = 'verified'`. All three functions are live
  and tested end-to-end with a real Stripe Identity session.
- **Currency is per-tenant** (`teams.currency`, USD for Exotiq). Renter UI
  should read it from `public_team_by_slug`, not hardcode `$`.
- **Timezone is per-tenant** (`teams.timezone`). All busy-range dates come
  back as plain `date` values in the team's local zone.

---

## Quick smoke commands (anon key)

```bash
ANON=<paste anon key>
URL=https://jlgwbbqydjeokypoenoc.supabase.co

# Fleet
curl -s -X POST "$URL/rest/v1/rpc/public_team_fleet" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"_team_slug":"exotiq-"}' | jq length

# Vehicle detail
curl -s -X POST "$URL/rest/v1/rpc/public_vehicle_by_slug" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"_team_slug":"exotiq-","_vehicle_slug":"2017-audi-s8"}'

# Signed media
curl -s "$URL/functions/v1/rent-public-media?team=exotiq-&vehicle=2017-audi-s8" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

# Quote
curl -s -X POST "$URL/rest/v1/rpc/public_vehicle_quote" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"_team_slug":"exotiq-","_vehicle_slug":"2017-audi-s8","_start_date":"2026-08-01","_end_date":"2026-08-04","_options":{"protection":"premium"}}'
```
