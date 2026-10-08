---
phase: 01-api-docs-mcp-foundation
plan: "01"
status: partial
subsystem: testing
tags: [vitest, staging, postgres, source-audit, jwt, webhook]
requires: []
provides:
  - Four isolated agent test runners with offline network denial and pre-connection staging gates
  - Manifest-bound synthetic seeding and exact reverse-order cleanup
  - Tracked writer, overload, ACL, trigger, policy and state source inventory
  - Signed OAuth faults, upstream outage and signed duplicate/late webhook fixtures
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-11, 01-12]
tech-stack:
  added: []
  patterns: [Node Vitest projects, explicit test discovery, reviewed staging attestation, exact-row synthetic manifest]
key-files:
  created:
    - vitest.agent.config.ts
    - scripts/agent-booking/guard-environment.mjs
    - scripts/agent-booking/seed-staging.mjs
    - scripts/agent-booking/run-tests.mjs
    - scripts/agent-booking/test-suites.mjs
    - scripts/agent-booking/audit-source.mjs
    - docs/external-booking/staging-runbook.md
    - docs/external-booking/capabilities.md
    - docs/external-booking/source-audit.json
    - tests/agent-booking/environment.test.ts
    - tests/agent-booking/capabilities.test.ts
    - tests/agent-booking/fixtures.test.ts
    - tests/agent-booking/fixtures/oauth.ts
    - tests/agent-booking/fixtures/upstream.ts
    - tests/agent-booking/fixtures/schema-grants.json
    - tests/agent-booking/helpers/offline-network.ts
    - tests/agent-booking/helpers/webhook-replay.ts
  modified: [package.json, package-lock.json]
key-decisions:
  - Operational evidence remains a gate: offline fixtures cannot authorize staging or establish effective grants.
  - Root owns source inventory regeneration after each later wave's source commits.
  - Existing create_marketplace_booking source identities govern over the plan's shorthand atomic function name.
patterns-established:
  - Mutation adapters are bound to exact reviewed manifest data and UUID-plus-synthetic-marker deletion predicates.
  - Source presence, static migration reconstruction, isolated local SQL behavior and deployed behavior are separately labeled.
requirements-requested: [CAP-01, ISO-01, TEST-01]
requirements-completed: []
duration: 12min
completed: 2026-10-07
---

# Phase 1 Plan 1: Isolation, source audit and test harness Summary

**Deny-production test runners, manifest-scoped staging operations and signed failure fixtures pass 47 offline tests; complete staging/provider parity remains gated.**

## Performance

- Started: 2026-10-07T16:05:00Z (executor startup; first recorded runtime probe 16:06:17Z).
- Completed offline work: 2026-10-07T16:17:03Z.
- Tasks: all three implementation slices delivered; overall plan remains **partial** because mandatory applied-schema/provider/scheduler evidence is absent.
- Files created/modified: 19 in the isolated backend worktree, plus this external summary.
- Source base: backend `442dd4d1cb00823132d0a0f24a26892a70dd5288`; frontend `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d`.
- Backend implementation: `<BACKEND_CHECKOUT>`, branch `codex/agent-booking-backend`.
- Fresh source-owner snapshot and three isolated clone/worktree registrations: `BUILD-START.json` and `IMPLEMENTATION-WORKTREES.json` in the planning outputs root. This executor did not touch original source repositories, their git registration/index, other worktrees, global configuration, source `.env`, or live Exotiq services.

## Accomplishments and acceptance evidence

