---
phase: 01-api-docs-mcp-foundation
plan: "09"
subsystem: lifecycle
status: local-implemented-hosted-acceptance-pending
tags: [stripe, identity, reconciliation, postgres, fault-injection]
requires: [01-03, 01-04, 01-05, 01-06, 01-08]
provides: [atomic identity completion, trusted settlement ledger, guarded confirmation, bounded fair reconciliation]
affects: [01-09-task-1, 01-14, 01-15, rollout]
key-files:
  created:
    - supabase/functions/_shared/external-booking/lifecycle.ts
    - supabase/migrations/20261007090500_external_lifecycle_reconciliation.sql
    - tests/agent-booking/payment-states-unit.test.ts
    - tests/agent-booking/payment-states.test.ts
  modified:
    - supabase/functions/identity-webhook/index.ts
    - supabase/functions/rent-payment-webhook/index.ts
    - supabase/functions/rent-payment-scheduler/index.ts
completed: 2026-10-07
---

# Phase 01 Plan 09 Task 2: Lifecycle Summary

Identity completion now commits its durable event receipt, customer evidence and booking transitions in one database transaction; payment confirmation requires exact settled proof for both charge legs and owned, unexpired identity.

This adjunct covers Task 2 only. The orchestrator assigned Task 1 request/status/API dispatch to a separate owner. STATE, roadmap, generated provenance and final combined plan summary remain orchestrator-owned.

## Changes

The existing identity webhook recorded an event before its later booking promotion. A promotion failure could therefore consume the event while leaving the booking stuck permanently. The new service-only `external_apply_identity_event` records completion inside the same transaction as identity, customer and booking updates. Any promotion failure rolls back the whole transaction. SDK report lookup must succeed and provide a real document expiry before verified identity can be persisted. Duplicate and older deliveries cannot regress verified identity or increment failed attempts again.

The payment webhook records trusted succeeded PaymentIntents with exact received amounts, currency, mode, booking metadata, charge leg and operator destination. A payment reference, browser redirect, or `paid_at` cannot establish settlement. A source numeric USD conversion uses decimal parsing and integer arithmetic, with no silent rounding. `external_record_settlement` checks the database's source snapshot again and records immutable evidence; `external_reconcile_booking` confirms only after both exact legs and identity clear. External bookings additionally bind the consumed quote's operator, vehicle, customer, rental window, protection option and every fee to the booking. The confirmation trigger rejects changing those fields in the same statement as confirmation.

Identity for an external renter must belong to its currently verified operator/customer link and the current or previous external booking for the same issuer, subject, customer and operator. Historical guest records based on typed email cannot authorize that identity. Revoked links cannot satisfy the predicate.

The rent webhook uses a durable completion lease with a fenced claim token. Failed processing releases the lease for retry; an old worker cannot acknowledge another worker's lease. Distinct checkout event IDs share one durable Exotiq charge key bound to the booking and captured operator intent. The Stripe request parameters stay identical across retries, including using the captured intent's customer and omitting the changing analytics attempt counter from provider metadata. An attempt older than 23 hours yields reconciliation rather than a new automatic charge. Reference-only or duplicate operator settlement evidence cannot start a fee charge.

Financially unresolved pending rows preserve inventory when an expiry sweep tries to cancel them. The existing 24-hour identity hold, 72-hour request, and approved payment deadline policies remain unchanged. The scheduler first runs a bounded reconciliation batch. Its separate `external_reconciliation_checked_at` cursor rotates work fairly, so the oldest stuck rows cannot permanently starve later bookings. Neither missing nor historical payment mode is guessed as test mode.

## Commits and verification

| Commit | Result |
| --- | --- |
| `38cd1637` | Initial RED lifecycle tests: missing settlement/identity module fails. |
| `340c90e7` | Durable settlement, identity transaction, guarded transitions and scheduler wiring. |
| `e86a90d5` | Offline handler evidence separated from explicit hosted parity gate. |
| `a2fcb3e7` | Regression RED against committed handler: distinct deliveries changed Stripe key and analytics metadata. |
| `cf23e046` | GREEN stable charge identity/parameters, full financial tuple, fair scheduler and confirmation snapshot guard. |
| `79a47fc9` | RED actual handler test: a failed late-payment refund was acknowledged as completed. |
| `615d3f52` | GREEN late-capture durable financial queue and retryable refund failure. |

