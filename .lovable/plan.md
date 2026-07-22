
# Exotiq Marketplace Flip — Outstanding Test Checklist

Goal: confirm the Exotiq tenant can safely take a real renter booking from `book.exotiq.rent` (renter UI handled by your other agent) end-to-end. Below is what's still open on **our** side, grouped by whether it blocks the flip.

---

## 🔴 Must-clear before flipping Exotiq live

1. **End-to-end booking dry run (browse → quote → book → confirm)**
   - Hit `public_team_fleet` (with `_require_hero = true`), `public_vehicle_quote`, then `rent-create-booking` against Exotiq using the anon key.
   - Confirm booking lands as `pending_documents` (guest email) and as `requested` (email with a prior verified ID).
   - Confirm the row shows in the Exotiq tenant's Booking module with the new status badges and does NOT double-book (fire two overlapping requests — the new exclusion constraint should reject the second).

2. **Identity gate before any money moves**
   - With a `pending_documents` booking, run the renter through Stripe Identity; confirm `identity-webhook` flips status to `requested` (or equivalent) and a bell notification lands for Exotiq.
   - Attempt a capture / hold with `identity_status` in `requires_input` / `processing` / missing — must reject server-side, not just in the UI.

3. **Money path sanity on the live Connect account (`acct_1TvnfgQfNJmCrgjR`)**
   - Repeat the $1 manual-capture hold test on `stripe-create-hold` against Exotiq; confirm `application_fee_amount` is absent (D1 is already deployed, but re-verify post-M5).
   - Grep `application_fee_amount` across `supabase/functions/**` to ensure nothing re-introduced the 20%.
   - Confirm `public_vehicle_quote.platform_fee_cents` is derived from `rental_subtotal_cents` only.
   - Note: real M6 renter charge (10% separate charge) is still unimplemented — decide whether launch is "hold only" or "hold + capture".

4. **Tenant isolation on public RPCs (anon key)**
   - Team with `marketplace_visible = false` → 404 on every public RPC.
   - Vehicle with `marketplace_visible = false` under Exotiq → hidden from `public_team_fleet` and `public_vehicle_by_slug`.
   - `rent-public-media` refuses signed URLs for non-marketplace vehicles.
   - Confirm no PII (owner email, phone, VIN, plate, cost, internal notes) in any RPC response.

5. **CORS / domain allow-list for `book.exotiq.rent`**
   - Every public edge function (`rent-create-booking`, `rent-public-media`, `identity-create-session`, `identity-session-status`) currently returns `Access-Control-Allow-Origin: *`. Decide: keep `*` for launch, or lock to `https://book.exotiq.rent` (+ preview). Either is fine, but pick one before the flip.

6. **Hero-image coverage decision for Exotiq**
   - 30 of 52 marketplace-visible vehicles have no hero. Confirm the renter UI is calling `public_team_fleet(_require_hero => true)` so those 30 stay hidden, OR seed hero images. Without one of these, browse shows broken cards.

---

## 🟡 Should-clear same week (not a hard blocker)

7. **`marketplace_test_mode` posture**
   - Exotiq currently has `marketplace_test_mode = true` (bypasses the 5-photo readiness gate). Decide: leave on for launch week, or flip off and rely on real readiness. Confirm `get_marketplace_readiness` reports `real_ready` honestly either way.

8. **Currency + timezone**
   - Exotiq is USD so trivially fine, but confirm quote → hold → capture all round-trip in `teams.currency`. (GBP path via Orion can wait until we onboard a non-USD tenant to the marketplace.)

9. **Cancellation / refund policy on marketplace bookings**
   - Not codified. Decide before we take a booking we might have to refund: who eats the platform fee, and which edge function issues the refund. At minimum, document the manual runbook.

10. **Notification dedupe**
    - Confirm identity-webhook bell notifications dedupe on repeated Stripe webhook events for the same session.

---

## 🟢 Nice-to-have, post-flip is fine

11. Rate-limit `rent-public-media` and `rent-create-booking` beyond the current per-IP in-memory limiter.
12. Confirm `public/sitemap.xml` refreshes when `marketplace_visible` flips.
13. Signed-URL TTL vs renter session length — currently 1h; add refresh in renter UI if sessions can exceed that.

---

## Recommended order for tomorrow

1. Isolation matrix (#4) + CORS decision (#5) — 30 min, pure read tests.
2. End-to-end dry run against Exotiq (#1) — 45 min.
3. Identity gate + money path (#2, #3) — 1h, uses live Stripe.
4. Hero coverage decision (#6) and test-mode posture (#7) — 15 min policy call.
5. Cancellation runbook (#9) — write, don't build.

If #1–#6 pass, Exotiq is safe to flip for `book.exotiq.rent` in "hold-only" mode. Full capture waits on the M6 money-flow decision.

---

## Open question for you

For the flip, are we launching **hold-only** (Stripe manual-capture auth, no charge until operator confirms) or **hold + immediate capture**? That answer changes whether item #3's M6 gap is a blocker or not.
