# Rari self-test harness

End-to-end coverage for every tool Rari can call. Runs from **Super Admin → Rari Self-Test**,
executed by the `rari-selftest` edge function under the caller's super-admin session.
There is no CI service token: CI runs the contract layer only, and any future scheduled
runs must be server-side inside the backend.

## Layers

| Suite | Proves |
| --- | --- |
| `contract` | Registry and executor agree: every declared parameter is read by a handler, no orphan cases. |
| `execution` | All 37 registry tools run against real data and return a usable, clean summary. |
| `questions` | Natural-language phrasings route to the right tool (e.g. "what's going on with the 488?" → vehicle detail, not fleet metrics). |
| `golden` | Tool numbers (fleet count, revenue, P&L) match direct SQL. |
| `isolation` | Cross-tenant reads return nothing, and a cross-tenant **write** is refused. |
| `surfaces` | Voice webhook and MCP surfaces return the same payload shape. |
| `drift` | The live ElevenLabs workspace matches the tool registry. |
| `session` | Real `elevenlabs-session` websocket handshake succeeds. |

The CI half lives in `src/test/rari-tool-contract.test.ts`: it asserts bi-directional parity
(every registry tool has a case, every case maps to a real tool, every case argument is a
declared parameter) plus a schema snapshot so silent tool-shape changes fail the build.

## Test workspace

Fixtures only ever land in the dedicated **Rari Self-Test** workspace
(`d378546a-29cb-4ed6-81ce-ef768fa3f36f`, overridable with `RARI_SELFTEST_TEAM_ID`).
It is not a real tenant and not the demo account. `seed.ts` hard-refuses any other team id,
so a mistyped id fails loudly instead of writing test data into a customer account.

Fixtures use relative dates — one vehicle on rent today, one upcoming this week, one past —
so "today", "this week", "this month" and "this year" assertions mean the same thing on every run.
The seed is wiped at the end of each run unless the request passes `keepSeed: true`.

Real tenants in the matrix get shape, isolation, currency and golden-number assertions only.
Mutating cases (`create_booking_hold`, `logFeedback`) never run against a real tenant, and any
booking the harness creates is deleted during cleanup.

## Run artifacts and regression

Each run inserts a row into `rari_selftest_runs` (matrix, failures, totals, who ran it, green flag).
Super admins are the only role that can read it. The runner diffs the current matrix against the
most recent **green** run and returns:

- `regressions` — cells that went pass → FAIL
- `fixed` — cells that went FAIL → pass
- `newCases` — cells that did not exist in the last green run

The panel surfaces those three lists above the matrix, so a run is judged against history rather
than in isolation.

## Adding a case

1. Add the entry to `supabase/functions/rari-selftest/cases.ts` with the exact registry tool name
   and arguments drawn from the tenant profile (`sample.vehicle`, `sample.customer`, `sample.bookingRef`, …).
2. Mark it `mutating: true` if it writes — that confines it to the self-test workspace.
3. Run `bunx vitest run src/test/rari-tool-contract.test.ts`. A typo'd tool name or an argument the
   registry does not declare fails there before it can reach a tenant.

## When something fails

- **Drift failure** — the ElevenLabs workspace and `registry.ts` disagree. Re-sync the workspace tools;
  never edit the registry to match a stale workspace.
- **Golden-number failure** — the tool and SQL disagree. Check the tool's filters (historical bookings,
  cancelled states, team scoping) before suspecting the data.
- **Isolation failure** — treat as a security incident, not a test bug. Stop and fix the executor's
  team scoping first.
- **Execution failure on one tenant only** — usually missing tenant data (no photos, no bookings).
  Confirm against the seeded workspace before changing handler code.
