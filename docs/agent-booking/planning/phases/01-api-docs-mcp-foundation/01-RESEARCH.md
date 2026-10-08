# Phase 1: API docs MCP foundation — Research

**Researched:** 2026-10-07
**Domain:** Brownfield rental API, consent-bound booking, documentation and remote renter MCP
**Confidence:** HIGH for inspected source and primary protocol documentation; deployed parity remains unknown.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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


[VERIFIED: 01-CONTEXT.md; verbatim user constraints, not externally verified market claims]

### Codex's Discretion
Concrete route names, expiry defaults, stable SDK choice, test tooling and plan decomposition based on research; document assumptions and gates.

### Deferred Ideas (OUT OF SCOPE)
Operator website integrations, delegated payments, ACP/UCP adapters.
</user_constraints>

## Summary

The inspected backend already has public catalog/quote RPCs, transactional request insertion, marketplace overlap exclusion, approval, token-gated hosted checkout, separate operator/Exotiq payment legs, identity promotion and expiry scheduling. Reuse these capabilities. Add an external authorization/contract boundary and transactional quote-consent/idempotency records rather than another pricing engine. Local source presence does not prove migration application, deployed functions, scheduled jobs or payment configuration. [VERIFIED: backend paths in Capability Inventory; SOURCE-SNAPSHOT.md]

The most consequential gaps are consent binding across quote and request, distributed request retries, mixed-source concurrency, UNKNOWN availability, and renter delegation. The frontend quote/create types have no quote reference/expiry/version or caller retry key; the create edge handler calculates a fresh quote before inserting. Its SQL overlap precheck sees all blocking booking sources, while the existing exclusion constraint applies only to marketplace rows. These are verified local contract/implementation limits, not claims about all deployed safeguards. [VERIFIED: F/publicContracts.ts:100-132; F/rpcClient.ts:280-295; B/rent-create-booking/index.ts:132-188; M/20260819031937*:93-101; M/20260722051127*:24-32]

**Primary recommendation:** Implement one versioned API boundary backed by atomic deterministic booking operations, then use a separate thin OAuth MCP server and shared contract tests. Rollout remains gated by separate staging and deployed/source parity evidence. [VERIFIED: PRD.md; recommendations derived from inspected gaps]

## Project Constraints (from AGENTS.md)

No applicable root/ancestor AGENTS.md or CLAUDE.md was found in the orchestrator's scoped instruction scan. Nested remotion/CLAUDE.md is outside this phase. Neither source root contains .Codex/skills or .agents/skills. Re-scan instructions in implementation worktrees before edits. Planning sources are read-only; no builds/tests, credentials, live services or source mutation were performed. [VERIFIED: SOURCE-SNAPSHOT.md; scoped rg probes]

<phase_requirements>
## Phase Requirements

Descriptions are copied from REQUIREMENTS.md. [VERIFIED: .planning/REQUIREMENTS.md]

| ID | Description | Research Support |
|---|---|---|
| CAP-01 | Verify current frontend/backend capabilities, exact booking/payment states and gaps with source paths; distinguish historical patches and unverified deployment. | Capability Inventory and lifecycle |
| API-01 | Versioned search, availability, itemized quote, authorized rental request, status and hosted checkout-handoff API with structured errors. | Boundary contract |
| AUTH-01 | Customer authorization, explicit consequential-action consent, least privilege per-booking scope, expiry/revocation, safe tokens and tenant isolation. | Authorization and security |
| VIS-01 | Per-operator visibility/opt-in and accurate discovery; preserve browse restrictions and demo distinctions. | Eligibility and discovery |
| QUOTE-01 | Bind consent to quote reference, expiry, pricing and terms versions; reject changed or expired consent without silent repricing. | Atomic quote consumption |
| SAFE-01 | Distributed idempotency and double-booking protection with precise pending/hold semantics and atomic concurrency. | Locks, exclusion and retry ledger |
| FAIL-01 | UNKNOWN availability and safe failures when backend prerequisites cannot be verified. | Tri-state availability/errors |
| PAY-01 | Preserve operator approval, verification, separate operator/Exotiq charges and hosted checkout; request is never confirmation. | Lifecycle/payment evidence |
| DOC-01 | Machine-readable OpenAPI and readable guide from shared source of truth, examples and compatibility checks. | Contract-first documentation |
| TEST-01 | Separate staging, synthetic inventory/accounts and meaningful success/failure/concurrency/authorization acceptance tests. | Validation architecture |
| MCP-01 | Thin renter MCP adapter using current stable primary protocol/SDK docs and compatible OAuth, tool schemas and accurate annotations enforced outside hints. | Stable v2 protocol/SDK and tools |
| OPS-01 | One synthetic Miami/Tampa agent journey through approval/payment/verified confirmation, polling or notifications, observability, handoff accuracy, rollback and rollout gates. | Pilot/operations |
| ISO-01 | Isolated implementation branches/worktrees, explicit frontend/backend ownership, dependencies/reconciliation; worktrees do not isolate deployed services. | Ownership and staging gates |
</phase_requirements>

## Standard Stack

