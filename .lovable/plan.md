# Drive Exotiq marketplace read RPCs (M7f / MP-7)

Additive backend work for the staged marketplace. Nothing in the live booking app changes: the three existing public functions (`public_team_by_slug`, `public_team_fleet`, `public_vehicle_by_slug`) are not touched.

## Answers to section 8 (verified against the deployed functions)

- **Q1 — unlisted flag:** Yes, it exists as `vehicles.marketplace_unlisted` (boolean, nullable), and `public_team_fleet` **already excludes it** (`coalesce(v.marketplace_unlisted,false) = false`). So the new fleet RPC ships with the same predicate and test 2's counts should match exactly.
- **Q2 — visibility rule:** It is a **shared predicate function**, not inline SQL: `public.is_marketplace_team(team_id)` (`marketplace_visible = true AND marketplace_request_status = 'approved' AND NOT is_demo_account AND NOT is_deleted`), with `public.is_marketplace_vehicle(vehicle_id)` for vehicles (`marketplace_visible`, status in available/booked, not archived/trashed, team passes the team rule). The new RPCs call both — no refactor, no copy.
- **Q3 — photo_count:** Counted inside the function from `public.vehicle_photos`, using the same filters the hero-image subquery uses (`coalesce(is_visible,true)`, `coalesce(is_vehicle_confirmed,true)`), with the fallback to `1` when the count is 0 but a hero URL exists. At current volume (tens of vehicles, a few hundred photos, indexed by `vehicle_id`) the correlated count is negligible; timings reported in test 6.

Note for the record: `fredo-d-lima` already has `marketplace_visible = false`, so it is excluded by the existing gate regardless of the new flag.

## Migration (one file)

`supabase/migrations/<ts>_marketplace_listed_and_public_marketplace_rpcs.sql`

0. First two statements: `set local lock_timeout = '5s'; set local statement_timeout = '60s';`. No `BEGIN`/`COMMIT` in the file (the migration runner wraps it). Applied at a quiet hour; if the `ALTER` on `teams` times out waiting for the exclusive lock, simply re-run — every statement is idempotent.
1. `alter table public.teams add column if not exists marketplace_listed boolean not null default false;` plus a column comment.
2. Seed, guarded: `update public.teams set marketplace_listed = true where slug in ('exotiq','exotics-by-the-bay');` wrapped in a `DO` block that raises (aborting the migration) if the row count is not exactly 2. Both slugs seeded, per your confirmation. The `updated_at` bump on those two rows is expected.
3. `create or replace function public.public_marketplace_teams()` — `language sql stable security definer set search_path = public`. Returns `slug, name, city, state, timezone, logo_url, verified(false)`. City/state resolved with the same `LEFT JOIN LATERAL` over `locations` that `public_team_by_slug` uses. Filter: `marketplace_listed = true AND public.is_marketplace_team(t.id)`. No support email/phone/address/currency/description.
4. `create or replace function public.public_marketplace_fleet()` — same modifiers. Returns the full current `public_team_fleet` column set (`vehicle_slug, name, make, model, year, color, daily_rate numeric, hero_image_url, min_rental_days`) plus `team_slug`, `photo_count integer`, `verified boolean` (literal false). Filters: team `marketplace_listed` + `is_marketplace_team`, vehicle `is_marketplace_vehicle`, `coalesce(v.marketplace_unlisted,false) = false`. No ordering/pagination arguments.
5. Grants for both: `revoke all on function ... from public;` then `grant execute ... to anon, authenticated, service_role;`.


## Command Center toggle

In the tenant Settings → Business Profile area, add a switch labelled verbatim **"List my fleet on Drive Exotiq"** with the handoff's helper copy verbatim, bound to `teams.marketplace_listed`. The existing marketplace control and its copy are left untouched. Same edit permission as the rest of the Business Profile. A screenshot of the section goes in the reply.

## Test run (section 5) and reply

Executed in order, results pasted back in chat with the role shown for each:

- **0.** Baseline capture of the three existing functions for both tenants (before migration).
- **1.** *(anon)* `public_marketplace_teams()` — expect exactly `exotiq`, `exotics-by-the-bay`; no `fredo-d-lima`.
- **2.** *(anon)* `count(*)` from the new fleet RPC vs the sum of `public_team_fleet` for both slugs — expect exact equality (unlisted already excluded on both sides).
- **3.** Throwaway team + vehicle inside `begin; ... rollback;`: included when listed; excluded when `marketplace_listed = false`; excluded when relisted but `marketplace_visible = false`.
- **4.** Same transaction pattern with `marketplace_unlisted = true` — absent from the marketplace fleet, still returned by `public_vehicle_by_slug`.
- **5.** *(anon)* Column-by-column check for emails/phones/addresses/Stripe ids/uuids, plus `select * from public.teams limit 1` as `anon` still denied.
- **6.** 20 runs each with `explain (analyze, timing)`; median and max reported.
- **7.** Re-run the step 0 baselines and diff; run the security advisor and confirm no new findings for the two new functions.

Also pasted in the reply: the full migration file contents; the deployed body of `public_team_fleet`; `select column_name, data_type, is_nullable from information_schema.columns where table_name='vehicles' and column_name like '%unlisted%'`; a `pg_proc` count confirming exactly one row each for `public_team_fleet`, `public_marketplace_fleet`, `public_marketplace_teams`; a `pg_trigger` listing on `teams` confirming no new AFTER/audit trigger since early August; the two deployed RPC signatures; and the current rate-limiting posture on `/rest/v1/rpc/*`.


## Risk

Column is additive with a `false` default; the seed is bounded to two named rows and aborts if it matches anything else; the two functions are new and read-only. No existing function, table shape, edge function, Stripe object or email path is modified.
