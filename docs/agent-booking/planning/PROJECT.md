# Exotiq agent booking foundation

## What This Is
A brownfield API/MCP implementation with a follow-on agent discovery and isolated demo-fleet pilot planning/testing phase.

## Core Value
An authorized customer agent obtains an accurate quote and reliable rental request/status/hosted-payment handoff without bypassing rental rules.

## Requirements
### Validated
Phase01 local build is integrated and tested; full hosted acceptance remains unverified. Phase02 adds agent discovery and closes those acceptance/operational gaps.
### Active
- [ ] CAP-01: Verify current frontend/backend capabilities, exact booking/payment states and gaps with source paths; distinguish historical patches and unverified deployment.
- [ ] API-01: Versioned search, availability, itemized quote, authorized rental request, status and hosted checkout-handoff API with structured errors.
- [ ] AUTH-01: Customer authorization, explicit consequential-action consent, least privilege per-booking scope, expiry/revocation, safe tokens and tenant isolation.
- [ ] VIS-01: Per-operator visibility/opt-in and accurate discovery; preserve browse restrictions and demo distinctions.
- [ ] QUOTE-01: Bind consent to quote reference, expiry, pricing and terms versions; reject changed or expired consent without silent repricing.
- [ ] SAFE-01: Distributed idempotency and double-booking protection with precise pending/hold semantics and atomic concurrency.
- [ ] FAIL-01: UNKNOWN availability and safe failures when backend prerequisites cannot be verified.
- [ ] PAY-01: Preserve operator approval, verification, separate operator/Exotiq charges and hosted checkout; request is never confirmation.
- [ ] DOC-01: Machine-readable OpenAPI and readable guide from shared source of truth, examples and compatibility checks.
- [ ] TEST-01: Separate staging, synthetic inventory/accounts and meaningful success/failure/concurrency/authorization acceptance tests.
- [ ] MCP-01: Thin renter MCP adapter using current stable primary protocol/SDK docs and compatible OAuth, tool schemas and accurate annotations enforced outside hints.
- [ ] OPS-01: One synthetic Miami/Tampa agent journey through approval/payment/verified confirmation, polling or notifications, observability, handoff accuracy, rollback and rollout gates.
- [ ] ISO-01: Isolated implementation branches/worktrees, explicit frontend/backend ownership, dependencies/reconciliation; worktrees do not isolate deployed services.

### Out of Scope
Operator website integrations; delegated direct payment; ACP/UCP implementation.

## Context
See ../PRD.md and ../SOURCE-SNAPSHOT.md.

## Constraints
Original source repositories remain read-only. User authorized isolated build/tests and now phase02 planning, read-only public discovery checks and a separately selected staging rehearsal. No production booking/payment/identity mutation or launch in this turn. Existing candidate staging ownership/reuse, account labels and budget need clarification before hosted resource changes. Secrets belong in approved local environment/secret storage, never public files or reports.

## Key Decisions
API shared authority; thin MCP; deterministic backend; preserve approval, human consent and hosted checkout. User nominated book.exotiq.rent/exotiq Exotic Demo Fleet as the staging cohort on2026-10-08. Public discovery tests do not establish safe booking-provider modes. No guaranteed first rank or universal client support. Root technical lead plus delegated operations lead; named human operations accountability needed before launch.
