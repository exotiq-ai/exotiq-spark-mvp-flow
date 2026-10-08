# Phase 1: API docs MCP foundation - Context

Gathered: 2026-10-07
Status: Ready for planning
Source: PRD express path <HANDOFF_ROOT>/PRD.md

<domain>
Complete all six subject areas as executable plans in one phase; request a split checkpoint only if fidelity cannot be retained.
</domain>

<decisions>
# Exotiq external agent booking foundation PRD

Planning only. Deliver the complete API/docs/MCP foundation; no implementation, deployments, pushes, merges, bookings, live mutations, credentials or .env reads. Inspect only the frontend <ORIGINAL_FRONTEND_CHECKOUT> and backend <ORIGINAL_BACKEND_CHECKOUT> read-only. All deliverables stay in this isolated output workspace. Another agent owns source work.

Exotiq expands exotic-car rentals city by city. User-stated live operator markets are Miami (https://book.exotiq.rent/ark) and Tampa (https://book.exotiq.rent/exotics-by-the-bay); upcoming Dallas and Westlake Village CA. https://book.exotiq.rent/exotiq is a demo: Scottsdale and $2/day Audi are intentional demo data. Do not claim sole marketplace status or guaranteed AI authority/ranking/onboarding/eligibility.

API is shared business interface, MCP thin adapter, deterministic existing backend remains authority. Preserve search -> dates -> itemized quote -> customer-authorized rental REQUEST -> pending operator approval -> approved/payment handoff -> actual verified confirmation. Verify actual states from backend. Reuse hosted checkout initially, preserve verification and separate operator/Exotiq charge accounting. Never give agents service-role keys, raw cards or identity documents.

Six mandatory areas: (1) verified capability/gap inventory, (2) versioned external API and customer authorization/visibility/errors, (3) quote accuracy/expiry/version binding/idempotency/double booking and precise holds, (4) OpenAPI/readable docs/separate staging/meaningful failure tests/observability/source consistency, (5) supported stable renter MCP/OAuth/tools/annotations with enforceable consent, (6) complete synthetic Miami/Tampa journey, approval/payment/notifications or polling/monitoring/rollback/verified confirmation and accuracy/handoffs metrics.

Existing findings are hypotheses to reverify: booking facade and RPC/edge adapters, server quote/requote, quote lacks reference/expiry, create input lacks retry key, availability errors converted to empty dates, token-gated restricted booking status, UI click suppression insufficient for distributed retries, sitemap only demo previously, no renter MCP/OpenAPI. Historical frontend docs are not current deployed truth.

Implementation requires isolated feature worktrees/branches, frontend/backend ownership and reconciliation, separate staging with synthetic data; shared functions/databases remain shared across worktrees. Staging access/deployed parity are future gates, never seek secrets now.

Deferred: operator preexisting website integration (links/embeds/widgets/SDK/custom integration) is a separate workstream, no v1 acceptance; delegated direct agent payment future; ACP/UCP optional future distribution subject to partner access/rental eligibility. Do not implement unsupported platform checkout in v1.

- CAP-01: Verify current frontend/backend capabilities, exact booking/payment states and gaps with source paths; distinguish historical patches and unverified deployment.
- API-01: Versioned search, availability, itemized quote, authorized rental request, status and hosted checkout-handoff API with structured errors.
- AUTH-01: Customer authorization, explicit consequential-action consent, least privilege per-booking scope, expiry/revocation, safe tokens and tenant isolation.
- VIS-01: Per-operator visibility/opt-in and accurate discovery; preserve browse restrictions and demo distinctions.
- QUOTE-01: Bind consent to quote reference, expiry, pricing and terms versions; reject changed or expired consent without silent repricing.
- SAFE-01: Distributed idempotency and double-booking protection with precise pending/hold semantics and atomic concurrency.
- FAIL-01: UNKNOWN availability and safe failures when backend prerequisites cannot be verified.
- PAY-01: Preserve operator approval, verification, separate operator/Exotiq charges and hosted checkout; request is never confirmation.
- DOC-01: Machine-readable OpenAPI and readable guide from shared source of truth, examples and compatibility checks.
- TEST-01: Separate staging, synthetic inventory/accounts and meaningful success/failure/concurrency/authorization acceptance tests.
- MCP-01: Thin renter MCP adapter using current stable primary protocol/SDK docs and compatible OAuth, tool schemas and accurate annotations enforced outside hints.
- OPS-01: One synthetic Miami/Tampa agent journey through approval/payment/verified confirmation, polling or notifications, observability, handoff accuracy, rollback and rollout gates.
- ISO-01: Isolated implementation branches/worktrees, explicit frontend/backend ownership, dependencies/reconciliation; worktrees do not isolate deployed services.

### Claude's Discretion
Concrete route names, expiry defaults, stable SDK choice, test tooling and plan decomposition based on research; document assumptions and gates.
</decisions>

<canonical_refs>
<HANDOFF_ROOT>/PRD.md
<HANDOFF_ROOT>/.planning/REQUIREMENTS.md
<HANDOFF_ROOT>/SOURCE-SNAPSHOT.md
Source-of-truth paths and verified line evidence are recorded in <HANDOFF_ROOT>/.planning/phases/01-api-docs-mcp-foundation/01-RESEARCH.md. Deployment remains unverified.
</canonical_refs>

<deferred>
Operator website integrations, delegated payments, ACP/UCP adapters.
</deferred>
