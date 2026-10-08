---
phase: 01-api-docs-mcp-foundation
plan: "07"
subsystem: external-api-readers
status: implemented-local-proof-hosted-and-integration-gated
tags: [api, catalog, quotes, oauth, supabase]
requires:
  - phase: "01-03"
    provides: signed token verification and verified tenant customer links
  - phase: "01-04"
    provides: immutable authoritative quote RPC and durable store
  - phase: "01-05"
    provides: exact shared inventory predicate
provides:
  - bounded versioned catalog availability and quote HTTP routes
  - composed Supabase RPC and managed-provider introspection runtime
  - default-off operator read eligibility table and narrow RPCs
affects: ["01-08", "01-09", "01-11", "01-15"]
tech-stack:
  added: []
  patterns: [source RPC composition, bounded network transports, each-request introspection, authenticated gateway forwarding]
key-files:
  created:
    - supabase/functions/external-booking-api/index.ts
    - supabase/functions/external-booking-api/deno.json
    - supabase/functions/_shared/external-booking/catalog-routes.ts
    - supabase/functions/_shared/external-booking/quote-routes.ts
    - supabase/migrations/20261007090480_external_api_read_boundary.sql
    - tests/agent-booking/failures.test.ts
  modified:
    - tests/agent-booking/visibility.test.ts
    - supabase/migrations/20261007090100_external_quote_snapshots.sql
key-decisions:
  - Compose real runtime dependencies; missing provider configuration fails closed.
  - Preserve public source visibility and independent default-off operator opt-in.
  - Query current provider permissions and revocation on every authenticated request.
  - Normalize fixed gateway ingress only after method path query and body HMAC proof.
requirements-covered: [API-01, VIS-01, FAIL-01, QUOTE-01]
requirements-completed: []
duration: 35 min
completed: 2026-10-07
---

# Phase 1 Plan 7: Catalog, availability and quote API

**A configured API entry composes source visibility RPCs, signed OAuth tokens, current provider permissions, persistent throttling and immutable server-priced quotes.**

Both route tasks are implemented and committed in the isolated plan07 branch. Named offline tests, strict TypeScript and actual PostgreSQL catalog tests passed. Full hosted/provider/deployment acceptance and later consent/write integration remain gated; no environment was enabled or deployed.

## Changes

`external-booking-api/index.ts` is the actual Deno entry, with a pinned `npm:jose@6.2.3` import map. It serves exact versioned GET catalog and POST availability/quote routes, rejecting unsupported methods, versions, content types, oversized/malformed JSON, unsafe paths and query bearer credentials. Responses have structured errors, request IDs and no-store caching. Missing later extension handlers return a safe 404.

Runtime composition constructs the bounded HTTPS Supabase REST RPC transport, catalog repository, durable quote store, persistent source `check_rate_limit` adapter and shared token authenticator. Supabase destinations are fixed configured project hosts; service credentials never enter client output. RPC calls use a five-second deadline, no redirects and bounded responses. Provider introspection uses a pinned issuer-origin endpoint, a three-second deadline and a bounded response; every authenticated request verifies active state, issuer/subject/client/token/resource/expiry and its current required permission. The pinned JOSE resolver is reused across requests for key rotation/cache; customer linkage is freshly resolved per operator without email inference.

Direct requests must use the configured HTTPS resource origin. Supabase forwarding requires a configured 32-byte gateway key and a proof over the exact timestamp, method, raw path/query and SHA256 body hash. The timestamp tolerance is 30 seconds. Caller-supplied forwarded host/IP headers do not establish trust. The gateway must supply this proof in its actual deployment; there is no insecure origin-rewriting fallback.

Catalog query limits are at most 50, SQL fetches at most 51, and signed cursors bind filters and expiry. The service-only SQL wrappers compose exact existing tenant and marketplace public RPCs, source eligibility helpers, and a separate default-off `external_operator_api_settings` table. Hidden/unlisted, archived/trash, unapproved, demo, deleted and opted-out entities are excluded from search and ID lookup. Cross-tenant browse stays separately disabled by default. No opt-in setter, tenant enablement or raw table reader is introduced.

