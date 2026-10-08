---
phase: 01-api-docs-mcp-foundation
plan: "05"
status: partial
subsystem: database
tags: [postgres, advisory-locks, concurrency, inventory, buffers, dst]
requires: [01-02]
provides:
  - All-source booking and maintenance INSERT/UPDATE/DELETE transaction guards
  - Immutable single post-return turnaround snapshots and shared exact availability
  - Tenant-local date discovery and precise busy-window read parity
  - Twenty real PostgreSQL concurrency, boundary and financial-hold tests
affects: [01-04, 01-06, 01-07, 01-13, 01-16]
tech-stack:
  added: []
  patterns: [READ COMMITTED volatile guard queries, nonwaiting advisory locks, final-row AFTER validation]
key-files:
  created:
    - supabase/migrations/20261007090200_shared_inventory_guard.sql
    - supabase/migrations/20261007090300_inventory_policy_read_parity.sql
    - docs/external-booking/inventory-writers.md
    - tests/agent-booking/concurrency.test.ts
    - tests/agent-booking/inventory-parity.test.ts
    - tests/agent-booking/helpers/inventory-sql.ts
  modified: []
key-decisions:
  - Contended writes abort with40001 instead of waiting while holding row locks; retry whole READ COMMITTED transactions with bounds and jitter.
  - Blocking status governs inventory for every booking source including historical flags; timestamps alone never release a hold.
  - Preserve existing marketplace exclusion and defer universal exclusion until audited existing conflicts are resolved.
  - Reconstructed existing buffer snapshots and changed conservative date projections require explicit rollout/caller review.
patterns-established:
  - agent_inventory_available(uuid,timestamptz,timestamptz) is the service-only exact quote/read predicate; guard is final write authority.
  - Before/after trigger validation protects against later BEFORE triggers rewriting input.
requirements-requested: [SAFE-01, CAP-01, FAIL-01, PAY-01]
requirements-completed: []
duration: 10min
completed: 2026-10-07
---

# Phase 1 Plan 5: Shared inventory serialization and buffer policy Summary

**Universal inventory triggers admit one of20 mixed-source overlapping reservations; real PostgreSQL tests prove exact buffer, maintenance, DST and financial-hold read/write parity.**

## Performance and provenance

- Started: approximately2026-10-07T16:23:00Z; completed2026-10-07T16:33:00Z.
- Tasks:2 implementation slices delivered; overall plan **partial** pending full schema/provider/caller gates.
- Files:6 created in isolated implementation worktree; this summary external to application checkout.
- Worktree: `<LOCAL_BUILD_ROOT>/plan-05-worktree`, branch `codex/agent-booking-plan-05`, base `f8674e13`.
- Original source checkout, its branch/index/other worktrees, live database/providers, source .env, deployments, pushes and global configuration untouched by this executor. No dependencies installed; existing linked dependencies used. Final test command disables Vitest cache; earlier default-cache runs may have written shared linked dependency test cache, and root was notified without deleting it.

## Delivered behavior

All sources use blocking statuses requested,pending_documents,pending_payment,pending,confirmed,active. Historical flag never overrides a blocking status. INSERT/UPDATE/DELETE on both inventory tables acquire transaction advisory keys; vehicle moves lock sorted old/new keys. Contention returns40001 immediately to avoid row/advisory lock cycles. Non-READ-COMMITTED writes fail40001 instead of relying on fixed snapshots. VOLATILE trigger SQL rechecks a fresh snapshot even when the enclosing INSERT began before a competitor committed.

Bookings snapshot the tenant's single post-return buffer, default60, on creation or vehicle move. Date/status edits retain it; changing tenant policy affects future rows. Snapshot writes are derived and immutable. Maintenance ranges remain raw half-open intervals, without double buffer. BEFORE derives/validates and AFTER checks final values against later trigger changes. Existing marketplace GiST exclusion remains. The audited INSERT-only marketplace blocked-date trigger is superseded by the universal guards, allowing valid terminal imports while enforcing all blocking rows.

