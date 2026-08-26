# Fix the 13 Rari self-test failures (and the 21 skips behind them)

The uploaded run (156 cases, 121 pass, 13 fail, 22 skip) splits cleanly into two piles: real Rari bugs that would hit an operator on a live call, and harness bugs where the test is wrong, not the product. Both get fixed.

## 1. The self-test workspace never got seeded (root cause of 21 skips)

Every sample field for the Rari Self-Test tenant came back `null`, so 15 execution cases and 4 routing cases were skipped there — the strict, deterministic assertions never ran at all.

The seed writes columns that do not exist or omits ones that are required:
- `vehicles` has no `notes` column (the seed tags every row with it) and no `daily_rate`; it requires `name`, `user_id`, `current_rate`.
- `bookings` requires `user_id` and `pickup_location`.

Fix: rewrite the fixtures against the real schema, tag seeded rows by a reserved name prefix instead of `notes`, and write both the vehicle and booking rows under the workspace owner. The seed failure is currently swallowed into a console log — it will instead be recorded as a failing `setup` case so an empty test tenant can never masquerade as "skipped".

## 2. Real Rari bugs

**getEventImpact says `undefined` out loud** (fails on all 3 tenants). The handler reads `eventName`, but the registry only declares `location`, so the parameter can never arrive. Declare the event parameter (with an alias so existing phrasings map), and when no event is named, answer about general peak-demand behaviour instead of quoting an empty event name.

**getVehicleSpecs is a hardcoded list of six supercars.** Real fleet vehicles ("Mercedes-Benz GLE53", "Audi S8") return "Vehicle specs not found in database". It will resolve the vehicle in the caller's own fleet and report the specs actually stored on that record, with a clean "I don't have detailed specs on file for X" when there is nothing stored. No invented horsepower or 0-60 numbers.

**getCustomerLifetimeValue returns "Customer not found" for customers that exist.** The query uses a fuzzy match with `maybeSingle()`, which yields nothing whenever a first name matches more than one customer ("Zachary", "Exotiq"). It will rank matches (exact, then prefix, then contains), answer on the best one, and say how many others matched so Rari can offer to disambiguate.

**Asking about a customer by first name answers with fleet metrics.** The router has no customer intent, so "how much has Zachary spent" falls through to `getFleetMetrics`. Add customer detection resolved against the tenant's own customers and booking names — no hardcoded name list — routing to the customer profile/LTV tools.

## 3. Harness bugs (the test is wrong)

**Golden revenue mismatch ($4,825,658 vs $4,858,658; 534 vs 535 bookings).** Rari counts bookings that overlap the window; the check counts bookings that start in it. One long booking that started before 1 Jan explains the gap exactly. The check will mirror the tool's overlap semantics — the tool is right.

**vehicle_pnl_gross_summary compares a formatted string** ("577,977") against Rari's rounded speech ("$578 thousand"), so it can never pass. `getVehicleProfitLoss` will expose the raw gross figure and the check will compare numerically with the same tolerance as the other golden numbers.

**Session handshake "no tool token in dynamic variables".** `elevenlabs-session` returns `toolToken` at the top level of its payload, not inside `dynamic_variables`. The assertion will read the real shape, and still verify the signed URL and that the minted token authorizes a webhook call as `tool_token`.

**Vehicle-routing questions on Exotiq.** Rari correctly answered about the right car ("2017 Audi S8 in Miami… on rent now"), but the assertion demanded the literal word "plus" — a trailing token the harness picked off the model name that Rari doesn't speak. The assertion will check the tool actually resolved to the sampled vehicle record, not that a substring appears in prose.

## 4. Verify

Re-run all eight suites from the Super Admin panel against Rari Self-Test, Exotiq, and Exotics By The Bay, and confirm: no skips on the test workspace, zero failures, and the exported CSV/JSON matches. Anything still red gets triaged from the drill-down before this is called done.

## Technical notes

- `supabase/functions/rari-selftest/seed.ts` — schema-correct fixtures, name-prefix tagging, owner `user_id`; `index.ts` records seed failure as a failing case.
- `supabase/functions/_shared/fleet-tools/registry.ts` — add the event parameter to `getEventImpact` (additive; picked up by the drift suite, so the ElevenLabs workspace sync should be re-run after).
- `supabase/functions/_shared/fleet-tools/executor.ts` — `getEventImpact`, `getVehicleSpecs`, `getCustomerLifetimeValue`, `getVehicleProfitLoss` raw gross, and customer intent in `ask_fleet`.
- `supabase/functions/rari-selftest/golden.ts` — overlap-window revenue, numeric P&L compare; `surfaces.ts` — session payload shape; `cases.ts` — vehicle-routing assertion.
- Contract tests in `src/test/` stay green; no tool renames, no auth changes.