| Component | Version | Purpose and decision |
|---|---|---|
| Existing backend Deno edge functions + PostgreSQL | Supabase JS import 2.77.0; deployed DB/runtime unverified | Preserve established authority; do not upgrade the marketplace stack during this feature. [VERIFIED: B/rent-create-booking/index.ts:27-29] |
| Existing frontend Next/React/TypeScript | package ranges Next ^14.2.0, React ^18.3.0, TS ^5 | Compatibility target; lockfile resolution must be captured in implementation worktree. [VERIFIED: F/package.json] |
| MCP TypeScript server | @modelcontextprotocol/server 2.3.1, published 2026-10-05 | New isolated adapter uses released v2 stable line. Official repository identifies v2 as stable; v1 @modelcontextprotocol/sdk 1.32.1 is maintenance line. [VERIFIED: npm registry; CITED: https://github.com/modelcontextprotocol/typescript-sdk] |
| MCP client (test only) | @modelcontextprotocol/client 2.3.1 | Protocol integration tests; registry latest verified. [VERIFIED: npm registry] |
| Zod | 4.6.5, published 2026-09-13 | Validate adapter inputs/outputs with SDK-compatible schemas; share transport-independent contract definitions. [VERIFIED: npm registry; CITED: https://ts.sdk.modelcontextprotocol.io/v2/] |
| OpenAPI | 3.1.2 recommended compatibility baseline | Current published specification is 3.2.1 (2026-09-10). Pin 3.1.2 for v1 contract until lint/render/client tooling passes explicit 3.2 compatibility checks. This compatibility choice is a recommendation, not a verified tooling limitation. [CITED: https://spec.openapis.org/oas/latest.html] |
| Existing Vitest / Playwright | frontend Vitest ^4.1.6; backend ^3.2.6 / Playwright ^1.60.0 | Reuse each repo's test tooling; create Node-environment adapter test config rather than backend jsdom default. [VERIFIED: F/package.json; backend package.json and vitest.config.ts] |

Future adapter-only installation: `npm install --save-exact @modelcontextprotocol/server@2.3.1 zod@4.6.5`; test dependency `@modelcontextprotocol/client@2.3.1`. Reverify registry and lock exact compatible versions when execution begins. No installation was performed. [VERIFIED: npm registry; PRD planning-only constraint]

## Capability Inventory

Path aliases: F = frontend `domain/booking/`; B = backend `supabase/functions/`; M = backend `supabase/migrations/`. Exact source root paths and commits are in SOURCE-SNAPSHOT.md. References with `*` abbreviate the unique migration filename prefix in that directory. [VERIFIED: SOURCE-SNAPSHOT.md; rg file inventory]

| Capability | Verified local evidence | Planning implication |
|---|---|---|
| Shared frontend facade/RPCs | F/service.ts; F/rpcClient.ts:154-217,273-348 | Reuse search/team/fleet/vehicle/availability/quote/status/checkout capabilities behind API DTOs. |
| Quote integer cents and fee/tax splits | M/20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql:42-150 | Keep server arithmetic and separate operator/Exotiq totals; quote itself neither inserts booking nor holds inventory. |
| Server requote + booking snapshot | B/rent-create-booking/index.ts:132-188 | Add quote-consent consumption inside transaction; reject changed snapshot rather than accepting fresh price silently. |
| Distributed overlap protection | M/20260722051127_c9a90611-18bc-46ef-aa5b-566cc51c77d0.sql:24-32; M/20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql:93-101 | Existing GiST marketplace guard is useful; mixed-source races and buffer behavior require hardening/tests. |
| Precise wall-clock conversion | M/20260819031937*:80-98 | Preserve distinct pickup/return time, tenant timezone and half-open ranges. |
| Busy windows include buffer | M/20260819031937*:1-29 | Busy display expands by rental_buffer_minutes (default 60); insertion overlap uses unbuffered ranges. Reconcile this mismatch in shared booking rules. |
| Availability error swallowed | F/supabaseService.ts:94 | External interface must expose UNKNOWN, not empty blocked dates. |
| Customer token status | M/20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql:197-249 | Latest inspected definition requires matching token and returns no row for absent/wrong token; older restricted-existence contracts must not be treated as current truth. |
| Checkout token/state/expiry guards | B/rent-checkout/index.ts:76-105,194 | Preserve pending_payment requirement, expiry and rental_already_paid protection; hosted handoff only. |
| Operator authorization + approval | B/rent-approve-booking/index.ts:51-111 | Keep operator-only approval; agent tools never approve. |
| Identity promotion | B/identity-webhook/index.ts:194-223 | Unpaid pending_documents promotes to requested; paid pending_documents promotes to confirmed. |
| Payment completion | B/rent-payment-webhook/index.ts:48-107,275-298,375-421 | Both charge-leg references, identity and guarded state transition; deduplicated webhook path. Prove successful settlement, not just reference presence, with synthetic integration tests. |
| Request/approval expiry | M/20260728152708_256354b7-9f0f-4e1d-a9a0-33e45ca82d04.sql:4-32; B/_shared/rentFormat.ts:88-100; B/rent-payment-scheduler/index.ts:337 onward | Existing 24h unverified, 72h requested expiry; payment due 48h after approval capped pickup minus 2h. Scheduler deployment unknown. |
| Catalog opt-in | M/20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql:24-61 | Team visible + marketplace_request_status approved + not demo/deleted; vehicle visible/status available or booked/not archived or trashed. Reuse helpers for external discoverability. |
| Sitemap browse gate | frontend app/sitemap.ts:20-58 | Mock returns empty; browse-enabled catalog listings; browse-disabled default team only. Do not widen tenant exposure as incidental API work. |

All inventory rows are verified against local source only. Historical `docs/rent/patches/m6b` and stale headers are not deployment evidence. No renter OpenAPI/MCP implementation was identified in scoped frontend files; implementation must re-scan rather than interpret this search as proof of universal absence. [VERIFIED: read-only source inspection]

Additional security/concurrency gates: the latest inspected create migration adds a return-time signature but contains no explicit revoke/grant for that new signature; older signature revokes do not establish its effective access. Inspect effective function privileges/default privileges in clean staging and explicitly restrict every internal writer signature before exposure. This is a verified source grant-audit gap, not a claim that deployed anonymous execution is possible. The September blocked-date trigger rejects marketplace inserts that overlap vehicle_blocked_dates, but applies BEFORE INSERT only; updates and concurrent blocked-date changes need the shared serialization audit. [VERIFIED: M/20260819031937*:35-39,158 end-of-file; grant grep; M/20260901194608*:153-181; CITED: https://www.postgresql.org/docs/current/sql-grant.html]

### Exact lifecycle and holds

Normal first-time renter: create `pending_documents` → hosted identity verification → `requested` → operator approval → `pending_payment` → two-leg payment → `confirmed` when verified. Returning verified renter starts `requested`. Paid-but-unverified remains `pending_documents` until identity webhook promotes. Approval accepts requested/legacy pending, rejects pending_documents. Preserve the fallback branch but do not expose it as a bypass for normal verification. [VERIFIED: B/rent-create-booking/index.ts:144-157; B/identity-webhook/index.ts:194-223; B/rent-approve-booking/index.ts:88-104; B/rent-payment-webhook/index.ts:48-107]

`requested`, `pending_documents`, `pending_payment`, `pending`, `confirmed`, `active` block inventory. Quote creation is only a read; a request row blocks dates before confirmation. This is an inventory reservation, distinct from deposit/card authorization. Expiry requires scheduler-driven transition/cancellation; elapsed wall time alone does not remove a row from the overlap predicate. Existing 24h/72h cancellation must distinguish paid awaiting-ID bookings and refunds; test that paid rows cannot be cancelled without financial reconciliation. [VERIFIED: M/20260819031937*:24,96-98; M/20260728152708*:24-25; B/rent-payment-scheduler/index.ts; recommendation derived from predicates]

The inspected expire_unverified_holds function already excludes rows with either operator or Exotiq payment-intent reference; preserve this guard and test partial-leg recovery instead of inventing a new blanket expiry. The later confirmation transition guard permits paid pending_documents promotion, unlike the older guard migration. [VERIFIED: M/20260728152708*:20-25; M/20260728222252_e1512efd-4831-4168-bf31-4f4cd78358fb.sql:1-16]

## Architecture Patterns

### Boundary and ownership

Backend owns migrations, deterministic quote/availability/request primitives, authorization enforcement and API edge routes. Frontend owns customer consent/identity/handoff screens and availability presentation. Separate adapter package owns MCP transport, OAuth resource boundary and API client only. Contract owner controls OpenAPI and schema generation; cross-repo DTO changes land through versioned artifacts with parity tests. Plan separate feature worktrees/branches for each implementation owner; reconcile migration signatures and contract versions before deployment. [VERIFIED: PRD.md; recommendations derived from existing F/B split]

Suggested future structure: backend `supabase/functions/external-booking-api/`, `_shared/external-booking/`, additive migrations, `tests/agent-booking/`; frontend `domain/booking/externalContracts.ts`, hosted consent routes; adapter `packages/renter-mcp/`; docs `docs/external-booking/openapi.yaml` and `guide.md`. These are proposed paths, not existing files. [VERIFIED: planning recommendation]

### Boundary contract

Use `/v1/operators`, `/v1/vehicles`, `/v1/availability`, `/v1/quotes`, `/v1/rental-requests`, `/v1/rental-requests/{ref}`, `/v1/rental-requests/{ref}/checkout-handoff`. Reads include operator/vehicle IDs, source timestamp, visibility and currency; availability returns AVAILABLE/UNAVAILABLE/UNKNOWN with timezone/time bounds/buffer. Quote includes immutable quote_id, expires_at, pricing_version, terms_version/hash, selected options, times, all itemized cents and both charge totals, availability_checked_at and explicit `holds_inventory:false`. Request returns actual backend status, next_action, reservation expiry if applicable, never confirmation language. [VERIFIED: API-01/QUOTE-01/FAIL-01 requirements; recommended contract]

Standardize errors: invalid_input 400; unauthorized 401; forbidden 403 where enumeration-safe; not_found 404; dates_unavailable/quote_changed/idempotency_conflict 409; quote_expired/payment_window_expired 410; rate_limited 429 with Retry-After; upstream_unavailable 503. Include code, safe message, request_id, retryable, field details where safe. Do not leak tokens/PII/internal exception strings. Conditional status polling should use ETag/If-None-Match and Retry-After; clients poll with backoff until terminal/expiry rather than assume completion. [VERIFIED: phase requirements; recommended semantics]

### Atomic quote consumption and retry ledger

Persist opaque server-generated quote records scoped to customer/tenant/vehicle/dates/options; snapshot prices, tax/fee/protection terms, pickup/cancellation/mileage policy and revision. At request creation, authenticate principal; verify one-use server-issued consent receipt; lock quote and inventory serialization key; revalidate visibility/availability/revisions/expiry; atomically insert booking and store idempotency response. Version must cover all customer-visible prices and terms, not just daily rate. Reject changed/expired input with replacement quote requiring renewed consent. Do not merely compare a customer-supplied total or boolean `consent:true`. [VERIFIED: identified requote gap; QUOTE-01/AUTH-01; recommendation]

Use durable unique `(principal, tenant, operation, idempotency_key)` plus canonical payload hash. Same key/same payload returns original result even after lost response; different payload conflicts; in-progress conflicts yield bounded retry guidance; consent can create at most one request. Commit booking/result together; outbox notifications occur after commit. Quote read/create must not extend request hold; idempotent request retry must not extend hold either. [VERIFIED: SAFE-01; recommendation]

Preserve database exclusion as final backstop. Widen or replace source-scoped exclusion after auditing historical/imported/legacy row conflicts; include shared buffer semantics. If global constraint rollout is unsafe, all agent/operator/direct write and update paths must acquire the same per-vehicle transactional lock and overlap primitive. An agent-only lock is insufficient. Test 20 concurrent mixed-source overlapping writes, exact adjacent boundaries, buffers, DST, rollback and expired holds. PostgreSQL exclusion constraints enforce the specified pairwise restriction; predicates determine their scope. [CITED: https://www.postgresql.org/docs/current/ddl-constraints.html; VERIFIED: M/20260722051127*:24-32]

### Authorization and consent

Use OAuth resource-server validation with issuer/audience/expiry/scope checks, customer subject, tenant policy and database grant linking principal to each booking. Public discovery never authorizes write/status. Suggested scopes: catalog:read, quotes:create, rental_requests:create, rental_requests:read, checkout:handoff. Hosted customer consent binds exact quote/options/operator/dates and action; OAuth grant alone is not purchase/request consent. Support expiry/revocation, no refresh after revocation, hashed opaque grant/consent secrets, safe audit references and per-booking access. Keep legacy confirmation tokens internal to a server-side compatibility bridge; agents receive scoped API credentials, not raw confirmation-token links or service-role credentials. [VERIFIED: AUTH-01; existing token guard; recommended design]

Current create trusts supplied driver email for identity reuse across teams, while later status/identity checks use other customer predicates. Customer delegation must prove control of the customer identity and re-check matching rules; do not rely on typed email alone to authorize an agent or declare identity cleared. [VERIFIED: B/rent-create-booking/index.ts:144-155; M/20260818194350*:221-228; B/rent-payment-webhook/index.ts:66-78]

## Renter MCP

The current released MCP specification is **2026-07-28**, not the old 2025-11-25 edition or draft. Official TS repository labels v2 stable and supports Streamable HTTP. Use a remote Streamable HTTP server with protocol negotiation and client compatibility tests; do not promise every consumer provider supports it. [CITED: https://modelcontextprotocol.io/specification/latest; https://github.com/modelcontextprotocol/typescript-sdk; https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http]

HTTP authorization uses protected-resource metadata and authorization-server discovery, resource indicators and header bearer tokens. The current spec prefers Client ID Metadata Documents; Dynamic Client Registration is deprecated but retained compatibility. OAuth 2.1 remains an IETF draft underneath the released MCP specification. Use a standards-capable authorization server, test actual client registration/resource/audience behavior, and document supported clients; do not hand-build an OAuth issuer or pass a token for one audience to another service. [CITED: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization]

| Tool | Inputs and output | Annotation recommendation |
|---|---|---|
| search_vehicles | tenant/city filters, pagination → eligible inventory | readOnly true, destructive false, idempotent true |
| check_availability | vehicle, precise dates/times → tri-state | readOnly true, destructive false, idempotent true |
| create_quote | vehicle/time/options → consent-ready quote | readOnly false if persisted; destructive false; idempotent only with supported key |
| submit_rental_request | quote_id, consent_receipt_id, idempotency_key → actual request/next action | readOnly false; destructive false if strictly additive; idempotent true only for enforced keyed retry |
| get_request_status | booking_ref → authorized minimum status | readOnly true, destructive false, idempotent true |
| create_checkout_handoff | booking_ref → hosted customer URL, expiry/next action | readOnly false; idempotent only if session reuse guaranteed |

All tools interact with external systems: openWorldHint true. Do not expose approve, raw payment, document upload or direct charge tools. Inputs/outputs use JSON schemas, structuredContent and safe human-readable summaries; tool errors map API codes to isError rather than invented success. MCP annotations are behavioral hints and untrusted metadata, not security enforcement. Consent/authorization/idempotency remain API checks. [CITED: https://modelcontextprotocol.io/specification/2026-07-28/server/tools; VERIFIED: PRD and recommended adapter mapping]

## Don't Hand-Roll

| Problem | Use instead | Reason |
|---|---|---|
| Rental pricing/approval | Existing server quote/snapshot/approval primitives | Prevent competing fee/tax/eligibility logic. [VERIFIED: B/M source inventory] |
| Payment/identity handling | Existing hosted checkout/verification | No agent cards or identity documents; retain charge accounting. [VERIFIED: PAY-01] |
| MCP wire implementation | Official v2 SDK | Released schemas/transports and interoperability. [CITED: https://github.com/modelcontextprotocol/typescript-sdk] |
| OAuth issuer/crypto | Standards-capable authorization service, established crypto | Issuer choice is implementation gate; no custom token algorithms. [VERIFIED: AUTH-01; recommendation] |
| Retry prevention | Transactional durable ledger + DB constraint | Click suppression/in-memory maps do not cover distributed retries. [VERIFIED: SAFE-01; recommendation] |

## Runtime State Inventory

This is additive brownfield work, including migrations; no global rename is proposed. [VERIFIED: PRD.md]

| Category | Items found | Required action |
|---|---|---|
| Stored data | Existing bookings/customer/identity/payment rows and overlap predicates in SQL | Audit source definitions and separate staging replay; additive quote/grant/idempotency records. No production data read. [VERIFIED: migration inventory] |
| Live service config | Scheduler, deployed functions, OAuth/Stripe/visibility settings unverified | Future staging parity evidence; never infer deployment from git. [VERIFIED: planning-only access scope] |
| OS registrations | None researched: deployment architecture does not identify OS registration changes | No OS edits planned; inventory during implementation if worker hosting needs them. [VERIFIED: scoped plan design] |
| Secrets/env | Source refers to backend service keys, Stripe/Turnstile/provider env names | Future staging-scoped secret provisioning; none read, agent never receives service credentials. [VERIFIED: B source; PRD] |
| Build artifacts | Source packages present; installed artifact/deployed revision parity not inspected | Build isolated worktrees later, lock SDK; deployment provenance gate. [VERIFIED: SOURCE-SNAPSHOT.md] |

## Common Pitfalls

1. **Silent requote:** Current handler requotes after customer review; atomically bind quote version/terms and renew consent on changes. [VERIFIED: B/rent-create-booking/index.ts:132-188]
2. **False free dates:** Swallowed availability error produces empty list; preserve UNKNOWN and reject unsafe writes. [VERIFIED: F/supabaseService.ts:94]
3. **Mixed-source overlap race:** Current partial exclusion ignores direct rows, while unlocked precheck observes them only at one instant; use shared serialization/constraint across writers. [VERIFIED: M/20260722051127*:24-32; M/20260819031937*:93-101]
4. **Stale comments/overloads:** Repeated SQL replacements and stale create headers exist; inventory final signatures/grants/triggers in clean staging rather than copying oldest patch. Historical migrations include a literal booking update; never replay the entire migration corpus onto production or synthetic staging without review. [VERIFIED: B/rent-create-booking/index.ts:21-23 versus current checkout; M/20260724035422_6ac3ac4e-e8d6-413a-bae7-ae8d23b65ba5.sql:1]
5. **Payment success inferred from redirect:** Confirmation requires authoritative state and reconciled both legs/identity; test duplicate/late/out-of-order webhooks and partial-leg recovery. [VERIFIED: B/rent-payment-webhook/index.ts:48-107,349 onward]
6. **Token leaks:** Existing links embed confirmation credential; avoid logging/link propagation and analytics capture for consent/status/handoff routes; return scoped access and no-store headers. [VERIFIED: B/rent-create-booking/index.ts:256-259; recommendation]
7. **Discovery exposure:** API visibility must retain approved opt-in and demo filtering; sitemap browse gate remains independent. Google documents ordinary indexed/search-eligible content for AI features and does not guarantee inclusion. [VERIFIED: M/20260721232856*:24-61; frontend app/sitemap.ts; CITED: https://developers.google.com/search/docs/appearance/ai-features]

## Code Examples

Proposed transaction flow, not executable implementation: [VERIFIED: recommended algorithm derived from inspected create path]

```text
validatePrincipalAndScope()
begin transaction
  claimIdempotencyKey(principal, tenant, operation, key, payload_hash)
  lockQuoteAndConsent(quote_id, consent_receipt_id)
  assertOwnerTenantExpiryVersionsAndUnconsumedConsent()
  acquireSharedVehicleWriteLock(vehicle_id)
  assertVisibilityAndKnownAvailabilityAndBufferRules()
  insertRequestFromServerQuoteSnapshot()
  consumeConsentAndStoreReplayResponse()
  enqueueNotificationOutbox()
commit
return actual backend status, next action and safe scoped reference
```

SDK import shape is verified in official v2 README; business schemas/handler below are deliberately placeholders. [CITED: https://github.com/modelcontextprotocol/typescript-sdk]

```ts
import { McpServer } from '@modelcontextprotocol/server';
const server = new McpServer({ name: 'exotiq-renter', version: '1.0.0' });
// Register tools with shared schema and a validated-principal API client.
// Handler must not calculate prices, approve, or infer confirmation.
```

## State of the Art

| Previous assumption | Current verified fact | Impact |
|---|---|---|
| MCP v1 SDK and 2025 protocol | Released v2 / 2026-07-28; registry server/client 2.3.1 | Use stable current SDK, avoid obsolete draft assumptions. [CITED: official SDK repository; VERIFIED: npm] |
| OpenAPI 3.1 latest | Published 3.2.1 | Use deliberate compatibility baseline and test generators. [CITED: https://spec.openapis.org/oas/latest.html] |
| Mandatory dynamic registration | Current MCP prefers metadata documents, retains deprecated DCR | Test provider registration compatibility; avoid assuming onboarding. [CITED: current authorization spec] |
| Booking ref reveals restricted existence | Latest inspected lookup requires matching token | API policy should remain enumeration-safe. [VERIFIED: M/20260818194350*:244-247] |

## Environment Availability

| Dependency | Availability | Version | Execution gate/fallback |
|---|---|---|---|
| Node/npm | CLI available | 22.22.3 / 10.9.8 | Use isolated adapter package. [VERIFIED: version probes] |
| Supabase CLI | CLI available | 2.90.0 | Compatibility gate before clean staging; no global upgrade. [VERIFIED: version probe] |
| Docker CLI | CLI available; daemon not contacted | 28.3.2 | Local staging only if isolated daemon/project resources verified; otherwise dedicated hosted staging. [VERIFIED: docker --version] |
| Deno | command not found in probe | — | Install project-local runtime later or use isolated Supabase runtime; no install now. [VERIFIED: command -v deno] |
| Dedicated staging/OAuth/test Stripe/test identity | Not contacted/verified | — | Blocking execution gates; use synthetic test providers only. [VERIFIED: scope constraint] |

No credentials requested; staging availability is an implementation prerequisite, not a planning blocker. [VERIFIED: PRD.md]

## Validation Architecture

Existing frontend Vitest has booking/date/quote/payment/identity/SEO tests; backend Vitest config includes only src tests in jsdom and Playwright exists. No tests executed against either source checkout. New Node test harness must be configured explicitly, and SQL/edge tests must use separate staging, not frontend mock tests. [VERIFIED: F/domain/booking/*.test.ts; backend vitest.config.ts; package scripts]

Future adapter/harness quick command: `npm run test:agent:unit -- --run`; full local contract command: `npm run test:agent:contract -- --run`; isolated integration: `npm run test:agent:staging -- --run`; pilot: `npm run test:agent:pilot -- --project=synthetic`. These scripts are Wave 0 deliverables, not presently runnable commands. Keep unit/contract slice under 30 seconds; no staging timing is claimed. [VERIFIED: recommended validation design]

| Requirement | Behavior/test | Proposed file | Command |
|---|---|---|---|
| CAP-01 | Snapshot/signature/state/grant parity fixture | tests/agent-booking/capabilities.test.ts | test:agent:contract |
| API-01 | Schemas, codes, pagination/time/currency | tests/agent-booking/contracts.test.ts | test:agent:contract |
| AUTH-01 | Revoked/expired/wrong audience/customer/tenant/booking grant; consent replay | tests/agent-booking/authorization.test.ts | test:agent:unit + staging |
| VIS-01 | Opted-out/nonapproved/demo and browse-disabled exclusion | tests/agent-booking/visibility.test.ts | test:agent:contract + staging |
| QUOTE-01 | Changed fees/terms/taxes/options, expiry and consent mismatch | tests/agent-booking/quote-consent.test.ts | test:agent:unit + staging |
| SAFE-01 | Lost response retry, different payload conflict, mixed-writer concurrency/buffer/DST | tests/agent-booking/concurrency.test.ts | test:agent:staging |
| FAIL-01 | Quote/availability provider failure gives UNKNOWN/no write | tests/agent-booking/failures.test.ts | test:agent:unit + staging |
| PAY-01 | Identity promotion, approval, both legs, partial failure, late/duplicate webhook | tests/agent-booking/payment-states.test.ts | test:agent:staging |
| DOC-01 | OpenAPI lint/example/schema/generated client parity | tests/agent-booking/docs.test.ts | test:agent:contract |
| TEST-01 | Environment allowlist/synthetic prefix/Stripe test guard and teardown | tests/agent-booking/environment.test.ts | test:agent:unit |
| MCP-01 | tools/list/call/output/error/auth/negotiation and two client profiles | packages/renter-mcp/tests/protocol.test.ts | test:agent:contract |
| OPS-01 | Miami/Tampa journey, metrics, disable/rollback drill | tests/agent-booking/pilot.spec.ts | test:agent:pilot |
| ISO-01 | Ownership/reconciliation/worktree/service isolation checklist | docs/external-booking/staging-runbook.md | Manual evidence before staging deployment |

Wave 0: add scripts/config/fixtures, explicit Node environment, synthetic staging seeder and deny-production guard, fake OAuth/API failure fixtures, migration signature/grant snapshot, webhook replay harness and pilot cleanup. Per task run affected quick slice; per wave run contract suite; phase gate requires all contract/security/concurrency/payment/staging/pilot evidence. Production mutations are never a test fallback. [VERIFIED: TEST-01/ISO-01 and proposed validation]

## Security Domain

ASVS latest stable is 5.0.0; template V2 Authentication/V3 Sessions/V4 Access/V5 Input/V6 Crypto labels reflect an older taxonomy and must not be reported as current ASVS identifiers. Use version-qualified actual controls when checker maps ASVS; category-number mapping was not verified from downloadable chapter files in this session (fetch failed). [CITED: https://owasp.org/projects/asvs; VERIFIED: attempted chapter fetch]

| Control domain | Applies | Required pattern |
|---|---|---|
| Authentication/OAuth | yes | Issuer/audience/expiry/PKCE/redirect/resource validation, standards authorization server |
| Sessions/tokens | yes | Every-request validation, per-booking grants, revoke/expire, no tokens in query/logs |
| Authorization | yes | Customer ownership + scope + tenant/operator eligibility on every API operation |
| Input validation | yes | Shared schema; bounded dates/pagination/strings; no client prices; SQL parameters |
| Cryptography | yes | Platform primitives and managed key rotation; no invented signing/encryption |

These are phase-specific recommended controls, not a claim of ASVS certification. [VERIFIED: AUTH-01; inspected service/token paths]

Threats and mitigations: spoofed customer email → verified customer principal; tenant/booking ID substitution → ownership join; stale consent/tampered totals → transactional server snapshot; retries/races → unique ledger + shared lock/exclusion; prompt injection in operator descriptions → treat catalog text as data and enforce API consent; SSRF via OAuth metadata/redirects → validated HTTPS endpoints/allowlisted callbacks and provider library; information disclosure → minimal outputs/redaction/no-store; webhook replay/late events → signature verification, dedupe and monotonic guarded state. Audit and test every mitigation. [VERIFIED: recommended threat analysis from source gaps and phase requirements]

## Complete Journey and Rollout

Seed synthetic approved-visible Miami/Tampa operators/inventory in dedicated staging; use two consumer client profiles. Search → precise dates AVAILABLE → immutable itemized quote → hosted customer consent → authorized keyed request → pending_documents identity handoff when needed → requested → synthetic operator approval → pending_payment → hosted test checkout → authoritative both-leg + verified state → confirmed. Re-poll independently of browser redirect. Exercise declined/expired/unavailable/UNKNOWN/changed quote/revoked grant/partial payment and duplicate webhook branches. [VERIFIED: PRD and inspected lifecycle; proposed pilot]

Choose status polling for v1; retain existing renter emails and internal outbox. No consumer webhook subscription required; add notifications only later if authenticated signed delivery/retry contracts are specified. Record request_id, principal pseudonym, quote/terms version, tenant/booking references, replay/conflict counts, UNKNOWN rate, quote-to-charge itemization equality, successful approval/payment handoffs, both-leg reconciliation, scheduler lag and time to authoritative confirmation. Redact credentials/customer data. Alert thresholds and retention are product/operations decisions, not assumed compliance requirements. [VERIFIED: OPS-01; proposed metrics]

Rollout gates: source/deployment parity and clean migration/grants audit; synthetic staging proof; shared-writer concurrency proof; payment/identity/OAuth compatibility proof; operator opt-in and support readiness; disable-write/read rollback drill. Disable external write/MCP tools without cancelling existing requests; preserve status and hosted checkout access; keep additive schema backward-compatible. Canary approved pilot tenants only after separate execution authorization. AI discovery uses accurate eligible public content and existing browse/tenant policy; sitemap submission/structured data do not guarantee indexing or ranking. [VERIFIED: PRD; CITED: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview]

## Assumptions Log

| ID | Claim | Risk / handling |
|---|---|---|
| A1 | Default quote expiry of 15 minutes is appropriate. [ASSUMED] | Business may prefer another duration; configurable value requires product confirmation before lock. |
| A2 | Status polling suffices for initial consumer clients. [ASSUMED] | Test supported client cadence/capabilities; v1 recommendation, not promise. |
| A3 | An existing/selected OAuth provider supports current MCP discovery/client registration/resource semantics. [ASSUMED] | Provider compatibility spike gates implementation, never assume existing Supabase login equals delegated OAuth. |

All design prescriptions are recommendations derived from verified requirements/source; they do not assert current implementation. Unknown deployment/configuration is a gate, not an assumed fact. [VERIFIED: research scope]

## Open Questions — RESOLVED dispositions

These dispositions resolve planning choices, not deployed facts. Deployment/configuration remains unverified and mandatory execution evidence; no credentials or services contacted during planning.

| Question | Disposition | Owner / executable reference | Acceptance and stop condition |
|---|---|---|---|
| Deployed signatures/constraints/grants/triggers/schedulers/provider configuration | RESOLVED as mandatory evidence gate; source presence does not establish deployment. | Backend infrastructure01-01 and integration/security01-11; dedicated staging baseline/provenance. | Record exact applied signature/default/effective grants/function/schema hashes/scheduler/test-provider modes. Stop dependent exposure if parity or permissions unknown; no production fallback. |
| Mixed-source locking, imports/history, all writer/update paths and blocked-date concurrency | RESOLVED design: universal database trigger serialization across booking INSERT/UPDATE/DELETE and blocked-date edits, sorted old/new vehicle locks, all blocking states independent of source; retain exclusion backstop and conflict audit. | Backend database owner01-05; writer inventory01-01. |20 mixed-source overlapping writes yield one reservation; edit/import/blocked race tests pass; stop if any writer omitted or historical conflicts unreviewed. Universal constraint expansion requires reviewed clean conflict evidence. |
| Busy display vs insertion turnaround buffer | RESOLVED selected recommendation: one post-rental snapshotted rental_buffer_minutes (default60), half-open boundaries; exact return+buffer next pickup allowed; hard blocked intervals remain hard unavailable, not double-buffered. | Backend database owner01-05; frontend facade16/proceed13 compatibility. |Busy/availability/quote/write agree including DST and current storefront/operator callers. Mandatory caller compatibility gate blocks policy switch if meaning differs; no claim current deployed policy already matches. |
| Identity reuse predicates across email/team/customer/status and expiry | RESOLVED design: issuer subject bound to verified customer, not typed email; preserve current identity status/document-expiry authority and explicit audited team reuse eligibility; no bypass via borrowed email. | Authorization03, request06, lifecycle09, hosted handoff14. |Cross-customer/team mismatches and expired identity fail; unpaid pending_documents→requested, both settled paid pending_documents→confirmed only after verified identity; stop release if authoritative reuse predicate cannot be established in staging. |
| ASVS5.0.0 chapter identifiers | RESOLVED as mandatory documentation evidence gate; do not use old template labels or certification claim. | Security/docs owner01-11. |Official version-qualified IDs checked before recording compliance mapping; failure to obtain identifiers leaves certification unmapped, does not waive concrete required threat tests. Security enforcement and all explicit mitigations mandatory. |

Grant continuity selected:10m access token/24h grant defaults plus explicit customer reauthorization/recovery03/08 at25h/71h; expired differs from revoked, old revoked IDs never silently revive. Hosted identity/checkout14 calls backend legacy functions server-side and returns allowlisted provider URL to authenticated browser; no raw legacy token in browser redirect. Operational flags/logging15 modifies actual API and MCP consumers; new-write disable preserves existing-booking continuity. MCP10 obtains consent receipt via authorized API rendezvous, never hidden fixture injection or customer secret copying.

## Sources

Primary URLs checked 2026-10-07: [VERIFIED: web tool results]
- https://modelcontextprotocol.io/specification/latest — redirects to 2026-07-28 released specification.
- https://github.com/modelcontextprotocol/typescript-sdk — stable v2, legacy v1 maintenance, API imports.
- https://ts.sdk.modelcontextprotocol.io/v2/ — official v2 SDK documentation.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization — resource discovery, authorization, registration, token handling.
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools — schemas/results/annotation trust.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http — remote transport.
- https://spec.openapis.org/oas/latest.html — published 3.2.1 and 3.1.2 reference.
- https://www.postgresql.org/docs/current/ddl-constraints.html — exclusion scope.
- https://developers.google.com/search/docs/appearance/ai-features — AI search eligibility guidance.
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview — sitemap discovery limitations.
- https://owasp.org/projects/asvs — stable 5.0.0/version-qualified references.
- npm registry (`npm view`) — exact released SDK/Zod versions and publication timestamps.

Context7 tools were not available in this session; official primary documentation and registry were used directly. No community sources determine locked architecture. [VERIFIED: available tool inventory]

## Metadata

Standard stack HIGH (official docs/registry); local architecture HIGH (source inspected); deployed parity LOW/unknown (not contacted); pitfalls HIGH for source-specific issues, MEDIUM for proposed mitigations pending tests. Refresh protocol/package verification within seven days or at execution start. No git commit: isolated workspace config has commit_docs false and source is read-only. [VERIFIED: .planning/config.json; research scope]

## Source audit correction
Final snapshot preserves both commits and worktree registrations. Backend status gained untracked `supabase/.temp/`. Research ran `supabase --version` from the backend root, returning 2.90.0 and an update notice; this likely created the incidental CLI update cache. No intentional source-code edits occurred, but the checkout cannot be claimed wholly unchanged. The cache is preserved, not inspected/deleted; another agent may also use it. No .env/credentials, application tests, live Exotiq backend/payment/database calls, branch/index or worktree mutations were performed. See SOURCE-SNAPSHOT-END.md.
