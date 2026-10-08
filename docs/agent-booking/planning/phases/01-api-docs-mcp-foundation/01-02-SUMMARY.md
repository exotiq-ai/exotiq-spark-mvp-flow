---
phase: 01-api-docs-mcp-foundation
plan: "02"
status: complete-offline
subsystem: api
tags: [json-schema, openapi, state, errors, timezone, hmac, tdd]
requires:
  - phase: 01-01
    provides: Isolated offline harness, source capability audit and synthetic fixtures; staging gates remain partial.
provides:
  - Canonical bounded v1 JSON Schema, pure runtime validation and generated OpenAPI 3.1.2
  - Authenticated filter-bound expiring cursors and precise offset/timezone checks
  - Actual backend lifecycle projection, inventory hold policy and safe structured errors
affects: [01-03, 01-04, 01-06, 01-07, 01-09, 01-10, 01-11, 01-14]
tech-stack:
  added: []
  patterns: [Canonical JSON Schema and deterministic OpenAPI generation, Web Crypto HMAC cursors, authoritative state projection]
key-files:
  created:
    - supabase/functions/_shared/external-booking/contracts.ts
    - supabase/functions/_shared/external-booking/state.ts
    - supabase/functions/_shared/external-booking/errors.ts
    - docs/external-booking/openapi.yaml
    - scripts/agent-booking/generate-contract.mjs
    - tests/agent-booking/contracts.test.ts
    - tests/agent-booking/state-errors.test.ts
  modified: []
key-decisions:
  - Stored payment_expired is preserved; generic expired is a derived next action, never an invented stored booking state.
  - v1 supports USD, the pilot currency; additional currencies require explicit backend/charge-leg proof.
  - Strict tenant offset validation permits both DST fold instants but rejects gaps, unknown offsets and invalid calendar dates.
  - API duration is conservatively bounded to 365 days; source availability reader has a one-year range cap but source writer has no maximum rental duration.
  - State projection cannot mutate bookings or free inventory; confirmation requires authoritative identity and both settled legs.
patterns-established:
  - Consumers validate canonical schemas and cross-field invariants; no parallel hand-maintained transport DTOs.
  - Cursor keys require at least 32 bytes, authenticate operation/normalized filters/expiry and carry no customer data.
requirements-completed: []
requirements-covered: [API-01, DOC-01, PAY-01, FAIL-01, VIS-01]
duration: 9min
completed: 2026-10-07
---

# Phase 1 Plan 2: Canonical versioned API schemas and state contract Summary

**Bounded canonical booking schemas generate OpenAPI and enforce charge sums, tenant time offsets, safe retry cursors and authoritative confirmation semantics.**

## Performance

- Started: approximately 2026-10-07T16:13:00Z.
- Completed: 2026-10-07T16:22:00Z.
- Tasks: 2/2 implementation tasks completed with offline verification.
- Files created: 7, only in the isolated backend owner worktree.
- Working branch: `codex/agent-booking-backend`.
- Worktree: `<BACKEND_CHECKOUT>`.

## Accomplishments

- Seven versioned discovery, availability, quote, rental-request, status and checkout-handoff paths have schema references, bounded inputs, security requirements and documented structured responses. Requests require the bounded `Idempotency-Key` header; status supports authorized conditional 304 responses.
- Quote validation preserves operator/Exotiq charge splits, included-tax treatment and separately disclosed deposit. Integer-safe BigInt reconciliation checks itemization and the two payment schedule legs. Quotes hold no inventory. Unknown/client-controlled prices, status, customer substitutions and unrecognized options are rejected.
- Offset timestamps are checked against tenant timezone, including daylight-saving transitions; dates require a later local return date because the existing quote authority bills distinct calendar dates. Optional discovery date filtering never establishes availability.
- HMAC cursors bind operation, normalized filters and expiration. Tampering, filter/operation changes, oversize cursors, noncanonical encodings and expired cursors fail safely.
- Stored states match the current source booking CHECK exactly. Partial payment never offers a second operator checkout; paid awaiting-ID rows cannot expire through the simple unverified hold path. Elapsed deadlines do not unblock inventory without an actual committed terminal transition.
- Unexpected errors are translated to fixed messages, allowlisted fields, generated/safe request identifiers and bounded retry delays. Missing/cross-customer/cross-operator/expired-or-revoked-grant/scope misses share the same 404 response. No exception, credential or customer detail is serialized.

## Verification

| Command | Actual result |
|---|---|
| `npm run test:agent:contract -- --run tests/agent-booking/contracts.test.ts` | Passed: 12 tests; final named run 306 ms total |
| `npm run test:agent:unit -- --run tests/agent-booking/state-errors.test.ts` | Passed: 30 tests; final named run 338 ms total |
| `node scripts/agent-booking/generate-contract.mjs --check` | Passed: exact generated OpenAPI parity |
| Strict isolated TypeScript check of contracts/state/errors and both named tests, ES2022/DOM, bundler resolution, allowImportingTsExtensions | Passed: no diagnostics |
| `npm run test:agent:unit -- --run` before root source refresh | 73/74 passed; one source fingerprint mismatch caused by new tracked shared modules. Root owns inventory refresh; no fixture was loosened. |
| Root post-refresh full contract suite | Root reported 15/15 passed after `f8674e13` regenerated source inventory. |

