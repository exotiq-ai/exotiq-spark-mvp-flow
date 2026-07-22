# Marketplace Red-Team / E2E TODO

Flagged risks from the 2026-07-21 marketplace-readiness pass. Group in priority
order; work through together tomorrow.

---

## 🔴 High risk — must test before renter agent goes live

### 1. Marketplace fee enforcement (money path) — D1 follow-through
- **Status:** `create-payment-checkout` and `stripe-create-hold` no longer
  hardcode 20% (deployed + verified 2026-07-21: $1 hold on
  `acct_1TvnfgQfNJmCrgjR` created with no `application_fee_amount`, released
  clean).
- **Still to verify:**
  - `public_vehicle_quote` returns `platform_fee_cents` derived from
    `rental_subtotal_cents` only (D1 + D9: excludes extras, deposit, protection).
  - No other edge function or client path re-introduces a fee. Grep
    `application_fee_amount` across `supabase/functions/**`.
  - M6 renter charge (10% separate charge, distinct statement line) is
    unimplemented — money-flow mechanics (destination vs separate charge) still
    open per D1.

### 2. Renter booking creation endpoint (missing)
- No `public_create_booking` RPC or `rent-create-booking` edge function exists.
- Renter agent currently has no way to finalize a checkout end-to-end.
- Must be built with:
  - Server-side overlap check inside the same txn (no DB-level exclusion
    constraint yet — see item 5).
  - Identity-verification gate before hold capture.
  - `booking_source = 'marketplace'` enforced server-side.
  - Fee snapshot via `fn_snapshot_platform_fee` at booking creation.
  - Access token generation for confirmation page (D4).

### 3. Identity verification gate
- Confirm `customers.identity_status = 'verified'` is required before any
  capture on a marketplace booking.
- Test: attempt capture with `requires_input` / `processing` / `canceled` /
  missing statuses — all must reject.
- Confirm webhook `identity-webhook` updates `customers.identity_status`
  atomically and cannot race a capture.

### 4. Tenant isolation on public RPCs
- Anon key must not leak PII or non-marketplace vehicles/teams via:
  - `public_team_by_slug`, `public_team_fleet`, `public_vehicle_by_slug`,
    `public_vehicle_availability`, `public_vehicle_quote`.
- Test matrix:
  - Team with `marketplace_visible = false` → 404 on all RPCs.
  - Vehicle with `marketplace_visible = false` under a visible team → hidden.
  - `rent-public-media` refuses signed URLs for non-marketplace vehicles.
  - RPCs never return `owner_email`, `phone`, internal notes, cost basis.

### 5. Double-booking guard
- No DB-level exclusion constraint on `bookings` overlap yet.
- Two concurrent renter checkouts on the same vehicle/time could both succeed.
- Options to evaluate:
  - Postgres `EXCLUDE USING gist` constraint with `tstzrange`.
  - Advisory lock on `(vehicle_id)` inside the booking-creation txn.
- Add Playwright/SQL concurrency test firing two overlapping requests.

---

## 🟡 Medium risk — should test before public launch

### 6. Photo coverage on Exotiq marketplace fleet
- 30 of 52 marketplace-visible vehicles have no hero image / zero
  `vehicle_photos` rows.
- Renter UI must filter `hero_image_url IS NOT NULL` OR we seed images.
- Decide: filter vs backfill.

### 7. Currency + timezone per tenant
- `create-payment-checkout` and `stripe-create-hold` now use
  `teams.currency` (defaults USD).
- Test with Orion (GBP) end-to-end to confirm renter-side quote, hold, and
  capture all speak GBP.
- Timezone: confirm `public_vehicle_availability` and quote returns respect
  tenant timezone for day boundaries.

### 8. `marketplace_test_mode` bypass
- Exotiq currently has `marketplace_test_mode = true`, which bypasses
  readiness gates.
- Confirm:
  - Only super admin can set this flag.
  - Flag is audit-logged.
  - `get_marketplace_readiness` clearly reports `real_ready` vs test-mode
    ready.
  - Pre-launch: flip off and confirm real readiness holds.

### 9. Orphaned Connect account
- `acct_1TcPJyQchd6jAAl0` (Express, no submitted details) is unused.
- Not urgent, but decide: leave / reject / delete via dashboard.
- No app-side references remain (verified 2026-07-21).

### 10. Cancellation refund path
- Renter cancellations on marketplace bookings — refund policy not codified.
- Who eats the 10% Exotiq fee on cancellation? Operator refund vs Exotiq
  refund flow.
- Needs decision + edge function coverage before launch.

---

## 🟢 Lower risk — nice to harden

### 11. Rate limiting on public RPCs
- No rate limit on `rent-public-media` or public RPCs.
- Consider gateway-level throttling or per-IP limit on signed URL issuance.

### 12. Signed URL TTL
- `rent-public-media` returns 3600s (1h) signed URLs.
- Confirm renter session length ≤ TTL, or add refresh logic in renter UI.

### 13. SEO / sitemap freshness
- `public/sitemap.xml` and marketplace SEO metadata added — confirm they
  refresh when `marketplace_visible` flips on/off for teams or vehicles.

### 14. Notification noise
- Identity-verification bell notifications: confirm dedupe on repeated webhook
  events for the same session.

---

## Test tenant question (open)
Before running the red-team suite live, decide:
- **A.** Run against Exotiq live (live Stripe key on payments, test key on
  Identity) — realistic but risky.
- **B.** Stand up a second test tenant with fully test-mode Stripe first —
  safer, slower.

Recommendation: **B for money-path tests (items 1, 3, 5, 10)**, **A for
read-only isolation tests (item 4)**.
