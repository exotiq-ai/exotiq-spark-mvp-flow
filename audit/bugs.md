# bugs.md — Verified Bugs (architect-reviewer)

Scope: money math (pricingUtils, partnerStatement, margin), booking/scheduling
(conflictDetection + server enforcement), dates, state/async, realtime, Stripe,
edge functions. Verification = vitest (64/64 green baseline) + static reasoning.
No DB available; all SQL findings are static analysis of `supabase/migrations/`
(120 files) — schema UNVERIFIED vs hosted production (Lovable applies via MCP).

Confidence legend: HIGH = provable from code; MED = strong static inference,
one assumption stated; LOW = plausible, needs runtime confirmation.

---

## BUG-1 — Double-booking is not prevented anywhere (no server constraint, client gate not enforced at submit) — CRITICAL
- Severity: **CRITICAL** (kill-shot for a rental business: same car rented to two renters)
- Files:
  - `src/lib/conflictDetection.ts` (entire `checkBookingConflicts`) — **dead code**
  - `src/components/dialogs/NewBookingDialog.tsx:168-184` (availability memo) and `:191-260` (`handleSubmit`)
  - `src/contexts/FleetContext.tsx:817-840` (`createBooking` — the only insert path)
  - `supabase/migrations/20251030004312_*.sql:72-80` (bookings table — no exclusion constraint)
- Root cause (three independent gaps, all required for safety, none present):
  1. **No server-side guard.** `checkBookingConflicts` is never imported anywhere
     (`grep checkBookingConflicts` → only its own definition file). There is no
     Postgres `EXCLUDE`/`btree_gist` exclusion constraint, no `BEFORE INSERT`
     trigger, and no RPC that validates overlap. Grep across all 120 migrations and
     56 edge functions for `EXCLUDE|tstzrange|overlap|RAISE EXCEPTION.*overlap|already booked`
     returns nothing relevant. The `bookings` table stores plain
     `start_date/end_date TIMESTAMPTZ NOT NULL` with no overlap protection.
  2. **Client gate is advisory only.** `NewBookingDialog` computes
     `vehicleAvailability` (line 168) and uses it only to grey out vehicles in the
     picker (`:336 isAvailable`). `handleSubmit` (line 191) re-validates required
     fields and date-range order but **never checks `vehicleAvailability` before
     calling `onSubmit`** (line 238). A user can pick an available vehicle, then
     change the dates to overlap an existing booking, and submit — nothing blocks it.
  3. **`createBooking` inserts blindly** (`FleetContext.tsx:825`) — no overlap query.
- Repro: Vehicle V has booking A (Jun 10–12). Open New Booking, pick V with dates
  Jun 14–16 (available), then change start/end to Jun 11–13 and submit. Booking B
  is inserted overlapping A. Two confirmed bookings now occupy the same car/dates.
- Note: the inline overlap formula at `NewBookingDialog.tsx:179`
  (`start < bEnd && end > bStart`) is **correct**; the standalone
  `conflictDetection.ts` formula is also correct but unused. The defect is
  enforcement, not the math.
- Fix direction: add a Postgres exclusion constraint
  (`EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_date,end_date) WITH &&) WHERE (status NOT IN ('cancelled','completed'))`,
  requires `btree_gist`), OR a `BEFORE INSERT/UPDATE` trigger raising on overlap,
  AND re-check `vehicleAvailability[vehicleId]` in `handleSubmit` before `onSubmit`.
- Confidence: **HIGH** for client gap and dead code; **HIGH** for "no server constraint
  in migrations" (MED only insofar as hosted schema could have drifted).

---

## BUG-2 — Marketplace platform fee is hardcoded to 20% in Stripe, but the margin engine uses the team's configurable % (default 10%) — HIGH
- Severity: **HIGH** (money math; operator is over/under-charged a platform fee that
  disagrees with what the margin module reports)
