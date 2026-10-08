---
phase: 01-api-docs-mcp-foundation
plan: 13
subsystem: storefront-availability
tags: [react, availability, fail-closed, jsdom, abort-signal]
requires:
  - plan: 01-16
    provides: checked-window availability authority and guarded service facade
  - plan: 01-05
    provides: shared database inventory policy and read parity
provides:
  - real calendar, flow transition, quote and request handler authority gates
  - owned-context availability retry and stale quote suppression
  - isolated actual-component integration and cancellable read transport tests
affects: [01-14, 01-15, rollout-verification]
tech-stack:
  added: [jsdom@26.1.0, '@types/jsdom@21.1.7']
  patterns: [current-window guards, synchronous request lock, fetch AbortSignal]
key-files:
  created:
    - components/drive-exotiq/flow/AvailabilityProceed.test.tsx
    - components/drive-exotiq/flow/AvailabilityProceed.integration.test.tsx
    - domain/booking/availabilityTransport.test.ts
  modified:
    - domain/booking/availability.ts
    - components/drive-exotiq/BookingFlow.tsx
    - components/drive-exotiq/flow/DatesStep.tsx
    - components/drive-exotiq/flow/ReviewStep.tsx
    - domain/booking/rpcClient.ts
    - domain/booking/supabaseService.ts
key-decisions:
  - Missing or expired evidence blocks proceed independently of pricing and disabled DOM state.
  - Retry reads the current selected window and never substitutes empty busy ranges for failure.
  - Timed-out context reads abort fetch; this is not proof of database statement cancellation.
duration: 17min
completed: 2026-10-07
implementation-status: complete-local
operational-status: partial
---

# Phase 1 Plan 13: Storefront availability enforcement Summary

The actual calendar and booking flow now require fresh checked-window evidence before proceeding, quoting or requesting, with real mounted-component tests proving stale quote and captured-handler denial.

## Provenance and isolation

Implementation runs only in `<FRONTEND_CHECKOUT>`, branch `codex/agent-booking-frontend`, immediately after plan 16 commit `547d25e`. Original frontend base is `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d`; original source and other executor worktrees were not modified. This plan uses upstream 16 contracts and the integrated 05 inventory/read policy; it changes no database migration. The user authorized the build and expressly chose isolated local tests without a hosted staging project. Every new test mocks fetch or RPC boundaries and denies outbound network. No real backend calls, secret reads, deployments or pushes occurred. Root owns shared execution state/provenance updates.

## Task commits

| Task | Commit | Result |
| --- | --- | --- |
| 1 RED | `0bb80da` | Real calendar/review tests initially failed 4 of 5 checks against unchecked authority. Added pinned local DOM dev dependencies. |
| 1 GREEN | `b0ce916` | Missing, UNKNOWN, stale and outside-window authority blocks shared rule, Continue, next, quote and request handlers. |
| 2 RED | `6eae37b` | Eight actual BookingFlow integration cases; one failed on blocked-check retry/day verification. |
| 2 GREEN | `0980057` | Correct checked-window day markers, retain retry for checked blocked dates, update existing fee/protection pins to assert stronger guards. |
| Read cancellation RED | `bdc2fd4` | Actual transport test proved old Promise.race did not abort fetch. |
| Read cancellation/compatibility GREEN | `3f48561` | Optional AbortSignal propagation and bounded context reads; affected legacy fixtures explicitly establish synthetic authority. |

## Changes

- `rangeIsBookable` rejects unvalidated or expired authority and intervals outside the checked window before iterating busy ranges. Explicit mock carts receive checked fixture evidence through upstream 16.
- DatesStep marks unchecked future dates `data-unverified` with accessible names rather than claiming they are taken. It exposes an availability status/retry, disables Continue and independently rechecks its callback. Checked blocked dates remain marked taken and cannot proceed.
- BookingFlow checks authority when seeding dates, advancing steps, requesting quotes and sending requests. A synchronous ref prevents duplicate requests before React renders. Captured handlers read current cart/evidence rather than trusting stale closure state.
- A changed incoming vehicle authority applies during render before effects. Quote identity includes authority and busy ranges; stale async quote completion cannot restore a request with unknown evidence. Thirty-second render ticks make expired evidence visible; every callback checks current time independently.
- Retry immediately clears trusted quote/evidence, reloads the owned team/vehicle context for the current selected interval and discards results if the selection changed. Failed reads preserve UNKNOWN. Driver and Review screens provide an availability recovery path too.
- Review combines authority, pricing, pending request and terms gates. Direct invocation of its callback cannot bypass the authority/pricing guards.
- Actual context lookup, availability and media reads have five-second bounds and pass AbortSignal through fetch. Transport tests verify fetch signals abort and timers clear; initial hung team/vehicle lookups reject instead of leaving availability Retry pending forever.

