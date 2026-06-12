# Rari Booking Data Inconsistency — Root Cause & Plan

## What's actually broken

I traced the transcript against the live DB (`team_id c1de6533…`) and the `elevenlabs-tools` edge function. Rari is not lying — the **tool layer is returning wrong data** on three independent axes.

### Truth in the database today (Jun 12, 2026)

| status     | count | range                  |
|------------|-------|------------------------|
| confirmed  | 1075  | 2024-12-30 → 2026-11-28 |
| completed  | 142   | …                      |
| pending    | 51    | …                      |
| cancelled  | 3     | …                      |
| **active** | **3** | 2026-03-06 → 2026-04-04 (stale legacy rows) |

Bookings overlapping today: **20 confirmed** + 1 cancelled. Rari reported "3 active" — those are the 3 stale rows.

### Three root causes

**1. Status taxonomy mismatch (primary bug)**
The app uses `confirmed` / `pending` / `completed` / `cancelled`. There is no live `active` lifecycle status — just 3 legacy rows. Rari's system prompt + tool schema tell it `status: "active"` means "currently rented", so it filters `WHERE status='active'` and gets the 3 stale rows. `get_bookings` in `elevenlabs-tools/index.ts:859` does a literal `query.eq('status', status)` with no synonym mapping.

**2. Date-range semantics are wrong for "today"**
`get_bookings` applies `start_date >= start_date AND end_date <= end_date` (lines 862-866). For `start_date=end_date=2026-06-12` this only matches bookings that *both* start and end on Jun 12 — zero rows. The correct semantic for "active during range" is overlap: `start_date <= range_end AND end_date >= range_start` (already used correctly in `getFleetMetrics` at line 1387 and 2400).

**3. Tool routing misfires on date-only payloads**
Log shows ElevenLabs sent `?start_date=2026-06-12&end_date=2026-06-12` and `extractToolCall` inferred **`get_fleet_vehicles`** (line 265 default), not `get_bookings`. That's why Rari said "the system returned vehicle inventory data instead of booking records."

## Plan

### A. Edge function: `supabase/functions/elevenlabs-tools/index.ts`

1. **Add a `STATUS_SYNONYMS` map** at the top of `get_bookings` (case ~846):
   - `active` / `current` / `in_progress` / `rented` / `out` → `['confirmed','pending']` **plus** the overlap-today filter applied automatically
   - `upcoming` → `['confirmed','pending']` with `start_date >= today`
   - `today` → any status overlapping today
   - Pass-through for canonical values (`confirmed`, `pending`, `completed`, `cancelled`)
   - Use `.in('status', […])` instead of `.eq` when synonym expands

2. **Fix date-range semantics** in `get_bookings`:
   - Replace `gte('start_date', start_date) / lte('end_date', end_date)` with overlap: `lte('start_date', end_date).gte('end_date', start_date)`
   - Add a convenience `date='today' | 'tomorrow' | 'this_week'` parameter that derives the overlap window server-side from current UTC date

3. **Fix tool routing** in `extractToolCall` (lines 264-278 and 341-360):
   - When inferred params contain `start_date`/`end_date` **without** vehicle-only keys, route to `get_bookings`, not `get_fleet_vehicles`
   - When `status` is any booking-status synonym (including `active`/`rented`/`current`), route to `get_bookings`

4. **Enrich the response** so Rari can self-correct: include `queried_status`, `resolved_statuses`, `date_window`, and `today_iso` in every `get_bookings` payload. Add a one-line `interpretation` field ("Showing bookings overlapping 2026-06-12") so the voice model doesn't have to guess.

### B. Stale data reconciliation (one-shot migration)

The 3 rows with `status='active'` and end_dates in March/April 2026 are wrong regardless of Rari. Migration:

```sql
UPDATE bookings
SET status = 'completed', updated_at = now()
WHERE status = 'active' AND end_date < now();
```

(Scope: 3 rows across both demo/live teams — safe.) Also add a CHECK comment documenting that `active` is not a supported value going forward, and optionally a partial index / trigger that blocks new inserts with `status='active'` so this can't drift again.

### C. Rari system prompt / tool schema (no code change in repo)

Update the agent config in ElevenLabs so:
- `get_bookings.status` enum lists the real values (`confirmed`, `pending`, `completed`, `cancelled`) plus synonyms (`today`, `current`, `upcoming`) with clear descriptions
- The prompt teaches Rari to ask `get_bookings({date:'today'})` for "what's out today" rather than `status:'active'`
- I'll provide the exact prompt diff once code lands.

### D. Verification

1. `curl` the deployed function with each shape:
   - `{tool_name:'get_bookings', parameters:{date:'today'}}` → expect 20
   - `{status:'active'}` → expect 20 (synonym path) with `resolved_statuses:['confirmed','pending']`
   - `{start_date:'2026-06-12', end_date:'2026-06-12'}` → routed to `get_bookings`, expect 20
2. Re-run the same voice prompt that produced the transcript; confirm Rari names real customers/vehicles for today.
3. Add a Deno test in `supabase/functions/elevenlabs-tools/` covering the three shapes above.

## Out of scope
- UI changes to the bookings module
- Calendar/utilization recomputation (already correct — uses overlap)
- ElevenLabs agent config edits (handed off as a doc once code is in)

Approve and I'll implement A→D in one pass.
