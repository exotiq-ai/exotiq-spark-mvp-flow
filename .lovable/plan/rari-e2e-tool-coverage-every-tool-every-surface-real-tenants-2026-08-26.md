# Rari E2E Tool Coverage — every tool, every surface, real tenants

Today Rari's 37 tools are only spot-checked by hand. When a schema, handler, or data shape drifts, we find out from a live transcript. This plan builds a repeatable harness that exercises every tool with realistic operator questions, on real tenant data, across all three surfaces (voice webhook, MCP, in-app client tools), and prints a pass/fail matrix.

## What gets tested

**1. Contract layer (fast, runs in CI)**
- Extend the existing parity test so every registry tool is covered: each declared param is read by its handler, every handler case exists in the registry, and no orphan cases remain.
- Snapshot each tool's JSON schema so any change to a name/type/enum fails the test — those schemas are synced to ElevenLabs and must not drift silently.

**2. Execution layer (real data, per tenant)**
A driver that runs a case list against `executeFunction` for a set of tenants and asserts, for every call:
- no thrown error, no `error` field, non-empty `summary`;
- every returned row belongs to the caller's team (tenant isolation assertion on each record's `team_id`);
- no `null`/`undefined`/`NaN` leaking into human-readable strings (catches "null Rolls-Royce", "$NaN", "matching undefined");
- results actually reflect the requested filter (limit respected, timeframe window respected, status filter respected).

**3. Question layer (how operators really ask)**
For each of the 37 tools, 3–5 natural-language phrasings routed through `ask_fleet`, asserting the router picks the right tool — including the traps we've already been burned by: single-vehicle questions routing to fleet metrics, multi-word vehicle names, nicknames ("the 488", "the Cullinan"), customer first-name only, "who owes me money", "what's out of service".

**4. Surface parity**
Reuse `scripts/rari/cross-surface-parity-check.ts` logic and widen it from 5 tools to all 37: voice webhook vs MCP payloads must match after stripping `_meta`, and the in-app client tools in `useRariClientTools.ts` must return the same shape for the tools it duplicates.

**5. Edge and failure cases**
- Empty tenant (new signup, zero vehicles/bookings/customers) — every tool must return a graceful "nothing found" summary, never a crash or a bare "None found".
- Unknown vehicle / unknown customer / bad `BK-` reference — clear miss message, no invented data.
- Ambiguous vehicle match (two Ferraris) — asks to clarify.
- Auth: missing token, expired token, token claiming another team → refused, no data.
- Mutating tools (`create_booking_hold`, `logFeedback`) — run against one designated test tenant only, then clean up the created rows.

**6. Live-workspace parity (ElevenLabs)**
Run `rari:sync-tools` in dry-run against the production agent and assert zero drift — any tool the agent exposes that the registry doesn't (or vice versa), and any schema mismatch, fails the suite.

**7. Real websocket session smoke test**
One end-to-end voice session: `elevenlabs-session` mints the token → dynamic variables are passed → signed URL is opened → a tool is invoked in-conversation. Assert the transcript contains a tool result and that the executed call reports `authMethod: tool_token` (not a fallback identity).

**8. Golden-number cross-checks (data-rich tenant)**
Verify Rari's numbers against the database directly via the service-role path: fleet vehicle count, revenue totals for a fixed window, and `getVehicleProfitLoss` for a chosen vehicle compared against `fn_vehicle_pnl`. A mismatch beyond rounding fails.

**9. Cross-tenant WRITE test**
`create_booking_hold` called with another team's `vehicle_id` must be refused with no row created — asserted by re-querying the bookings table after the attempt.

## Tenant matrix

- **Seeded test tenant** — bookings seeded at relative dates (today, +3d, -10d, etc.) so timeframe, limit, status, and filter-correctness assertions are deterministic. All correctness assertions live here.
- **Data-rich tenant** (Tampa / Exotics By The Bay) — shape, isolation, and golden-number assertions only.
- **UK tenant** — currency formatting (£ not $).
- **Demo tenant** and a **freshly created empty tenant** — graceful zero-data behavior.

Cross-tenant isolation is asserted by running the same case list under two different tokens and confirming zero record-ID overlap, plus the write test above.

## Output

A single command produces a matrix — tool × tenant × surface — with PASS / FAIL / SKIP and the first failing assertion inline, plus a summary line. The contract layer runs in CI on every change to `fleet-tools/`; the live layers run on demand before any Rari deploy.

## Technical notes

- New: `scripts/rari/e2e/cases.ts` (case list per tool), `runner.ts` (driver + assertions), `report.ts` (matrix printer).
- `rari-selftest` becomes a **permanent, super-admin-gated** edge function. It verifies the caller is a super admin, mints scoped test tool tokens **server-side** for the requested tenant, and runs `executeFunction` in its real Deno environment. No tenant user credentials ever enter the harness or the script env.
- Extend `src/test/fleet-tools.parity.test.ts` for the contract layer (no network, CI-safe).
- Widen `scripts/rari/cross-surface-parity-check.ts` to the full registry rather than writing a second parity script.
- `useRariClientTools` is still live — `createRariClientTools` is wired into `RariVoiceInterface.tsx`, which mounts via `RariSidebar`, `AskRariButton`, `AskRariQuickAction`, and the dashboard. So it stays and gets parity coverage rather than deletion. (Re-confirmed at plan time; if a tool inside it turns out to be unreachable, that individual tool is deleted instead of tested.)
- No changes to `registry.ts` tool names/params (synced to ElevenLabs) and no changes to auth as part of this work; any drift found is reported, then fixed in a follow-up pass.

## Sequence

1. Contract layer + schema snapshots (CI-safe, no tenant data).
2. Permanent super-admin-gated `rari-selftest` with server-side scoped token minting.
3. Seed the test tenant with relative-date fixtures.
4. Case list for all 37 tools, including the `ask_fleet` phrasing set.
5. Runner + isolation, format, timeframe, and golden-number assertions across the tenant matrix; cross-tenant write refusal test.
6. Full-registry surface parity (voice / MCP / client tools) + `rari:sync-tools` dry-run drift check.
7. Live websocket session smoke test.
8. Report the matrix, fix every failure found, re-run until green.