1. Four scripts discover explicit unit/contract/staging/pilot sets. Unit/contract use Node environment and blocked fetch/http/https/net/tls APIs; staging/pilot validate evidence before spawning test workers. Environment refusal covers missing labels/evidence, original project, wrong URL/project, stale proof, non-test payment keys, identity/scheduler/grant gaps and nonsynthetic data. REST seeding validates complete manifest/foreign keys/auth-owner provenance before any read, rejects existing IDs and unsupported credentials, refuses operations outside manifest, and cleanup binds exact ID and original marker in the same DELETE. Partial seeds remain recoverable from the preserved manifest; no broad cleanup.
2. Source inventory records **79 direct writer candidates**, **33 final relevant static function overloads**, **276 historical privilege statements**, and **14 dynamic table candidates** after excluding Array/Buffer/storage calls. Every entry has file/line/content hash. Complete tables cover operator/direct/import/calendar/cleanup/blocked-date paths. Dynamic source review identifies booking INSERT/UPDATE import paths, team booking DELETE, customer erasure PII UPDATE, read-only export/duplicate lookup, and a retention mapping currently excluding inventory. Effective roles, foreign-key cascades and full applied-schema coverage remain explicitly unknown.
3. Real RSA-signed OAuth/JWKS fixtures exercise valid, expired, revoked, audience/issuer/key/signature/algorithm/future-issued faults. Upstream fixtures separate timeouts, outages, schema disagreement and UNKNOWN. Stripe-style signed replay preserves exact bytes, timestamps, duplicate IDs, distinct operator/Exotiq legs and late failure ordering. Helper deduplication is deliberately absent: actual handler must enforce it.

## Verification results

| Command | Result |
|---|---|
| `npm run test:agent:unit -- --run` | **44 passed** in 2 files; 28 guard/environment and 16 fixture tests |
| `npm run test:agent:contract -- --run` | **3 passed**; source hashes/omissions and writer/overload/state provenance |
| `node_modules/.bin/tsc --noEmit --skipLibCheck --esModuleInterop --moduleResolution bundler --module esnext --target es2022 --allowJs vitest.agent.config.ts tests/agent-booking/environment.test.ts tests/agent-booking/capabilities.test.ts tests/agent-booking/fixtures.test.ts` | **Passed**, affected harness typecheck |
| `npm run test:agent:staging -- --run` | **Expected refusal**, dedicated staging evidence required, no network request/test worker |
| `npm run test:agent:pilot -- --project=synthetic` | **Expected refusal**, same gate |

Each planned slice was introduced as RED and committed before GREEN. Initial RED imports failed because implementation artifacts were absent. All final offline tests passed. No full application build, original checkout tests, live booking/payment operation or deployment was performed.

## Task commits

| Task | Commit | Result |
|---|---|---|
| 1 RED | `5c55c06f` | Failing environment tests, test runners/config, local lock reconciliation |
| 1 GREEN | `5265dbda` | Deny-production guard and synthetic manifest seed/cleanup |
| 2 RED | `90bc2e34` | Failing writer/overload/privilege audit tests |
| 2 GREEN | `ff37e2ac` | Source audit, complete provenance tables and staging runbook |
| 3 RED | `bbc3a1b4` | Failing token/outage/replay fixtures tests |
| Safety correction | `7797f02c` | Bind REST operations to manifest, exact DELETE marker and project JWT |
| 3 GREEN | `79fd321b` | Signed OAuth/upstream/webhook fixtures and shared refresh procedure |
| Typecheck correction | `a628f7d6` | Typecheck harness, observe actual blocked fetch API instead of unused spy |
| Runner safety correction | `218ab9ca` | Reject short/long config overrides and discovery escape paths |

Planning config has `commit_docs: false`; this external summary is not copied into the application checkout. Root owns STATE/ROADMAP and requirement completion, so this executor did not mutate them or mark unmet requirement gates complete.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Reconciled pre-existing npm lock drift.** `npm ci --ignore-scripts` refused the checked-in package manifest/lock mismatch (Lovable plugins/react-pdf dependencies missing from lock). Ran local `npm install --ignore-scripts --no-audit --no-fund`, changing only isolated package-lock; existing dependencies were not deliberately upgraded. Vitest 3.2.6 then ran successfully. Commit `5c55c06f`.

**2. [Rule 2 - Missing critical] Added fixed runner/discovery and offline network helper.** Four scripts needed pre-worker evidence checks and explicit no-pass-with-no-tests discovery; added `run-tests.mjs`, `test-suites.mjs`, and `offline-network.ts`, plus full source audit JSON so omission/stale fixture checks are executable. Commits `5c55c06f` and `ff37e2ac`.