`agent_inventory_available(uuid,timestamptz,timestamptz)` returns boolean, NULL for unknown vehicle, and rejects invalid intervals; execute is service_role only. Plan04 quote authority consumes this exact predicate without holding inventory. The guard is final write authority. Exact busy-window RPC includes maintenance; existing day-granular signatures retain conservative tenant-local discovery with unchanged listing scope. Date discovery is not an exact pickup-time promise.

Existing expire_unverified_holds source function remains unchanged:24h pending_documents,72h requested, excluding either nonempty payment reference. Tests directly exercise that exact selected function under new triggers; they do not prove scheduler operation, settlement or paid-awaiting-ID promotion. Plan06 owns those behaviors.

## Real SQL verification

Root transferred a dedicated runtime at `<LOCAL_BUILD_ROOT>/inventory-lab` to this executor. Owner `5c9e3ab660f0`, container `exotiq-agent-test-5c9e3ab660f0-db`, PostgreSQL17.6, internal network, no host ports, no source/socket mounts. Exact ownership/image/network/volume checks and `lab_identity` synthetic partial-schema marker precede test SQL. Existing staging-lab was not changed.

Loaded manually reviewed partial baseline plus selected exact source bodies from prior laboratory. Added explicit local dependency columns for marketplace_listed/unlisted, timestamps/cancellation and two payment references, and exact source expire_unverified_holds. Both prospective migrations were copied by hash and applied only here. Whole historical corpus never replayed. The selected laboratory does not include retained17arg overload, full RLS/constraints/business triggers/cascades/auth/provider parity; no claim of faithful deployment.

| Check | Actual result |
|---|---|
| Task1 RED against source baseline |8 failures;16 of20 mixed inserts accepted; UPDATE/blocked races exposed |
| Task2 RED before read-parity migration |6 failures; missing shared predicate and UTC-derived dates exposed |
| Final actual PostgreSQL suites | **20 passed:13 concurrency +7 parity**;6.87s wall duration |
|20 independent concurrent mixed marketplace/direct/operator/import INSERTs | **1 success,19 safe40001/23P01 failures**, no extra reservation |
| Same-command INSERT snapshot predates competitor commit | VOLATILE trigger sees committed overlap and rejects23P01 |
| UPDATE, maintenance UPDATE/DELETE, moves and lock cycle | Atomic conflicts/retries; both old/new keys held; no40P01 deadlock/timeouts |
| Repeated same transaction and multirow overlaps | Whole transaction/statement rolled back, zero partial reservations |
| Later BEFORE trigger rewrites interval/buffer | AFTER validation rejects overlap or immutable-buffer change |
| Exact boundary, snapshot change, maintenance, timezone/DST | Expected read and write results agree, exact nextpickup permitted |
|24h/72h holds, elapsed but untransitioned, either financial leg | Elapsed row blocks until terminal transition; either financial leg preserved |
| Affected TypeScript typecheck |Passed |
| Planned full `npm run test:agent:staging -- --run tests/agent-booking/concurrency.test.ts` |Expected **refusal**, missing full staging evidence; no provider access |

Final SQL command in owner worktree:

```sh
AGENT_TEST_SUITE=staging \
AGENT_INVENTORY_LAB_MANIFEST='<LOCAL_BUILD_ROOT>/inventory-lab/resources.json' \
node_modules/.bin/vitest run --no-cache --config vitest.agent.config.ts \
  tests/agent-booking/inventory-parity.test.ts tests/agent-booking/concurrency.test.ts
```

This narrow explicit docker-exec SQL proof does not satisfy full staged acceptance or bypass its rollout gate. The regular staging runner remains closed. Tests seed exact synthetic team/vehicle IDs and clean only their fixed inventory IDs; both files create their own fixtures and may run together.

Migration SHA256:

-902: `6e754adb371c63f677f17f25104f07a12ea672fd31edb80163215943489ffffa`
-903: `56dafd841effa6a465d5e7c96ccf5d5dfe574471277a5fb33da80984feb1226b`