- Files:
  - `supabase/functions/stripe-create-hold/index.ts:70` — `const platformFee = isMarketplace ? Math.round(amount * 100 * 0.20) : 0;`
  - `supabase/functions/create-payment-checkout/index.ts:110-113` — `platformFee = Math.round(amount * 100 * 0.20);`
  - `supabase/migrations/20260525225536_*.sql:60-66` (`fn_snapshot_platform_fee`) — uses `teams.platform_fee_percent` default **10**, applied to `compute_rental_base`, not the payment amount.
- Root cause: three different definitions of "platform fee" coexist:
  - DB trigger: `team.platform_fee_percent` (default 10) × **rental base** (`compute_rental_base`).
  - Stripe hold: **20%** × **hold/deposit amount**.
  - Stripe checkout: **20%** × **payment amount** (could be deposit or balance).
  The Stripe functions ignore `teams.platform_fee_percent` entirely and apply the
  fee to whatever dollar figure is being charged (deposit, partial, or balance),
  not the rental base. So a team configured at 12% has its margin computed at 12%
  but its Stripe Connect `application_fee_amount` taken at 20%, and the base differs.
- Second defect (same lines): both Stripe functions gate on
  `booking_source === 'marketplace'` only, while the DB trigger gates on
  `booking_source IN ('drive_exotiq','marketplace')`. A `drive_exotiq` booking gets
  a platform fee snapshot in the margin module but **no** Stripe application fee.
- Repro: Team sets `platform_fee_percent = 10`. Marketplace booking, $1000 balance
  payment via `create-payment-checkout` → Stripe withholds $200 application fee;
  margin module shows `platform_fee_amount` = 10% of rental base. The two never reconcile.
- Confidence: **HIGH** (hardcoded constant vs configurable column, directly readable).

---