**3. [Rule 1 - Bug] Bound underlying REST mutation adapter, not just its caller.** Initial adapter could be called outside the validated manifest and a loopback configuration could accept a JWT with production project claims. Exact manifest/credential binding now applies to every REST request; UUID+synthetic marker is enforced in DELETE, avoiding marker-change races. Tests prove denied operations make zero fetch calls. Commit `7797f02c`.

**4. [Rule 1 - Bug] Corrected affected test typechecking and actual fetch observation.** Typecheck exposed fixture argument inference and unused arbitrary network spy fields; corrected them and verified the full affected slice. Commit `a628f7d6`.

**5. [Rule 1 - Bug] Closed runner short-option/config-discovery bypass.** Changed argument handling from a forbidden-option pattern to an explicit allowlist of run/project/named-test arguments. Five tests verify short `-c`, long config/root, pass-with-no-tests and path-escape refusal before worker execution. Commit `218ab9ca`.

**Source naming correction:** Existing atomic request authority is `create_marketplace_booking`, not the plan interface shorthand `rent_create_booking_atomic`; no new schema/function introduced to satisfy a nonexistent source name.

## Actual source risks and separate local SQL evidence

Static chronology retains **17-argument and 18-argument** `create_marketplace_booking` overloads. The latest migration drops 14/16 variants only; latest 18-argument definition lacks explicit grants/revokes while older revokes target older signatures. These are source findings requiring exact caller/effective-role proof, not claims about production ACLs.

Root's independent local laboratory report `STAGING-FEASIBILITY.md` separately records exact selected source bodies on a manually reviewed **partial** schema: 20 simultaneous mixed-source inserts accepted 1 marketplace plus 10 direct bookings; booking UPDATE into blocked dates bypassed the INSERT-only guard; local new-signature default ACL included PUBLIC execution; retained overload calls reproduced `42725` function-not-unique. These findings justify planned hardening. This executor did not run that laboratory and does not claim its partial baseline is faithful deployed parity.

## Deferred issues and required gates

- Dedicated complete Supabase schema/edge baseline with applied identities/defaults/ACLs/RLS/foreign-key/trigger/hash evidence; local selected-function lab is useful evidence but not full business staging.
- Actual denied anon/authenticated writer calls and complete dynamic/cascade writer coverage.
- Isolated scheduler operation/recovery, sandbox identity, email sink, test Stripe accounts/credentials for **both** charge legs, and OAuth test issuer/provider compatibility with two clients.
- Reviewed staging evidence/config and synthetic auth-owner manifest; no secrets requested or read during this slice.
- Caller compatibility/ambiguous overload retirement and shared-writer concurrency hardening in downstream plans. No external booking write exposure until these and full journey gates pass.
- Existing baseline-browser-mapping warning appears in test startup; unrelated dependency warning deferred, no global update.

The evidence file is an operational reviewer attestation, **not cryptographic or automated proof**. Fixture-generated booleans/hashes must never be used to open the gate. Seeder accepts project-bound legacy JWTs only; opaque service credentials are intentionally refused pending a reviewed binding implementation.

## Known stubs and threat surface

No production behavior stubs or UI placeholder data were introduced. Test providers are explicitly offline fixtures; missing applied/provider infrastructure is a mandatory gate, not an implemented mock substitute. No new public network endpoint/auth route/schema was introduced. The planned staging REST/file boundaries require reviewed runner secrets/config; they are guarded and remain unreachable without evidence.

## Next readiness

Offline contract design/implementation may proceed. Root must review and regenerate the source inventory after every later wave's tracked source commits using `node scripts/agent-booking/audit-source.mjs --refresh`; review generated diffs before committing. Staging-dependent acceptance, external exposure and rollout remain blocked by the listed gates. Requirements CAP-01/ISO-01/TEST-01 are deliberately not marked fully complete here.

## Self-Check: PASSED

Key artifacts exist in the isolated backend worktree and all nine listed commits resolve via `git cat-file -e <hash>^{commit}`. Worktree status was clean after final implementation commit. Offline test/typecheck claims above are backed by executed results; missing staging/provider proof remains explicitly partial.
