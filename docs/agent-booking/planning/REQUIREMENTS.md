# Requirements: Exotiq agent booking foundation

Defined: 2026-10-07

## v1 Requirements
- [ ] **CAP-01**: Verify current frontend/backend capabilities, exact booking/payment states and gaps with source paths; distinguish historical patches and unverified deployment.
- [ ] **API-01**: Versioned search, availability, itemized quote, authorized rental request, status and hosted checkout-handoff API with structured errors.
- [ ] **AUTH-01**: Customer authorization, explicit consequential-action consent, least privilege per-booking scope, expiry/revocation, safe tokens and tenant isolation.
- [ ] **VIS-01**: Per-operator visibility/opt-in and accurate discovery; preserve browse restrictions and demo distinctions.
- [ ] **QUOTE-01**: Bind consent to quote reference, expiry, pricing and terms versions; reject changed or expired consent without silent repricing.
- [ ] **SAFE-01**: Distributed idempotency and double-booking protection with precise pending/hold semantics and atomic concurrency.
- [ ] **FAIL-01**: UNKNOWN availability and safe failures when backend prerequisites cannot be verified.
- [ ] **PAY-01**: Preserve operator approval, verification, separate operator/Exotiq charges and hosted checkout; request is never confirmation.
- [ ] **DOC-01**: Machine-readable OpenAPI and readable guide from shared source of truth, examples and compatibility checks.
- [ ] **TEST-01**: Separate staging, synthetic inventory/accounts and meaningful success/failure/concurrency/authorization acceptance tests.
- [ ] **MCP-01**: Thin renter MCP adapter using current stable primary protocol/SDK docs and compatible OAuth, tool schemas and accurate annotations enforced outside hints.
- [ ] **OPS-01**: One synthetic Miami/Tampa agent journey through approval/payment/verified confirmation, polling or notifications, observability, handoff accuracy, rollback and rollout gates.
- [ ] **ISO-01**: Isolated implementation branches/worktrees, explicit frontend/backend ownership, dependencies/reconciliation; worktrees do not isolate deployed services.

## Deferred
Operator website integrations; delegated payment; optional ACP/UCP.

## Traceability
| Requirement | Phase | Status |
|---|---|---|
| CAP-01 | Phase 1 | Pending |
| API-01 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| VIS-01 | Phase 1 | Pending |
| QUOTE-01 | Phase 1 | Pending |
| SAFE-01 | Phase 1 | Pending |
| FAIL-01 | Phase 1 | Pending |
| PAY-01 | Phase 1 | Pending |
| DOC-01 | Phase 1 | Pending |
| TEST-01 | Phase 1 | Pending |
| MCP-01 | Phase 1 | Pending |
| OPS-01 | Phase 1 | Pending |
| ISO-01 | Phase 1 | Pending |

Coverage:13 total;13 mapped;0 unmapped. Checkboxes and Pending statuses refer to full acceptance, not absence of local implementation. Fifteen plans are locally delivered; plan12 is partial. Full requirement acceptance stays pending because complete hosted/provider/schema proof and operational code gaps remain. See BUILD-STATUS and01-VERIFICATION; no requirement is silently marked complete by local test success.

## Phase 2 requirements — October 8, 2026

- [ ] **STAGE-02**: Separate, attested synthetic backend, OAuth, identity, both payment legs, notification sink, jobs and gateway; no production fallback or resource creation beyond the selected budget.
- [ ] **PAYREC-02**: Provider-authoritative uncertain-payment resolution and audited safe inventory clearance; preserve paid or ambiguous holds, current authority, original attempt keys and both payment-leg evidence.
- [ ] **PILOT-02**: Executable guarded Playwright/API/MCP confirmed journeys plus adverse, recovery and rollback checks; the nominated demo fleet is an explicitly isolated staging cohort.
- [ ] **DISC-02**: Correct host routing, canonical URLs, robots, sitemap, server-rendered content and private indexing policy, with dated public crawl evidence and crawler-class distinctions.
- [ ] **TENANT-02**: Accurate eligible tenant and vehicle content, opt-in and demo rules, geography, price, availability and terms provenance, and stable canonical slugs.
- [ ] **SCHEMA-02**: Truthful structured data for actual marketplace, operators, vehicles and services, validated JSON-LD with stable IDs and no invented offers/actions; complete applied database parity before provider acceptance.
- [ ] **DOCS-02**: Maintainable generated public API/MCP discovery and human/agent guides; optional llms/agent files accurately labeled, with no authority or secret leaks.
- [ ] **AGENT-02**: Measured cold discovery, supplied-URL browsing and authenticated MCP trials, plus human-authorized black-box Dot/another named agent E2E; unidentified products remain unverified.
- [ ] **OPS-02**: Assigned operations owner and backup, payment-exception runbook, measured thresholds, pause/resume, existing-booking continuity and a reviewed small opt-in pilot.
- [ ] **EVOL-02**: Versioned contract, content and source provenance checks, dependency/protocol maintenance ownership and feedback from tests; no first-place ranking or permanent compatibility guarantee.

### Phase 2 traceability

| Requirement | Phase | Acceptance status |
|---|---|---|
| STAGE-02 | Phase 2 | Pending |
| PAYREC-02 | Phase 2 | Pending |
| PILOT-02 | Phase 2 | Pending |
| DISC-02 | Phase 2 | Pending |
| TENANT-02 | Phase 2 | Pending |
| SCHEMA-02 | Phase 2 | Pending |
| DOCS-02 | Phase 2 | Pending |
| AGENT-02 | Phase 2 | Pending |
| OPS-02 | Phase 2 | Pending |
| EVOL-02 | Phase 2 | Pending |

Combined coverage: 23 requirements mapped to phases; zero full acceptance. Phase 1's 13 requirements and Phase 2's 10 requirements remain unchecked. Writing or checking a plan does not satisfy its acceptance criteria.
