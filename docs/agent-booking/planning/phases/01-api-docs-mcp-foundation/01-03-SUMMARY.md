---
phase: 01-api-docs-mcp-foundation
plan: "03"
subsystem: delegated-authorization
status: partial
requirements-completed: []
tags: [oauth, jose, grants, rls, consent, tenant-isolation]
requires:
  - phase: "01-02"
    provides: canonical scopes, contracts and safe error policies
provides:
  - pinned resource JWT verification and per-operator verified customer resolution
  - additive revocable booking grants, one-use consent receipts and hosted renewal transactions
  - signed offline regression tests and actual partial-local SQL privilege/lifecycle evidence
affects: ["01-04", "01-06", "01-07", "01-08", "01-09", "01-10", "01-14"]
tech-stack:
  added: ["jose@6.2.3"]
  patterns: ["default-deny configured resource authentication", "tenant-scoped verified customer binding", "internal-only transactional grant renewal"]
key-files:
  created:
    - supabase/functions/_shared/external-booking/auth.ts
    - supabase/functions/_shared/external-booking/grants.ts
    - supabase/migrations/20261007090000_external_customer_grants.sql
    - tests/agent-booking/authorization.test.ts
    - tests/agent-booking/grants-policy.test.ts
    - tests/agent-booking/grants.test.ts
    - docs/external-booking/oauth-compatibility.md
  modified: [package.json, package-lock.json]
key-decisions:
  - "No provider invented; unavailable provider/store configuration defaults to denial."
  - "Legacy customer IDs are tenant-scoped; one issuer/subject may own independently verified operator-specific records."
  - "Expired grant and revoked delegation differ; renewal always creates a fresh ID and never modifies booking holds."
  - "Initial metadata advertises minimal catalog scope; consequential actions require explicit scope step-up plus consent."
duration: "16 min"
completed: "2026-10-07"
---

# Phase 1 Plan 3: Delegated Authorization Foundation Summary

**Pinned jose resource verification, per-operator verified customer links, and revocable booking grants with transactional fresh-ID recovery.**

Implementation for both tasks is committed and locally verified. **Full plan acceptance remains partial:** provider registration/two-independent-client interoperability, actual Supabase Auth/PostgREST/Edge runtime, applied-schema/default-ACL parity and hosted customer interaction are unproven. No requirement is marked complete from this slice. The user has no hosted staging sandboxes and explicitly requested isolated local tests; no credentials, production services or source checkout mutations were used.

## Implemented Tasks and Commits

| Task | Evidence | Commits |
|---|---|---|
| 1: Resource authentication/provider compatibility record | Actual signed JWT verification, deny cases, tenant resolution, PKCE/redirect/resource/response-issuer guards; two profiles documented as **signed offline fixtures**, not provider interoperability passes | `c3259db8`, `a03c57b7`, `8cbff061`, `1773047f` |
| 2: Revocable grants/consent/renewal persistence | Additive tables, least-privilege ACLs, customer/booking/tenant/receipt checks, immutable withdrawn IDs, one-use consumption, exact reviewed renewal transaction | `4c1505c1`, `4520dfe1` |

Owned branch: `codex/agent-booking-plan-03`; base `f8674e13`. Worktree: `<LOCAL_BUILD_ROOT>/plan-03-worktree`. Other agents owned separate worktrees. Root owns integration, provenance inventory refresh and shared planning state/roadmap.

## Verification Actually Executed

- TDD RED: authorization suite failed because auth module did not exist; grant policy suite failed because grants module did not exist; both committed before their implementations.
- `npm run test:agent:unit -- --run tests/agent-booking/authorization.test.ts tests/agent-booking/grants-policy.test.ts`: **69 passed** (43 signed auth cases, 26 offline policy cases).
- Targeted strict TypeScript check of auth, grants and their three suites: **passed**. `git diff --check`: **passed**.
- Root executed the exact migration and this owner's `integration-lab/auth-check.sql` against guarded, owned PostgreSQL 17 and a reviewed **partial dependency schema**. Migration SHA-256 matched both copies: `b4fa75016c474f988d87d89e402ea3874e37e11d879d25ab11a3f39a6267bc04`.
- Actual PostgreSQL assertions passed: same principal across two operator customer records; wrong-tenant links/cross-booking substitutions denied; 25h/71h expired grants replaced with fresh IDs; idempotent renewal completion; wrong client/CSRF denied; revoked old IDs never revive and require explicit new delegation; unchanged booking snapshots; one-use immutable receipt consumption; actual anon/authenticated SQL table/RPC denials; actual anon 18-argument writer denial; service SELECT/narrow revoke allowed while direct DML/standalone receipt consumption denied; all extant writer signature ACLs denied to anon/authenticated and allowed to service.
- SQL fixtures **rolled back**. This verifies selected PostgreSQL behavior, not whole-schema fidelity, Supabase JWT/PostgREST/provider behavior or deployment.
- `npm run test:agent:staging -- --run tests/agent-booking/grants.test.ts`: **correctly refused**, `Dedicated staging evidence is required; no production fallback`. The suite contains actual guarded HTTP anon table/RPC denial checks, not mocked RLS assertions; it did not run against any service.
- Wave contract run: canonical contract suite **12 passed**, capability inventory **2 passed / 1 expected provenance mismatch** after new tracked files. Root owns reviewed inventory regeneration after wave integration; auth owner did not bypass or rewrite the fingerprint gate.