`npm run test:agent:unit -- --run tests/agent-booking/payment-states-unit.test.ts`: **9 passed**. Tests include the actual edge handler source executed with clearly labeled offline transport/SDK doubles: identity transaction failure returns 500 then retries; report lookup failure performs no identity RPC; renter cannot use the actual operator approval handler; two actual payment handler deliveries after ambiguous SDK failure issue identical charge parameters; a late capture first creates durable financial reconciliation and a failed refund returns 500 without consuming the event. These doubles do not prove Stripe signatures or hosted provider behavior.

Targeted strict TypeScript check of `lifecycle.ts` and the unit test: **passed**. `git diff --check`: **passed**. Worktree clean after commits.

`npm run test:agent:staging -- --run tests/agent-booking/payment-states.test.ts`: **refused as expected** because dedicated staging evidence is absent. The named staging file contains an explicit skipped hosted parity gate; it does not relabel offline doubles as integration evidence.

The orchestrator applied the latest exact function replacements in its guarded PostgreSQL 17 lab and executed the complete lifecycle assertion transaction: **PASS, nine success notices, final ROLLBACK**. Genuine SQL checked requested approval/ref-only denial/exact settled legs/identity gates, injected atomic identity rollback, stable fee keys and actual settled-operator prerequisite, 24-hour key cutoff, fair bounded reconciliation, explicit zero-fee proof, combined snapshot-edit/confirmation refusal, late-capture terminal financial queue, duplicate/out-of-order events, fenced completion, consumed quote complete rental/cents binding, historical guest identity denial, current owner identity and revocation, anonymous RPC/evidence denial and service direct ledger DML denial. Evidence is `integration-lab/lifecycle-check-evidence.txt`. Two earlier runs exposed fixture errors (consent inserted after quote consumption; reversing immutable customer-link revocation); they rolled back and were corrected to use actual 08→06 RPCs and preserve revocation. The final complete run passed. This is actual partial-schema synthetic PostgreSQL evidence, not hosted provider or full Supabase schema acceptance.

Lab files are separate guarded synthetic artifacts: `integration-lab/lifecycle-dependencies.sql`, `lifecycle-charge-update.sql`, `lifecycle-check.sql`. The explicit delta matches canonical function bodies and introduces only newly approved objects; it does not replay historical migrations or use existence guards to hide drift. Parent alone executes lab mutations. Every assertion fixture rolls back.

## Deviations and gates

1. **Rule 1/2:** Added a narrowly scoped migration, shared lifecycle module, durable evidence/attempt/completion/queue tables and fair scheduler column. Handler-only changes could not make identity completion atomic or distinguish durable settlement from references. The orchestrator expressly authorized the narrow lifecycle migration and reviewed synthetic dependencies.
2. **Rule 1:** Actual handler regression exposed different idempotency keys across distinct checkout events and mutable provider metadata. The regression was demonstrated against committed source before the fix.
3. **Verification adaptation:** The user has no dedicated Supabase/provider staging and authorized isolated tests. Offline unit and genuine partial-schema SQL evidence are reported separately; hosted acceptance remains unmet.

A verified decline or an ambiguous charge outside the 23-hour key window needs controlled financial reconciliation; the build does not automatically mint a new charge key. The queue is durable, but operator resolution tooling, real Stripe lookup/recovery and decline-with-new-card behavior require provider acceptance and an explicitly safe recovery policy before rollout. Historical paid/reference-only rows are never silently backfilled as settled proof; deployment needs reviewed reconciliation of existing financial records. Zero Exotiq fees have explicit zero settlement evidence, while the legacy checkout's unsupported zero operator rental remains a capability/rollout gate.

No hosted signature, real identity report, network fault, Stripe destination/dual-leg or deployed cron parity was exercised. A reviewed complete Supabase schema/ACL migration sequence, configured test accounts, verified identity expiry semantics and provider compatibility remain release gates. Only isolated worktrees and rollback synthetic SQL were used; no original source, credentials or production systems were changed.

## Known stubs

The staging parity test is intentionally skipped until configured, reviewed provider staging exists. It prevents claiming full plan acceptance. Production lifecycle handlers have actual SDK and RPC wiring; they do not contain mock providers or an in-memory production ledger.

## Threat flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: service-proof-rpcs | `20261007090500_external_lifecycle_reconciliation.sql` | Service-only settlement and identity evidence form a new trust boundary. Public/anonymous/customer execution and direct service ledger DML are denied; trusted handlers verify provider input before calling them. |
| threat_flag: financial-recovery | `rent-payment-webhook/index.ts` | Durable retries can reach a bounded ambiguity queue. Recovery must verify actual provider state before permitting a new charge identity. |

## Self-Check: PASSED

All seven implementation/test files exist and all seven listed commits exist on the isolated plan09 branch. No API Task 1 files, STATE or roadmap were modified. Hosted acceptance remains pending as documented above.
