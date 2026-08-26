# Rari E2E Tool Coverage — finish and verify

The approved plan was already archived, so here is the current state and exactly what is left. The harness code is written; it has not yet been run against live tenants, and one temporary helper is still deployed and must be removed.

## Already built (in the codebase now)

- `supabase/functions/rari-selftest/` — permanent, super-admin-gated harness:
  - `index.ts` — suite runner (execution, questions, edge, golden, isolation, surface, auth, drift, session), tenant matrix, pass/fail matrix output, cleanup.
  - `token.ts` — server-side minting of scoped tool tokens (valid and deliberately expired). No tenant credentials anywhere.
  - `assertions.ts` — non-empty summary, no `null`/`undefined`/`NaN` in spoken text, tenant isolation, limit compliance, currency symbol.
  - `cases.ts` — one or more cases for all 41 registry tools, 8 natural-language routing cases, 4 graceful-miss cases.
  - `seed.ts` — relative-date fixtures (on-rent today, upcoming, completed last month, completed this year) for the deterministic test tenant.
  - `golden.ts` — fleet count, yearly revenue, per-vehicle and fleet P&L cross-checked against direct SQL and `fn_vehicle_pnl`.
  - `surfaces.ts` — voice-webhook vs MCP parity, fail-closed auth refusals, and the real `elevenlabs-session` handshake (signed URL + dynamic variables + `authMethod: tool_token`).
  - `drift.ts` — live ElevenLabs workspace parity (zero drift vs the registry).
- `src/test/rari-tool-contract.test.ts` — CI contract layer: schema snapshot, every registry tool has a case, no undeclared params. Passing.
- Deployed and verified gate: unauthenticated returns 401, non-super-admin returns 403.

## What is left

1. **Remove the temporary driver.** `supabase/functions/tmp-selftest-driver/` was deployed only to mint a super-admin session from the sandbox. Delete the folder and the deployed function before anything else ships.
2. **Run the suite for real.** Preferred path: you stay signed in as a super admin in the preview, and the run happens through your own session — no session-minting helper needed at all.
3. **Triage the first run.** Expect real findings (missing summaries, `null` leakage, timeframe or limit drift, surface mismatches). Fix executor bugs, re-run until the matrix is clean.
4. **Super Admin panel.** A "Rari Self-Test" card in Super Admin: pick suites and tenants, run, and read the tool x tenant pass/fail matrix with failure detail inline. This is how the suite gets used after today.
5. **Docs.** Short `docs/rari/SELFTEST.md`: what each suite proves, how to add a tool case, and what to do when drift or golden-number checks fail.

## Technical notes

- The deterministic tenant defaults to `RARI_SELFTEST_TEAM_ID` (currently "test's Fleet"); seeded rows are tagged and wiped after each run. Real tenants get shape and isolation assertions only, so the suite stays deterministic.
- Mutating cases (`create_booking_hold`, `logFeedback`) run only on the test tenant, and created bookings are deleted at the end of the run.
- The cross-tenant write test asks one tenant's session to hold another tenant's `vehicle_id`; a created booking is a hard failure.
- Nothing in the harness changes auth, registry tool names, or registry schemas.

## Open question

For step 2, do you want the run to go through your signed-in super-admin session in the preview, or should the harness also be callable from CI with a scoped service token (a small amount of extra auth surface to maintain)?