Local lab support artifact (outside code repository): `<LOCAL_BUILD_ROOT>/integration-lab/auth-check.sql`. Root-owned evidence: `auth-check-evidence.txt` and migration evidence in that same owned lab. Files may be copied to output evidence by root; no lab secret/environment file was read.

## Behavioral and Integration Notes

`createResourceAuthenticator` requires reviewed issuer/resource/JWKS/client/algorithm configuration and trusted implementations of current token/session revocation, tenant customer-link resolution and persistent rate limiting. An absent provider or unavailable store denies access. No ID token, arbitrary MCP-token passthrough, typed email/customer-ID impersonation or service-credential-only customer authorization is allowed.

`requirePrincipal` without operator context returns stable issuer/subject/client identity, with **no** global legacy customer ID. Before a tenant operation use its optional operator context or `resolveOperatorCustomer`; grant and receipt policies require that resolved operator/customer binding. Customer onboarding is hosted/session-verified in plan 08; a missing link must fail safely with an authorization handoff, not be auto-created from email. Quote plan 04 adds the receipt quote foreign key/authority binding after the quote table exists.

Grant/receipt/customer-link tables deny all raw writes to browser roles **and service_role**; only selected internal SECURITY DEFINER functions have service execution. Initial link/grant/receipt issuance still requires the trusted hosted-session/quote/authority transaction implementation in plans 08/06. Receipt consumer execution is owner-only so it is called within the atomic booking/ledger authority, not independently from Edge service. Customer-link shared row locks serialize authorization decisions with link revocation. Both extant legacy writer overloads are explicitly revoked from public roles; source-lab 17-argument ambiguity remains a separate compatibility issue owned by later authority work.

Grant policy reports `grant_expired` versus `grant_revoked` as an internal safe reason on a forbidden error. Plan 08 updates the canonical recovery schemas/error contract and wires hosted routes; no missing recovery route is claimed implemented here. New grants expire within 24h, receipts within 15m (quote expiry must further shorten them), and renewals within 15m. Provider token/refresh policy remains a real provider acceptance gate. Recovery does not extend booking holds or change payment/request/idempotency state.

## Deviations from Plan

1. **[Rule 1 - Bug] Tenant-scoped customer binding:** source writer selects/upserts customers by operator+email. A unique issuer/subject → single legacy customer would strand the same renter at a second operator. Root approved an in-scope adjustment to the planned link table: per-operator uniqueness/composite foreign keys, stable principal with explicit tenant resolution, customer-team validation and Miami/Tampa regressions. No new global customer entity was introduced.
2. **[Rule 3 - Blocking] Separate offline policy suite:** harness excludes `grants.test.ts` from unit and disallows dotted filenames. Meaningful offline tests use `grants-policy.test.ts`; the planned `grants.test.ts` remains a real staging HTTP suite. Harness behavior was not changed.
3. **[Rule 2 - Missing Critical] Immutable withdrawal/consumption and link locks:** SQL prevents withdrawn grants/consumed receipts being resurrected and locks active customer links inside privileged transactions. Actual local PostgreSQL tests prove selected denial paths.
4. **User-authorized local verification adjustment:** no test-provider/staging sandbox exists. Signed fixtures and reviewed partial PostgreSQL checks were implemented without pretending to satisfy provider/staging acceptance. Public exposure remains gated.

## Remaining Gates and Issues

- Choose/configure an established standards-compatible issuer and prove two real independent consumer profiles, client registration, PKCE/state/response issuer checks, metadata discovery, rotation, provider revocation/refresh policy and audience-correct API/MCP exchange. No real compatibility spike ran.
- Implement trusted hosted customer-link/consent/grant issuance, recovery screens/routes and canonical errors in plan 08; atomic quote/receipt/request ledger use in plan 06; ingress bounds, IP/tenant rate limits and no-store challenges in API routes.
- Root's API Edge entry must map bare `jose` to pinned `npm:jose@6.2.3` and verify its actual Deno runtime (Node tests do not prove Edge packaging). Root assigned this to API ingress ownership.
- Validate effective deployed/default privileges, all writer/update paths, Supabase Auth/PostgREST and complete synthetic journeys in an isolated faithful staging environment before release.
- Installing own dependencies reported 53 inherited dependency audit findings (3 low, 11 moderate, 37 high, 2 critical). No unrelated mass dependency upgrades performed. Own node_modules symlink was removed before installation; shared modules were not mutated.

## Stub and Threat Surface Review

No mock issuer, always-allow revocation function, raw credential bridge or placeholder authorization implementation is shipped. Injected stores are mandatory trusted server composition contracts; their concrete provider/hosted integration is later gated work, not proven by fixtures. No new public network endpoint or payment/card/identity-document exposure is introduced. Internal file/network access is pinned JWKS only, with private-DNS/redirect egress safeguards still required at deployment. Planned additive authorization tables and internal RPCs are covered by the plan threat model.

## Self-Check: PASSED

All nine created/modified code/doc/dependency files exist in the owner worktree; six task/TDD/refinement commits exist in branch history. SQL support artifact and matching-hash actual local evidence exist. Working tree clean after task commits. No staging/provider/deployment acceptance or requirement completion is inferred from these checks.