## Task commits

| Slice | Commit |
|---|---|
| Task1 RED real multiwriter tests/helper | `3d495089` |
| Task1 GREEN universal guards/writer docs | `4e12a8d1` |
| Task2 RED parity scenarios | `32bdb8e3` |
| Task1 correction final-row tests/obsolete trigger replacement | `a4c2afaa` |
| Task2 GREEN shared read policy | `4488576e` |
| Additional blocked edit/move acceptance coverage | `cd31a034` |

## Deviations from plan

1. **[Rule3 - Blocking] Added owned local SQL test helper.** `tests/agent-booking/helpers/inventory-sql.ts` validates the dedicated runtime and runs independent PostgreSQL connections; the full staging runner requires providers absent by user confirmation. Root authorized this additional task05-owned file. Commit3d495089.
2. **[Rule2 - Missing critical] Added final-row AFTER checks and explicit isolation refusal.** BEFORE-only/command snapshot assumptions can miss later triggers or fixed transaction snapshots. Tests prove late rewrites and same-command timing. Guards use try-lock40001 to break row/advisory cycles; plan06 must bound whole-transaction retries. Commits4e12a8d1,a4c2afaa.
3. **[Rule1 - Bug] Replaced obsolete blocked INSERT trigger.** Leaving the raw source-only guard would reject terminal historical imports unnecessarily. The complete universal guards supersede it and preserve the marketplace exclusion. Commita4c2afaa.
4. **[Rule1 - Bug] Independent test fixture setup.** A fresh schema exposed parity-suite dependence on concurrency setup; each suite now owns its vehicle range and fixture creation. Task2 commit4488576e. No application behavior changed for this correction.

## Remaining gates and deferred issues

- Complete applied schema/default ACL/RLS/all writer/cascade/business trigger audit, including privileged trigger/replication/TRUNCATE bypass. Source table trigger coverage is strong but cannot establish deployed role coverage.
- Read-only preflight for imported/direct/history cross-source conflicts, orphan/invalid/infinite intervals and buffer bounds. Current-policy reconstruction for existing rows must be reviewed; no destructive cleanup or expanded exclusion auto-applied.
- Actual storefront/operator-calendar caller parity and retry handling; changed conservative date projections cannot be rolled out on SQL proof alone. All ordinary writers need bounded transaction retries before deployment.
- Plan04 authoritative quote predicate integration and plan06 request/idempotency/reconciliation/scheduler linkage need combined post-merge SQL tests. Quotes themselves do not reserve inventory.
- Scheduler liveness, actual settled/partial-payment reconciliation and paid-awaiting-ID promotion require isolated provider staging. These tests only prove the existing financial-reference expiry guard and state-held inventory.
- Full Supabase/Auth/Edge/OAuth issuer, both Stripe test legs, identity sandbox and synthetic customer journey remain absent. No full requirement marked complete.
- Existing baseline-browser-mapping dependency warning remains unrelated; no dependency/global update performed.

## Known stubs / threat surface

No production stubs/TODO/placeholder values introduced. The partial local schema and synthetic inputs are test fixtures with explicit missing operational gates. Security-relevant schema/helpers are planned surfaces; no additional public endpoint or credential exposure introduced. Private helper ACLs are revoked from PUBLIC/anon/authenticated; public RPC scopes remain existing ones.

## Next readiness

Root may merge this isolated branch, refresh source provenance, and integrate the shared predicate with04/06. Root owns shared STATE/ROADMAP/requirements updates. Application status is partial until caller/schema/provider gates pass; do not enable external writes or deploy from these local results.

## Self-Check: PASSED

All six created files exist; all six listed commits resolve as commits via git cat-file. Final migration hashes match the recorded applied local artifacts. Implementation worktree is clean. Twenty real SQL tests and affected typecheck passed; full staging refusal and unresolved operational gates remain explicitly partial.