Availability validates the exact interval and tenant timezone, then uses the narrow `external_api_observe_availability` RPC. A single database statement binds current visibility/opt-in, shared `agent_inventory_available`, database check time and the exact `post-return-snapshot-v1/<current-buffer-minutes>` policy revision. Known results require the revision; failed or malformed observations return canonical UNKNOWN with a null revision and 30-second retry. Quote creation requires the action scope and a verified operator-customer link, invokes `external_create_quote`, and returns readable pricing/terms, exact source cents, separate payment legs, bounded expiry and a hosted consent URL. A quote does not hold inventory. Quote creation is nonidempotent; request creation later owns its required idempotency key.

## Verification

- Task1 genuine RED: `8b8047ba` failed because the catalog/entry modules did not exist.
- `npm run test:agent:contract -- --run tests/agent-booking/visibility.test.ts`: **5 passed**.
- Runtime regression RED: `2db6f7fa` exposed two real failures: reduced provider permissions still created a quote, and valid gateway metadata forwarding was rejected. Both were fixed in `007da50c`.
- `npm run test:agent:unit -- --run tests/agent-booking/failures.test.ts tests/agent-booking/authorization.test.ts`: **55 passed**, including 11 runtime/fault tests and 44 upstream authorization tests. Runtime tests use actual JOSE signing/verification with offline transport fixtures; they are not database/provider proof.
- Targeted strict TypeScript on API entry and named tests with ES2022/bundler/DOM libraries: **passed**.
- Root-reviewed `integration-lab/read-boundary-dependencies.sql` records exact source RPC filenames/body hashes plus minimal synthetic dependency columns. Parent applied this artifact, the new migration and `catalog-check.sql` to its guarded PostgreSQL17 lab: **passed**, including default-off flags, visibility/ID/search/city/browse boundaries, immediate withdrawal and real anon/service ACL checks. Synthetic writes rolled back. This dependency schema is partial, not full Supabase deployment parity.
- Plan04 correction genuine PostgreSQL RED/GREEN: root initially reproduced oversized terms persisting, then applied the corrected authority function. Current `quote-check-evidence.txt` confirms oversized pickup, overprecise tax and negative mileage reject before INSERT, together with the complete existing pricing/ACL/immutability suite; all fixtures rolled back.
- Full worktree suite: **176/177 unit** and **20/21 contract** passed. Only the two shared source inventory/fingerprint assertions failed after new tracked migrations; parent owns their reviewed regeneration at integration. No audit fixture was weakened or updated by this executor.
- No production API, provider endpoint, secret file or deployment was accessed.
- Continuation RED `89cadd46`: required observation revisions/time and hosted links failed in four runtime assertions plus the availability contract fixture. GREEN `ac1698c7`: runtime **12 passed**, known AVAILABLE/UNAVAILABLE database time/revision and UNKNOWN null policy all verified. Account-link request-ID regression `f14e0230` failed in three cases, corrected by `4a98c98b`; combined authorization/runtime **56 passed**. Strict targeted TypeScript passed. Contract **17/18 passed**, only the generated OpenAPI equality requires parent regeneration after the additive schema change. Expanded catalog SQL observation assertions await parent execution; no database result is inferred from mocked transport tests.

## Commits

| Commit | Change |
|---|---|
| `8b8047ba` | Catalog and versioned boundary RED |
| `cf8796ae` | Plan04 pre-insert disclosure and arithmetic bounds correction |
| `fa574088` | Correct authoritative tax consistency PL/pgSQL expression |
| `e949431e` | Integrate root action metadata/current-scope auth change |
| `b18cbd6e` | Integrate root discovery scope regression |
| `fa529568` | Actual runtime, narrow catalog migration and quote routes |
| `2db6f7fa` | Runtime/fault tests with real scope/metadata RED |
| `007da50c` | Current scope checks, shared key resolver and metadata forwarding GREEN |
| `33901d75` | Integrate root safe concurrent-request retry contract |
| `89cadd46` | Availability revision and hosted customer-link RED |
| `ac1698c7` | Atomic observation RPC, canonical revision and hosted route links |
| `f14e0230` | Account-link error request-ID RED |
| `4a98c98b` | Preserve error request-ID consistency |

## Deviations from Plan