## Verification

Final command in isolated frontend worktree:

`npx vitest run components/drive-exotiq/flow domain/booking tests/fees tests/protect tests/chrome`

**45 files passed; 242 tests passed; 5 skipped.** Skips are existing opt-in golden recording/base-reference checks, not skipped availability acceptance. New acceptance consists of 5 mounted calendar/review tests, 8 mounted actual BookingFlow integration tests and 3 actual transport tests. They exercise missing/UNKNOWN/stale evidence, seeded dates, out-of-window date selection, failed/blocked/successful retry, late quote completion, ready quote followed by UNKNOWN, expiry without a render, actual service facade denial and rapid direct request calls. Real DatesStep, DriverStep and ReviewStep are mounted; only backend/provider/network boundaries and unrelated analytics/presentation integrations are mocked. Test access to real React callback props deliberately exercises paths a disabled DOM click cannot reach.

`npx tsc --noEmit --incremental false` **passed**, checking all source components and contract props. A narrower 11-file run also passed 92 tests before the final broader affected run.

Earlier broad execution surfaced three task-caused fixture/guard assumptions: no new dev dependency ever, wire fixtures lacking newly mandatory authority, and raw mock calendar fixture interpreted as unchecked. These now use only the pinned DOM allowlist or explicit successful synthetic/mock authority. Recorded HTML golden files and production request bodies were not changed. Fees/protection and chrome suites pass.

No full Next build, real browser/provider staging acceptance or deployment was claimed. jsdom is mounted React DOM evidence, not a browser interoperability certification.

## Deviations from Plan

1. **Rule 2 — Missing critical transport cancellation:** Root authorized the minimal transport extension. Existing availability Promise.race bounded UI waiting but left fetch active; optional AbortSignal arguments were added to four read methods, and the two initial context lookups now also have five-second bounds. Added `domain/booking/availabilityTransport.test.ts`, modified `rpcClient.ts`/`supabaseService.ts` and adjusted explicit signal assertions in upstream tests. Commits `bdc2fd4`, `3f48561`.
2. **Rule 3 — DOM test runtime:** The repository had no mounted DOM environment. Added only pinned jsdom and its type package as isolated dev dependencies; no runtime dependency changes or linked dependency installs. Manifest restraint test now permits precisely those two versions while retaining arbitrary dependency/version-change denials. Commits `0bb80da`, `3f48561`.
3. **Rule 1 — Compatibility fixture and source pins:** Existing fee/protection tests asserted old exact source guards or omitted authority on wire-only mock carts. Updated fixtures to valid explicit evidence and pins to stronger guards. Goldens are preserved. Commits `0980057`, `3f48561`.
4. Shared STATE/ROADMAP/REQUIREMENTS remain root-owned as explicitly delegated; this executor writes only this summary and task commits.

## Remaining operational gates

Provider staging, real browser/two-client compatibility, schema/writer coverage, identity and both-payment-leg verification, operator opt-in and rollout owner/provenance evidence remain required before exposure. This plan proves the isolated frontend safety paths and does not substitute for those gates.

Existing quote and booking-create transports rely on endpoint response/deadline behavior. A hung KNOWN quote/create can retain pending UI until upstream resolves. Creation retry needs ambiguous-outcome/idempotency handling; no blind write retry was introduced. This follow-up was sent to root for API deadline/reconciliation coverage. Fetch abort tests do not establish that a remote PostgreSQL statement is cancelled.

## Known Stubs

No new stub prevents this plan's local goal. Explicit mock mode and synthetic test fixtures are intentional upstream contracts. Existing `TODO(PROTECT_ENABLED)` flag commentary and confirmation placeholder totals predate this plan and are outside this availability change.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: read-cancellation | domain/booking/rpcClient.ts | Additive AbortSignal propagates to existing public read fetch boundaries; tests prove timeout cancellation and no trusted fallback availability. No endpoint, identity, privilege or schema surface added. |

## Self-Check: PASSED

All named implementation/test files exist; six task commits resolve on the isolated branch. Final affected tests and full source type check passed. No generated runtime file remains untracked. Operational status remains partial until the listed rollout gates are evidenced.
