---
phase: 01-api-docs-mcp-foundation
plan: "16"
status: partial
subsystem: frontend
tags: [availability, unknown, facade, vitest, fail-closed]
requires: [01-02, 01-05]
provides:
  - Required context and additive vehicle availability-authority DTO
  - Validated busy-range adapters and bounded availability reads
  - Live request preflight that rejects absent/stale/window-missing authority
  - Explicit mock evidence and confirmation fallback marked UNKNOWN
affects: [01-13, 01-08, 01-07]
tech-stack:
  added: []
  patterns: [five-minute observation freshness, tenant-local checked window, independent media degradation]
key-files:
  created:
    - domain/booking/externalAvailabilityTypes.test.ts
    - domain/booking/externalAvailability.test.ts
  modified:
    - domain/booking/types.ts
    - domain/booking/publicContracts.ts
    - domain/booking/adapters.ts
    - domain/booking/marketplace.test.ts
    - domain/booking/supabaseService.ts
    - domain/booking/mockService.ts
    - domain/booking/service.ts
    - domain/booking/service.test.ts
    - tests/protect/protect.wire.test.ts
key-decisions:
  - KNOWN describes observed ranges, not selected-date availability, reservation, customer authority or confirmation.
  - Live bookability requires valid ranges plus current authority covering the selected window; missing evidence is UNKNOWN.
  - Five-minute freshness matches the existing catalog refresh cycle; explicit window refresh supports selections outside the default horizon.
  - Mock evidence is assigned only by the configured mock branch and never used to recover a live failure.
requirements-requested: [FAIL-01, ISO-01]
requirements-completed: []
duration: 11min
completed: 2026-10-07
---

# Phase 1 Plan 16: Frontend availability authority Summary

**Availability failures remain UNKNOWN through DTOs, carts and direct booking calls; 95 affected tests and the full frontend TypeScript check pass.**

## Performance and isolation

- Started approximately 2026-10-07T16:33:00Z; completed 2026-10-07T16:44:00Z.
- Both implementation tasks delivered; whole phase operational proof remains partial.
- Eleven files: two new tests, nine modified source/fixture files.
- Worktree `<FRONTEND_CHECKOUT>`, branch `codex/agent-booking-frontend`, base `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d`.
- Fresh original frontend read-only status/commit/worktree snapshot at completion remained clean main `a2260c3`; existing Claude worktrees preserved. No root AGENTS.md/CLAUDE.md or project skill directories found in this scope.
- No original source edits, other worktree changes, source .env reads, live API/provider access, production mutation, deployment, push or global changes. Tests use explicit RPC/config mocks and a throwing global fetch stub. No dependencies installed by this executor.

## Delivered behavior

`AvailabilityAuthority` is exported from types.ts:

- `KNOWN {checkedAt,windowStart,windowEnd}`: validated observed busy ranges, including legitimately empty ranges.
- `UNKNOWN {reason,retryAfterSeconds}`: not_checked, upstream_unavailable, invalid_response, outside_checked_window or stale.

Vehicle authority is additive/optional for source compatibility; context authority is required and mirrored to vehicle. `adaptVehicleDetail` defaults UNKNOWN. `adaptBusyRanges` rejects null/non-array, missing fields, impossible dates and reversed ranges rather than dropping errors into an empty list. Prices, photo selection and existing itemized quote mapping are preserved.

Supabase context uses tenant-local default dates with a 180-day window, or optional explicit `{start,end}` third parameter on public/start/Supabase context calls. Invalid windows or timezone produce UNKNOWN. Availability/media waits are bounded independently to five seconds; valid photos remain usable during an availability failure. Successful empty rows establish KNOWN. Private error messages never appear in authority reasons.

Facade rereads `currentAvailabilityAuthority` after its request cache, propagates it through carts, and reassesses freshness on direct writes. `hasKnownAvailability` requires valid dates/ranges, selected-window coverage and a check at most five minutes old. Both `createRenterBooking` and directly exported `createSupabaseRenterBooking` reject UNKNOWN, missing, stale or outside-window evidence before a booking POST; known blocked/past/short ranges also fail. Errors have safe display copy and availability_unknown/dates_unavailable codes.

