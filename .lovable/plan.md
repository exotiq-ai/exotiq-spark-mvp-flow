# MP-10 — Batched availability read (`public_fleet_busy`)

One new read-only database function. Nothing existing changes: no table, trigger, edge function, email or payment path, and the live booking app keeps returning exactly what it returns today.

## What gets built

A single function `public_fleet_busy(_range_start date, _range_end date, _team_slug text default null)` returning `{team_slug, vehicle_slug}` — one row per listed car that has any booking or manual block overlapping the requested window. The renter app subtracts those cars from its cached grid.

It reuses the exact same busy rule the per-vehicle read uses today, expressed as the same two branches over the same tables, with the same buffer handling.

**Scope gates (per your change).**

- Fleet-wide call (`_team_slug` null): team `marketplace_listed` + `is_marketplace_vehicle` + not `marketplace_unlisted`.
- Team-scoped call (`_team_slug` given): `is_marketplace_vehicle` + not `marketplace_unlisted` only — no `marketplace_listed` gate, so a publicly visible but unlisted storefront returns its real busy rows instead of an empty set.

**Overlap predicate (documented in the function comment and the reply).** A vehicle is busy when any busy range overlaps the window inclusively on both ends: `busy_start <= _range_end AND busy_end >= _range_start`, where `busy_start`/`busy_end` are the same buffer-adjusted dates the per-vehicle read produces. A booking whose stay ends on the window's start date counts as busy.

## Confirmed facts from the current database (answers to the three questions)

- **Q1 — blocking status set.** `public_vehicle_availability` today treats these as blocking: `requested`, `pending_documents`, `pending_payment`, `pending`, `confirmed`, `active`. Yes — `requested` and `pending_documents` holds are included. It additionally skips rows with `is_historical = true`. This matches the marketplace overlap-guard index on bookings exactly, so the earlier red-team disagreement is not present in the current definitions. The new function will use this list verbatim.
- **Q2 — manual/maintenance ranges.** They live in `vehicle_blocked_dates` (team-scoped, `reason` covers Turo, personal use, transport, detailing, other), and the per-vehicle read already unions them into its result. Note for the record: maintenance work orders (`work_orders.out_of_rotation`) and `maintenance_schedules` are **not** read by `public_vehicle_availability` — only `vehicle_blocked_dates` is. The new function copies that behaviour so the two reads agree; extending both to work orders would be a separate change.
- **Q3 — dates vs instants.** Dates now, matching the per-vehicle read exactly (which derives dates from the underlying timestamps and applies the team's `rental_buffer_minutes` buffer before the start). When the instants work lands, both reads move together in the same migration.

## Two corrections to the spec's assumptions

The spec asks the new function to error on windows over 180 days and on an inverted range "the same way `public_vehicle_availability` does". It does not do either today: it silently clamps the far end to `_range_start + 1 year` and returns an empty set for an inverted range. Proposed resolution, unless you say otherwise:

- Inverted range (`_range_end < _range_start`): raise an error in the new function (a grid filter with inverted dates is a caller bug worth surfacing).
- Windows over 180 days: raise an error in the new function.
- The per-vehicle read stays untouched, so the two differ only in rejecting inputs the grid should never send.

A past window returns an empty set, as specified.

## Technical notes

- `language sql stable security definer set search_path = public`; `revoke all … from public; grant execute … to anon, authenticated, service_role;` — same hygiene as the September functions.
- Single migration file, statements only (`set local lock_timeout`/`statement_timeout` first, no `BEGIN`/`COMMIT`). New function only, so no drop/recreate and no `pg_depend` risk.
- Query shape: candidate vehicles (scope gates above — `marketplace_listed` applied only when `_team_slug` is null) joined to bookings on `vehicle_id` with the overlap predicate, unioned with the same over `vehicle_blocked_dates`, `distinct` on `(team_slug, vehicle_slug)`. `idx_bookings_vehicle_id`, `idx_bookings_date_range` and `idx_vehicle_blocked_dates_vehicle` exist and should keep this off a sequential scan; the plan output goes in the reply.
- No pagination, no caching, expected tens of rows.

## Verification, run in the handoff's order and pasted back

0. Baseline `public_vehicle_availability` for three real vehicles over 30 days.
1. Every row `public_fleet_busy(today, today+2)` returns is confirmed unavailable in that window by the per-vehicle read (three baseline vehicles plus two random).
2. Five vehicles absent from the busy set show a fully free window per-vehicle.
3. Rolled-back mutation test: throwaway booking appears → non-blocking status disappears → overlapping manual block appears.
4. `_team_slug = 'exotics-by-the-bay'` scoping, unknown slug empty, inverted range errors, 200-day window errors.
5. 20 timed runs each for a 3-day and a 30-day window, median and max, plus the query plan.
6. Per-vehicle read byte-identical before/after; security advisor shows no new findings.

## Hand back

The reply to Gregory includes the migration contents, the deployed signature, the blocking status set used, and §3 results in order. The handoff doc is filed at `docs/rent/LOVABLE_HANDOFF_FLEET_AVAILABILITY_2026-09-04.md`.
