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

## Tenant matrix

Run the full suite against: a data-rich tenant (Tampa / Exotics By The Bay), a UK tenant (currency formatting — £ not $), a demo tenant, and a freshly created empty tenant. Cross-tenant isolation is asserted by running the same case list under two different tokens and confirming zero record-ID overlap.

## Output

A single command produces a matrix — tool × tenant × surface — with PASS / FAIL / SKIP and the first failing assertion inline, plus a summary line. The contract layer runs in CI on every change to `fleet-tools/`; the live layers run on demand before any Rari deploy.

## Technical notes

- New: `scripts/rari/e2e/cases.ts` (case list per tool), `runner.ts` (driver + assertions), `report.ts` (matrix printer).
- Live execution goes through a temporary `rari-selftest`-style edge function so `executeFunction` runs in its real Deno environment with service-role access, invoked by the runner with per-tenant tool tokens; it is deployed for the run and removed after, or gated behind a super-admin check if we keep it.
- Extend `src/test/fleet-tools.parity.test.ts` for the contract layer (no network, CI-safe).
- Widen `scripts/rari/cross-surface-parity-check.ts` to the full registry rather than writing a second parity script.
- No changes to `registry.ts` tool names/params (synced to ElevenLabs) and no changes to auth as part of this work; any drift found is reported, then fixed in a follow-up pass.

## Sequence

1. Contract layer + schema snapshots (CI-safe, no tenant data).
2. Case list for all 37 tools, including the `ask_fleet` phrasing set.
3. Runner + isolation/format assertions; run against the four-tenant matrix.
4. Full-registry surface parity.
5. Report the matrix, fix every failure found, re-run until green.