These browser checks are preflight only: callers can manipulate UI metadata, so backend quote/consent and universal inventory guard remain the real authority. No UI field authorizes a rental or holds inventory. Source mock mode stays explicit; checked mock contexts and carts preserve fixture evidence. Live errors never fall back to mocks. Token-authorized confirmation fallback is UNKNOWN and cannot be reused to create a new request.

## Verification

| Check | Executed result |
|---|---|
| Task 1 RED | Four expected failures: missing authority/helper and malformed ranges |
| Task 1 GREEN | 44 passed across authority types, adapters and marketplace slices |
| Task 2 RED | 13 expected failures, including unchecked write proceeding and unbounded availability |
| Final affected suites | **95 passed in nine files**, 0.613s reported wall duration |
| Full frontend `tsc --noEmit --incremental false` | **Passed** |

Final tests:

```sh
npm run test -- --run --no-cache \
 domain/booking/externalAvailability.test.ts \
 domain/booking/externalAvailabilityTypes.test.ts \
 domain/booking/service.test.ts domain/booking/adapters.test.ts \
 domain/booking/marketplace.test.ts tests/protect/protect.wire.test.ts \
 domain/booking/unfurl.test.ts domain/booking/quote.test.ts \
 domain/booking/marketplaceService.test.ts
node_modules/.bin/tsc --noEmit --incremental false
```

Coverage includes valid empty rows, timeout, malformed/impossible/reversed rows, missing/stale/outside-window authority, blocked dates, direct Supabase bypass, independent signing outage, exact-window refresh, confirmation fallback, tenant separation and explicit mock preservation. Existing protection wire payloads, quote values, image precedence and metadata/unfurl behavior continue passing. No original checkout tests/builds or live provider journey ran.

## Task commits

| Task | Commit |
|---|---|
| 1 RED: authority DTO boundary | `425393b` |
| 1 GREEN: DTO and validated adapters | `c8160ee` |
| 2 RED: failures, direct writes and mock distinction | `da2f225` |
| 2 GREEN: facade and service propagation | `547d25e` |

## Deviations from plan

1. **[Rule 2 - Missing critical] Added runtime freshness/window helpers and bounded waits.** Exported currentAvailabilityAuthority/hasKnownAvailability/validAvailabilityDate and five-minute freshness; unknown errors use safe reason codes. Context window refresh is additive. Required for checked-window/failure criteria, not new business decisions. Task commits c8160ee/547d25e.
2. **[Rule 3 - Blocking] Updated one existing protection wire fixture.** Direct Supabase creation now requires explicit known ranges. `tests/protect/protect.wire.test.ts` supplies KNOWN fixture evidence locally while preserving exact expected outbound JSON. No production payload change or global fixture rewrite. Commit 547d25e.

## Remaining gates / next readiness

- Plan 13 owns actual DatesStep/ReviewStep/BookingFlow and rangeIsBookable integration; those files were intentionally left to that owner. Use the exported helpers and refresh context for stale or changed dates before quote/request. Current server calls fail safely even though the UI integration is pending.
- The five-second Promise.race bounds waiting but does not abort underlying HTTP transport. Root was notified; optional AbortSignal transport wiring requires the rpcClient owner. No claim that an abandoned request was canceled.
- Full staging must prove actual Supabase responses, source/deployed parity, revised conservative day-calendar semantics, both providers and complete authorized journey. Offline mocks are not operational evidence.
- Parent owns shared STATE/ROADMAP/requirements and later frontend/backend reconciliation. FAIL-01/ISO-01 remain unmarked until all relevant phase gates, including plan 13, are closed.

## Known stubs / threat scan

No new production stubs introduced. Existing confirmation fallback blank photos/zero display prices remain intentional: real booking live snapshots supply money, authority is UNKNOWN and cannot authorize new booking. Existing PROTECT_ENABLED TODO comments are unchanged outside this workstream. No new endpoint, credential, raw card/identity data or authorization route introduced.

## Self-Check: PASSED

All eleven listed files exist and four task commits resolve as commits. Worktree clean after final implementation commit. Recorded affected test and full typecheck results passed. Partial operational/caller integration status remains explicit; shared planning state was not modified by this executor.
