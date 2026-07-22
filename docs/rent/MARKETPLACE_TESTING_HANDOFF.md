# Marketplace Testing — Renter App Handoff

_Last verified: 2026-07-22 (updated post-M5) · Test tenant: **Exotiq** (`slug: exotiq-`)_

## TL;DR

Public catalog, media, quoting, availability, Stripe payouts, ID verification,
**and the renter booking-write path** are all live and callable with the anon
key against the Exotiq tenant. The renter agent can now drive an end-to-end
booking flow up to (but not including) the actual Stripe checkout redirect.

Status of the three original gaps:

1. ✅ **Renter booking-creation endpoint shipped (M5).** `POST
   /functions/v1/rent-create-booking` creates the booking and returns a
   `booking_ref` + `confirmation_token`. Contract in the "Booking writes"
   section below.
2. ✅ **Fee mismatch resolved (D1, 2026-07-22).** Hardcoded 20% removed from
   `create-payment-checkout` and `stripe-create-hold`; both now read
   `teams.platform_fee_percent`. Exotiq at `0.00` is self-consistent
   end-to-end. Money-flow model for M6 (single vs separate charge) still
   open — does not block browse/create testing.
3. ⚠️ **Photo coverage: 22 of 52 Exotiq vehicles have a hero image.**
   Unblocker shipped: `public_team_fleet` now accepts an optional
   `_require_hero boolean` (default `false`) — pass `true` to hide the 30
   vehicles without a hero. Seeding hero images is still the real fix.

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

---

## Booking writes (M5) — the new endpoints Claude calls

### `POST /functions/v1/rent-create-booking`

Anonymous, anon-key only. Rate-limited to 20 req/hr/IP. Server re-derives
totals from `public_vehicle_quote` — client totals are never trusted.

**Request body**

```json
{
  "team_slug": "exotiq-",
  "vehicle_slug": "2017-audi-s8",
  "start_date": "2026-08-01",
  "end_date":   "2026-08-04",
  "pickup_time": "10:00 AM",
  "protection": "premium",
  "driver": {
    "name":  "Full Name",
    "email": "renter@example.com",
    "phone": "+15551234567"
  }
}
```

- `start_date` / `end_date`: `YYYY-MM-DD`, must be strictly increasing, not in the past.
- `pickup_time`: free-form short string (stored as-is).
- `protection`: one of `premium` | `standard` | `decline` (default `premium`).
- `driver.name` ≥ 2 chars, `email` must contain `@`, `phone` ≥ 10 digits.

**Success (200)**

```json
{
  "booking_ref": "BK-01123",
  "confirmation_token": "b3c1...-uuid",
  "status": "requested" | "pending_documents",
  "identity_verified": true,
  "quote": { "daily_rate_cents": ..., "operator_total_cents": ..., "platform_fee_cents": ..., ... }
}
```

- `status = requested` — the renter's email already has a verified, unexpired
  `identity_verifications` row; booking is queued for operator review.
- `status = pending_documents` — no verified identity yet; renter must
  complete Stripe Identity before the operator sees it as bookable.
- `confirmation_token` is required to read the booking back — store it in
  the URL of the renter's confirmation page (`?token=...`).

**Errors**

| HTTP | body.error                                        | Meaning                                        |
| ---- | ------------------------------------------------- | ---------------------------------------------- |
| 400  | `team_slug and vehicle_slug are required`         | Missing / empty slugs                          |
| 400  | `valid start_date and end_date are required`     | Bad date format or `end <= start`             |
| 400  | `start_date cannot be in the past`                | Self-explanatory                               |
| 400  | `driver name, email, and phone are required`      | Field-level validation failed                 |
| 404  | `Vehicle is not available for booking`            | Team/vehicle not marketplace-visible          |
| 409  | `Those dates were just taken. Pick different dates.` | Overlap detected (GiST exclusion or explicit check) |
| 429  | `Too many requests`                               | Rate limit                                     |
| 500  | `Unable to create booking`                        | Server / DB error                              |

### `POST /rest/v1/rpc/public_booking_by_ref`

Anonymous, anon-key. Returns a redacted booking for the renter confirmation
page. `_token` is required — a random `booking_ref` alone will not resolve.

```bash
curl -X POST "$URL/rest/v1/rpc/public_booking_by_ref" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"_booking_ref":"BK-01123","_token":"<confirmation_token>"}'
```

### Marketplace status lifecycle

```text
                        rent-create-booking
                                 │
             identity verified?  │  no
                        yes ─────┼──────►  pending_documents  ── renter completes Stripe Identity ─┐
                                 │                                                                 │
                                 ▼                                                                 ▼
                            requested   ◄── operator approves ──                          (identity webhook flips
                                 │                                                          status to requested)
             operator declines ──┼── operator approves
                                 │
              declined           ▼
                           pending_payment  ── renter pays (M6) ──►  confirmed ── active ── completed
                                 │
                        refund path ──►  refunded
```

Operator UI now colors and labels all five new statuses correctly
(`src/lib/bookingStatus.ts`). The DB-level exclusion constraint
`bookings_no_marketplace_overlap` prevents two marketplace bookings from
holding the same vehicle+dates.

### Hero-image filter (temporary)

```bash
curl -X POST "$URL/rest/v1/rpc/public_team_fleet" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"_team_slug":"exotiq-","_require_hero":true}'
```

Drops the 30 vehicles without a hero from the returned list. Remove the
argument (or pass `false`) once photos are seeded.
