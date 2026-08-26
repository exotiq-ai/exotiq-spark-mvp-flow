# Rari E2E Tool Coverage — finish, verify, and clean up

Your corrections are folded in. One item is already done, and one of your assumptions needs adjusting based on what the database actually says.

## Done just now

**tmp-selftest-driver is deleted from the live project.** It now returns `404 NOT_FOUND`. The folder still sits in the repo (plan mode can't delete files), so removing `supabase/functions/tmp-selftest-driver/` is the first action once you approve — otherwise the next deploy would resurrect it.

## Corrections applied

- **No CI service-token path.** CI keeps only the contract layer (schema snapshot + parity). Runs happen through your signed-in super-admin session in the preview. Any future scheduled runs stay server-side inside the backend; no exported token.
- **Tool count reconciled: 37 registry tools, 41 harness cases.** The 41 was case count, not tool count (several tools get two cases, e.g. `get_fleet_vehicles` filtered and unfiltered). The plan and docs will say 37 tools / 41 cases.
- **Both-direction contract assertions.** Already implemented and passing: every registry tool has a case, and every case maps to an existing registry tool. Adding a third: every case argument must be a declared parameter of that tool (also passing), so orphan cases and stale params both fail loudly in CI.

## What the database actually shows (correction to your point 4)

- `RARI_SELFTEST_TEAM_ID` currently points at **"test's Fleet"**, which is **not** a dedicated harness team — it is the real solo workspace of `1hello@exotiq.ai` (0 vehicles, 0 bookings, 1 member). Safe today only because it is empty. It should not stay the target.
- **No team has `is_demo_account = true`.** Nothing is flagged as the demo tenant right now.
- The **"2027 TEST TEST"** vehicle lives in the internal **"Exotiq"** team (`c1de6533…`, 56 vehicles, 1,339 bookings) — the internal/showcase tenant, not a flagged demo account. It has **0 bookings attached**, so it can be deleted cleanly.

### Plan for that
1. Create a dedicated team named **Rari Self-Test**, owned by the `hello@exotiq.ai` super admin, marked as non-marketplace and excluded from tenant reporting. Point `RARI_SELFTEST_TEAM_ID` at it and leave `test's Fleet` alone.
2. Delete the "2027 TEST TEST" vehicle from the Exotiq team.
3. Add a harness guard: refuse to seed if the target team id is not the configured self-test team, so fixtures can never land in a real or demo tenant.

## Remaining work

1. Remove `supabase/functions/tmp-selftest-driver/` from the repo.
2. Create the dedicated self-test team, repoint the env var, delete the stray TEST vehicle, add the seed guard.
3. **Run the full suite through your signed-in super-admin session** and triage the first-run failures (expect real findings: missing summaries, `null` leakage, timeframe/limit drift, surface mismatches). Fix and re-run until the matrix is clean.
4. **Persist each run as a dated JSON artifact** and show regression against the last green run.
5. **Super Admin panel** — pick suites and tenants, run, read the tool x tenant matrix, and see what changed since the last green run.
6. `docs/rari/SELFTEST.md` — what each suite proves, how to add a case, what to do when drift or golden-number checks fail.

## Technical notes

- **Run artifacts**: new `rari_selftest_runs` table (id, ran_at, ran_by, suites, totals, matrix jsonb, failures jsonb, git-less build marker, `is_green` boolean). RLS: super-admin read/insert only, no anon or authenticated grants. The runner writes one row per run; the panel diffs the current matrix against the most recent `is_green` row and flags cells that went pass -> FAIL (regression) or FAIL -> pass (fixed).
- Mutating cases (`create_booking_hold`, `logFeedback`) run only on the self-test team; created bookings are deleted at the end of the run; seeded rows are tagged and wiped unless `keepSeed` is set.
- Real tenants get shape, isolation, currency, and golden-number assertions only — timeframe and limit correctness are asserted on the seeded team, so the suite stays deterministic.
- Nothing changes auth, registry tool names, or registry schemas.