Both task tests were authored and run RED before their corresponding implementation. Initial RED failed at imports because the new modules did not exist. GREEN proves the behavioral assertions, not just imports. Existing baseline-browser-mapping age warning was not modified. No original checkout tests/builds, live services, provider APIs, credentials, .env reads, deployments, pushes or booking/payment mutations occurred.

## Task commits

| Task | Commit | Result |
|---|---|---|
| Task 1 RED | `2b7bfdb0` | Bounded request, totals, timezone, cursor and OpenAPI contract tests |
| Task 1 GREEN | `d8fc141c` | Canonical schemas, runtime semantic validation and generated OpenAPI |
| Task 2 RED | `26ee2148` | Authoritative lifecycle, hold, settlement, lookup denial and error tests |
| Task 2 GREEN | `388fb233` | Actual state projection and safe errors; exact payment_expired source correction |

External planning config has `commit_docs: false`. This summary is saved only in the isolated output workspace; root owns STATE/ROADMAP/requirement updates and final metadata. Whole cross-plan requirements are not marked complete by this offline contract work.

## Source corrections and deviations from plan

1. **[Rule 1 - Bug] Exact booking writer and stored expiry state.** The planning interfaces named `rent_create_booking_atomic`; the actual current source writer is `create_marketplace_booking`. Schema comments and this summary use the verified name. The plan's generic stored `expired` was corrected to source `payment_expired`, based on `supabase/migrations/20260724015013_c1c8f150-af28-400e-8b5d-aae1e1515305.sql` booking CHECK and latest `expire_overdue_payment_bookings` in `20260725045744_fa25b9ea-3209-4ab2-bade-3d1744f0b5b2.sql`. 24h/72h unverified/request hold expiry stores `cancelled` with reason, not `expired`; `refunded` is a real booking state in the CHECK and rent-refund/cancel handlers. A regression test compares canonical states to the actual source CHECK. Commit: `388fb233`.
2. **[Rule 2 - Missing Critical] Added generator CLI early.** Root approved ownership of `scripts/agent-booking/generate-contract.mjs`, to be handed sequentially to plan11. Canonical source generation/parity could not remain an informal step. The CLI uses the existing local TypeScript compiler; serialized JSON is valid YAML 1.2, so no new serialization dependency is needed. Commit: `d8fc141c`.
3. **[Rule 2 - Missing Critical] Conservative operational bounds.** Current backend protection IDs are `premium`, `standard`, `decline`; unrecognized options are rejected. Currency is USD for the U.S. synthetic pilot, rather than accepting arbitrary three-letter strings as ISO codes. Existing availability caps one calendar year of observation but the writer has no explicit maximum: v1 adds a conservative 365-day duration cap and rejects same-local-day requests that the existing quote authority cannot price. These are explicit API safeguards, not claims about deployed backend restrictions. Commits: `d8fc141c`, `388fb233`.

## Known stubs

None in implemented contract/state/error/generator behavior. This plan does not implement runtime API handlers, OAuth authorization server, consent/grant storage, provider settlement or deployment. Relative `/oauth/authorize` and `/oauth/token` paths describe the mounted authorization contract; verified issuer and actual registration remain later-plan implementation gates. Consent/recovery/handoff schemas are shared extension hooks; later route owners must enforce principal, per-booking grants, nonce allowlists and one-use receipts. Documenting their schemas does not claim those routes exist.

## Remaining gates and next readiness

- Canonical artifacts are ready for dependent authorization, quote, concurrency, route, adapter and documentation owners; use both schema validation and cross-field checks. The embedded validator intentionally supports exactly its declared JSON Schema vocabulary and refuses unsupported additions.
- State mapper inputs are trusted evidence, never caller booleans. It requires real customer/tenant/grant verification and authoritative payment reconciliation from downstream implementation. Pure denial tests do not establish database RLS or provider settlement.
- Full applied schema/ACL/overload/writer parity, isolated Supabase/Auth/Edge runtime, identity sandbox, both Stripe test legs, email sink, scheduling, actual HTTP/browser/provider compatibility and Miami/Tampa pilot remain required rollout gates. User has no separately configured staging/provider accounts yet; no production fallback was used.
- The partial SQL laboratory proves selected source gaps, not deployed parity. See `STAGING-FEASIBILITY.md`. Runtime feature exposure stays disabled until its gates pass.

## Self-Check: PASSED

All seven implementation files exist in the isolated worktree. All four listed task commits exist in that repository. Named tests, strict typechecks and generated contract parity passed. The pre-refresh full-unit fingerprint failure and its root-owned resolution are disclosed above; no unmet staging or cross-plan requirement is marked complete.