## BUG-3 — Historical migration shipped an inverted percentage split (partner vs operator share) — HIGH (data-integrity risk)
- Severity: **HIGH** (any payout generated under the earlier migration is wrong by
  `100 − x` vs `x`; reconcile logic now silently flags but won't auto-correct)
- Files:
  - `supabase/migrations/20260525225536_*.sql:115-117` — `v_partner_share := ROUND(v_net * ((100.0 - v_vehicle.split_value) / 100.0), 2);` comment: "split_value = operator's share %; partner gets the remainder".
  - `supabase/migrations/20260528180850_*.sql:44-46` — `v_partner_share := ROUND(v_net * (v_vehicle.split_value / 100.0), 2);` comment: "split_value = partner's share %".
  - `supabase/migrations/20260529001701_*.sql:49-50` and `:174-175` — settles on partner's share, and `fn_generate_partner_payout` now *flags* (`reconcile_flag`) rather than overwrites paid/voided rows.
- Root cause: `split_value` semantics were flipped between two sequential migrations
  three days apart. Bookings completed while `20260525225536` was live wrote
  `net_to_partner` using `(100 − split_value)`. The demo seed in
  `20260528180850` sets `split_value = 40` for "Velocity Capital Partners (40% of net)".
  Under the old fn that yielded 60% to the partner; under the corrected fn, 40%.
  Any partner_payouts row written in that window is wrong and, once marked `paid`,
  is now only *flagged* for reconcile (`20260529001701:79-88`) — never recomputed.
- Final-state code is correct (partner's share). The bug is the **persisted data**
  from the interim migration plus the lack of an automatic backfill/recompute for
  rows that were paid before the fix.
- Repro: requires DB history; static-only. Inspect any `partner_payouts` whose
  `created_at` falls between the two migrations and compare `net_to_partner` to
  `net_after_fee × split_value/100`.
- Confidence: **MED** (depends on whether bookings completed in the interim window;
  the seed re-flip in `20260528180850:99-122` regenerates pending rows correctly,
  but pre-existing `paid` rows are not touched).

---

## BUG-4 — ICS calendar export emits floating local time without TZID/Z — bookings shift across timezones — MED
- Severity: **MED** (wrong pickup/return times in any exported calendar opened in a
  different timezone)
- File: `src/lib/calendarExport.ts:16-18, 33-34`
- Root cause: `formatDate` produces `yyyyMMdd'T'HHmmss` with no trailing `Z` and the
  VEVENT has no `TZID`. Per RFC 5545 a `DTSTART` in form `19980118T230000` (no Z, no
  TZID) is "floating" — interpreted in the *viewer's* local timezone. A booking
  stored as `2026-06-10T18:00:00Z` rendered via local `format()` on a UTC-4 machine
  becomes `20260610T140000`, then re-interpreted as 14:00 in the importer's zone.
  Times drift by the offset delta between exporter and importer.
- Fix: append `Z` and format in UTC (`formatInTimeZone(date,'UTC',"yyyyMMdd'T'HHmmss'Z'")`),
  or emit `DTSTART;TZID=...`.
- Confidence: **HIGH** (RFC-defined behavior; format string is plainly local).

---

## BUG-5 — `usePresence` uses a single static Realtime channel name shared by all mounts — MED
- Severity: **MED** (subscription collisions / dropped events when the hook mounts
  in more than one component, e.g. messaging panel + presence avatars)
- File: `src/hooks/usePresence.ts:106-124`
- Root cause: channel is named the constant `'presence-changes'` (line 107). Unlike
  `useRealtimeTable` (which appends `Date.now()`) and `useTeamMessaging` (per-convo
  name), two simultaneous `usePresence` instances open two channels with the same
  name; supabase-js channel topics are expected to be unique per subscription.
  Additionally the effect depends on `fetchPresence` (line 124), which is recreated
  whenever `conversationId` or `user?.id` change (deps at line 100) — so switching
  conversations tears down and rebuilds the presence channel every time, generating
  churn. Not a leak (cleanup runs) but causes reconnect storms and possible missed
  realtime events during the gap.
- Fix: make the channel name unique (`presence-${user.id}-${instanceId}`) and split
  the subscription effect from `fetchPresence` recreation (subscribe once; call the
  latest `fetchPresence` via a ref).
- Confidence: **MED** (depends on simultaneous mounts; collision behavior is library-defined).

---

## BUG-6 — Stripe webhook idempotency is check-then-insert (TOCTOU) and the fee UUID is a 64-bit hash — MED/LOW
- Severity: **MED** for idempotency race; **LOW** for hash collision
- File: `supabase/functions/stripe-webhook/index.ts:34-52` (idempotency),
  `:456-471` (`chargeIdToUuid`)
- Root cause:
  - Idempotency does `select ... where stripe_event_id = event.id` then a separate
    `insert` (lines 35-52). Two concurrent deliveries of the same event id both read
    "not found" and both proceed to the handler, double-recording payments/payouts.
    Stripe *can* deliver duplicates concurrently on retry. Safe form: rely on a
    unique constraint on `stripe_event_id` and treat a duplicate-key error from the
    `insert` as "already processed" (insert-first, then handle).
  - `chargeIdToUuid` (line 457) maps a charge id through two 32-bit DJB2-style hashes
    into a UUID used as `source_record_id` for the `stripe_fee` expense idempotency
    key. ~64 bits of entropy laid into a v5-shaped string → birthday-bound collision
    risk and a non-conforming UUID variant. Comment even says "Use Web Crypto … in
    real prod." A collision would suppress a legitimate fee expense (`ON CONFLICT` no-op).
- Confidence: **HIGH** for the TOCTOU pattern; **LOW** for collision materializing in practice.

---

## BUG-7 — Negative discount inflates booking total (missing lower-bound clamp) — LOW
- Severity: **LOW** (requires a negative `discountAmount` to reach the function; UI
  likely prevents it, but the shared "single source of truth" doesn't defend it)
- File: `src/lib/pricingUtils.ts:72,75`
- Root cause: `discountAmount = Math.min(params.discountAmount || 0, rentalSubtotal)`
  clamps the upper bound but not the lower. A negative discount passes through and
  `grandTotal = rentalSubtotal - (negative) + fees` **increases** the total — a
  negative discount becomes a surcharge. Add `Math.max(0, …)`.
- Confidence: **HIGH** (arithmetic), **LOW** impact (depends on caller validation).

---

## BUG-8 — Margin "Operator Net" formula mixes fee-inclusive gross with fee-net partner payouts; gas/delivery fees pollute Margin % — LOW/MED
- Severity: **LOW/MED** (reported margin is internally inconsistent, not catastrophic)
- File: `src/components/margin/MarginOverview.tsx:19-28`
- Root cause: `gross = sumGross(bookings)` is each booking's `total_value`, which
  includes gas + delivery fees (see `pricingUtils.calculateBookingTotal` grandTotal).
  `operatorNet = gross − fees − vehicleExpenses − totalPayouts` and
  `marginPct = operatorNet / gross`. Two consistency issues:
  - `total_value` includes pass-through gas/delivery fees that aren't margin, so
    both numerator and denominator are inflated by non-revenue amounts, skewing %.
  - `totalPayouts` (`net_to_partner`) is derived server-side from `gross_rental_base`
    (rental only, fee already removed), while `fees` is subtracted again at the top
    level. For partnered marketplace vehicles the platform fee is reflected once in
    `fees` and once inside the partner-share base — arguably correct, but the model
    is never reconciled against `gross` (which uses a *different* base, `total_value`).
- This is a modeling/representation bug rather than a single off-by-one; flagged for
  a deliberate definition of the margin waterfall.
- Confidence: **MED** (the inputs demonstrably use different bases:
  `total_value` vs `gross_rental_base`).

---

## Lower-confidence / watch items (not counted in Top 10)
- `src/hooks/useTeamMessaging.ts:177-200` — N+1 (3 queries × N conversations); see performance.md. Correctness OK, perf only.
- `supabase/functions/stripe-webhook/index.ts:181` — hold `hold_expires_at` hardcoded to now+7d; Stripe uncaptured PaymentIntents expire at 7 days by default but custom auth windows exist; cosmetic drift risk. LOW.
- `src/lib/pricingUtils.ts:42-46` — `calculateRentalDays` uses local-tz `startOfDay`; a booking spanning a DST "spring-forward" night still returns correct calendar-day count (calendar diff is DST-safe), so no bug — documented to avoid re-flagging.
- `src/components/margin/useMarginData.ts:93-110` — bookings filtered by `start_date` in `[startIso,endIso]`; a booking that *starts* before the window but is active within it is excluded from margin. Intentional per "in the selected period" but worth confirming with product. LOW.

---

## Top 10 by severity
1. **BUG-1 (CRITICAL)** — Double-booking unprevented: no DB exclusion constraint/trigger, client conflict gate not enforced at submit, `checkBookingConflicts` is dead code. `conflictDetection.ts`, `NewBookingDialog.tsx:191`, `FleetContext.tsx:817`.
2. **BUG-2 (HIGH)** — Stripe marketplace fee hardcoded 20% vs configurable `platform_fee_percent` (default 10%) used by margin engine; also `marketplace`-only gate vs `drive_exotiq,marketplace`. `stripe-create-hold:70`, `create-payment-checkout:110`.
3. **BUG-3 (HIGH)** — Interim migration inverted percentage split (`100−x` vs `x`); paid rows from that window are wrong and only flagged, never recomputed. `20260525225536:117` vs `20260528180850:46`.
4. **BUG-6 (MED)** — Stripe webhook idempotency is check-then-insert (TOCTOU); fee idempotency UUID is a 64-bit hash. `stripe-webhook:34-52,457`.
5. **BUG-4 (MED)** — ICS export emits floating local time (no TZID/Z); times shift across timezones. `calendarExport.ts:16-34`.
6. **BUG-5 (MED)** — `usePresence` static channel name `'presence-changes'` collides across mounts; presence effect churns on conversation switch. `usePresence.ts:106-124`.
7. **BUG-8 (LOW/MED)** — Margin "Operator Net"/% mixes fee-inclusive `total_value` gross with fee-net partner base; gas/delivery pollute %. `MarginOverview.tsx:19-28`.
8. **BUG-7 (LOW)** — Negative `discountAmount` inflates `grandTotal` (no lower clamp). `pricingUtils.ts:72`.
9. (watch) — N+1 in conversation enrichment (perf, correctness OK). `useTeamMessaging.ts:177`.
10. (watch) — Margin bookings filtered by `start_date` only may drop window-spanning bookings. `useMarginData.ts:96`.