1. **[Rule 2 — Missing critical]** Route factories alone would not deliver an executable API. Added actual runtime Supabase RPC transport, administrator-pinned provider configuration/introspection, durable limiter composition, trusted ingress proof and the Deno import map. Parent approved the narrow default-off settings table and migration timestamp, reserving mutations/audit for15.
2. **[Rule 2 — Missing critical]** During API projection, discovered quote SQL could persist a snapshot whose customer-readable disclosures violated canonical limits. Corrected plan04 on this branch: all visible text, exact decimal strings, mileage/days/cents and itemization are checked before insertion. Conservative UTF8 byte limits are stricter than UTF16 contract limits and safely reject oversized astral strings. Parent-executed SQL regression assertions passed for oversized pickup, overprecise tax and negative mileage with zero quotes.
3. **[Rule 3 — Blocking]** Dedicated hosted staging/provider configuration does not exist. User explicitly authorized isolated local tests. Actual local SQL and offline composition evidence are kept separate; no hosted parity or release readiness is claimed.
4. **[Process deviation]** Availability/quote route code landed with task1 because the actual API entry imports it. Task2 baseline fault fixtures were written after this composition; the two additional runtime regressions did follow demonstrated RED/GREEN. The initial task2 implementation is not represented as a missing-module TDD success.
5. **[Rule 2 — Missing critical]** Initial canonical AvailabilityResult lacked the plan's buffer policy revision. Parent authorized the additive availability-only schema change and one-statement observation RPC. The continuation now returns database check time and the actual current buffer revision together; UNKNOWN carries null. Expanded actual SQL assertions are parent-executed.

## Integration handoff and configuration

Required administrator configuration: `EXTERNAL_API_PROVIDER_CONFIG` JSON (issuer/resource/JWKS/metadata/allowedHosts/algorithms/clientIds/maxTokenLifetimeSeconds), `EXTERNAL_API_INTROSPECTION_URL`, `EXTERNAL_API_INTROSPECTION_AUTHORIZATION`, `EXTERNAL_API_CUSTOMER_ORIGIN`, `EXTERNAL_API_CURSOR_KEY_HEX`, and normal runtime-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. Browse is enabled only by explicit `EXTERNAL_API_CATALOG_BROWSE_ENABLED=true`. Forwarded Supabase ingress additionally requires `EXTERNAL_API_GATEWAY_KEY_HEX`, `X-Exotiq-Gateway-Timestamp` and `X-Exotiq-Gateway-Proof`. No environment file was created. Provider compatibility must prove JWT access-token profile, pinned API audience, bounded token lifetime, active introspection and current action scopes.

Plan08/09 can attach `extension(request,path,body)` but must enforce their own action/CSRF/hosted customer proof. Current consent links use `/agent/consent/{quote_id}`. Unauthorized quote responses expose only a fixed configured `/agent/account/{operator_id}` Link header with `rel="customer-account"`; the generic error does not assert account existence or distinguish revocation from missing linkage. Initial customer onboarding must establish an authenticated verified per-operator link before an agent can quote; typed email is never linkage proof. Parent08 owns its separately authenticated BFF and proof module.

Plan15 must reuse `external_operator_api_settings` exactly and add reviewed mutation audit/operation gating. Current HTTP eligibility checks read opt-in each request, but quote SQL must additionally enforce/lock the new gate at persistence time to make flag withdrawal atomic. Existing-booking status/recovery must not depend on new-quote enablement. Capacity tuning and trusted ingress network policy belong to deployment evidence.

## Known Stubs and remaining gates

There are **no production pricing, claims, customer store, catalog or limiter stubs**. Configuration absence intentionally denies service. Later extension routes are explicitly absent until their owning plans integrate. Actual observation SQL verification, transaction-level quote enablement, generated OpenAPI/source inventory refresh, full Supabase/PostgREST/provider parity, trusted gateway deployment, initial customer onboarding and hosted consent/write routes remain required before exposure.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: pinned-network-boundary | external-booking-api/index.ts | Provider introspection and trusted gateway HMAC add configured egress/ingress boundaries; DNS/private-network controls and gateway signing must be verified in deployment. |
| threat_flag: opt-in-state | 20261007090480_external_api_read_boundary.sql | New default-off operator settings are read-only here;15 owns audited mutations and transactional write gates. |

## Self-Check: PASSED

All recorded production/test files and commit objects exist; owner worktree is clean. Lab artifacts are parent-executed synthetic SQL. Original source repositories, other agents' worktrees, shared audit fixtures, planning STATE/ROADMAP, secrets and global configuration were preserved.
