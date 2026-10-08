---
phase: 01-api-docs-mcp-foundation
plan: "08"
subownership: backend-task-2
status: partial
subsystem: auth
tags: [oauth, consent, csrf, grants, postgres, tenant-isolation]
requires:
  - phase: 01-03
    provides: Managed resource JWT verification and per-operator customer linkage
  - phase: 01-04
    provides: Immutable quote authority
  - phase: 01-06
    provides: Durable request transaction and ledger-first replay
  - phase: 01-07
    provides: Actual HTTP ingress/runtime and fixed-host RPC transport
provides:
  - Real hosted consent/onboarding/recovery RPC composition
  - Server-only exact-owner consent rendezvous including consumed receipt replay
  - Fresh customer CSRF review before immutable original-client grant renewal
affects: [01-09, 01-10, 01-11, 01-14, 01-15]
tech-stack:
  added: []
  patterns: [independent managed bearer plus internal BFF proof, canonical customer-safe DTO projections]
key-files:
  created:
    - supabase/functions/_shared/external-booking/consent-routes.ts
    - supabase/functions/_shared/external-booking/grant-recovery-routes.ts
    - supabase/migrations/20261007090470_hosted_consent_bridge.sql
    - tests/agent-booking/consent-routes.test.ts
  modified:
    - supabase/functions/_shared/external-booking/contracts.ts
    - supabase/functions/_shared/external-booking/quote-routes.ts
    - supabase/functions/_shared/external-booking/quotes.ts
    - supabase/functions/_shared/external-booking/requests.ts
    - supabase/functions/external-booking-api/index.ts
    - supabase/migrations/20261007090400_consented_request_transaction.sql
key-decisions:
  - Customer approval uses the hosted client while consent/grants retain original agent client.
  - Explicit association uses signed verified OIDC email proof, never typed email/customer ID.
  - Legacy guest documents do not qualify for authenticated returning-renter reuse.
  - Public UUID references support current-access revocation without bearer secrets.
requirements-completed: []
duration: 14min after first RED commit
completed: 2026-10-07
---

# Phase 1 Plan 08: Backend consent and recovery summary

**Actual runtime now independently verifies the managed resource bearer and signed customer BFF request, then composes narrow SQL onboarding, exact-quote consent, server rendezvous, revocation and fresh grant recovery.**

This adjunct records backend Task2 only. Parent/frontend owners combine all08tasks. Managed-provider/browser/deployed-schema acceptance remains gated; no requirement is marked complete.

## Commits and ownership

- `54d20d7c` RED: missing consent route implementation failed named signed-proof/onboarding tests.
- `008a2d6f` merged integrated backend through`b033ee87`; preserved availability time/policy, onboarding Link and /agent routes.
- Root-owned shared proof RED`0c126e68` / GREEN`9cef60fb` are preserved: oversized signed request fails promptly.
- `f0983fb3` GREEN: hosted bridge SQL/DTO/real runtime composition and required06transport/identity corrections.

Worktree `work/exotiq-agent-build/plan-08-worktree`, branch `codex/agent-booking-plan-08`. No source checkout/provider/deployment/push changes. Shared STATE/ROADMAP/requirements and combined metadata remain parent-owned.

## Implemented behavior

- Canonical QuoteReviewResult wraps exact QuoteResult with immutable operator/vehicle names and original agent_client_id. Existing pre-migration quotes lacking names fail as expired, allowing new quote review within the original15minute quote lifecycle.
- Customer consent requires actual managed API bearer/introspection, allowlisted hosted client, exact signed BFF method/path/body/token/profile/CSRF proof and pinned browser origin. It validates current authoritative immutable terms and original principal/tenant; server stores original agent client. Browser response contains no receipt.
- Agent-only consent-result matches issuer/subject/client/audience/active tenant link. Waiting returns202 + Retry-After5 + expiry; consumed receipt returns only to its matching owner to reach original ledger-first replay, including after actual quote expiry. Revocation prevents exposure. Receipt ID is never bearer authority.
- Customer onboarding input is only operator_id/full_name/phone/consented. Signed fresh verified OIDC email, not body email, determines explicit canonical tenant customer association. Existing source UNIQUE(user_id,email) and oldest same-team email selection are respected; ambiguous/cross-team owner conflicts fail closed instead of merging customers. Display/contact input establishes no identity.
- First external request does not reuse old guest identity. Reuse requires known future document expiry, verified_at >= customer-link verification, and identity.booking_ref linked to a prior external ledger with the same issuer/subject/customer/operator.
- Renewal records retain original client/scopes/booking. Fresh hosted review binds customer CSRF and hosted client before completion. Expired grants create fresh IDs; revoked IDs require explicit_new_delegation true and stay revoked.25h/71h checks preserve booking status, payment and hold fields. Safe previous_grant_id and grant_id_to_revoke references let UI revoke current fresh access after completion.
- Production createRuntime mounts real consent/recovery extension, auth, RPC and hosted configuration, before optional later extensions. Missing hosted configuration denies customer writes. Backend uses EXTERNAL_API_HOSTED_BRIDGE_KEY / EXTERNAL_API_HOSTED_CLIENT_IDS; matching frontend bridge configuration is required.
- Signed gateway normalization preserves configured public resource prefix and exact BFF proof path, while metadata stays at its explicit metadata URL. Parsed JSON uses a clone so proof checks exact original bytes; oversized clone cancellation cannot block on the unused tee branch.
-06serialized timestamps are truncated to contract milliseconds before persistence; shared quote projection normalizes raw PostgreSQL timestamps. Exhausted bounded40001 returns canonical request_in_flight409 with Retry-After1.

## Verification

- Affected unit command (consent-routes, hosted-proof, request-policy, failures):42 passed, including actual ES256 signed resource JWT + introspection fixture + gateway HMAC + HS256 BFF proof through actual runtime/RPC transport. A valid resource token without the BFF proof still denies customer write.
- Strict backend TypeScript including API composition and consent tests passed.
- Owned guarded partial PostgreSQL request-lab regression:11 passed. Actual40concurrent clients, rollback, consumption, expiry replay,18signature/default compatibility and durable notification regression remain green with stricter identity provenance.
- Root-owned guarded PostgreSQL17 consent-check.sql actually passed; fixtures roll back. Checks include verified-profile/click gates, real source customer uniqueness/canonical association, independent tenants, exact original delegation receipts, no consent inventory hold/booking/outbox, strict external identity reuse, wrong subject/client/audience/terms/CSRF/scope denial,25h/71h fresh grants and immutable booking/hold state, explicit revoked new approval, one-second quote expiry and consumed expiry rendezvous, plus anon/authenticated/service raw-write denials.
- Parent reported integrated215unit +21contract checks green after reviewed provenance regeneration. Own pre-refresh full unit run had214 pass and one expected source-fingerprint mismatch; own contract run12 passed with one expected stale generated OpenAPI mismatch after new schemas. Parent owns regeneration/integration; this backend did not weaken those guards or regenerate docs before plan11.
- git diff --check and strict source stub scan passed.

Root support artifacts authored under explicit delegated ownership: `integration-lab/consent-dependencies.sql` and `consent-check.sql`; root alone executes/mutates its lab. Partial schema/deployment/provider parity is never inferred from these tests.

## Provenance

-08migration SHA256: `3bf425e7c6c9547458f0d450ac631651de4223cd218151d97335cca853f0e0af`.
- Revised06migration SHA256: `a1267a9c9bc21a2f16112dc0d3d06db06525145465db14e2452c8e07c24409f6`.
- Canonical schema source SHA256: `28ddb0bd09fb2f225959e80ee744ff72c9e55b4dce69ceec4f96cab330e298b6`.

Root initial08apply exposed a missing final consent boolean in exact completion ACL signature. Fixed both REVOKE/GRANT signatures; actual full migration compiled. Subsequent review-projection/route-path changes were applied by root as selected CREATE OR REPLACE definitions to its already-migrated partial lab; evidence records that distinction. No live migration or full hosted schema claim.

## Deviations and gates

1. [Rule 2 - Security] Source customers.user_id is operator owner, not renter auth. Used independent OIDC ownership proof plus explicit association and hardened external identity provenance.
2. [Rule 1 - Bug] Raw PostgreSQL microseconds violated public timestamp grammar. Normalized projection/persisted public metadata; kept strict contract validation.
3. [Rule 1 - Bug] Gateway prefix rewriting broke exact hosted proof path. Preserved public resource prefix and tested all signed layers in actual runtime.
4. [Rule 1 - Bug] Awaiting cancellation of one request clone could hang oversized requests. Nonblocking cancellation closes branches safely; root proof utility received its own signed RED/GREEN check.
5. [Rule 1 - Bug] Incorrect completion ACL arity blocked migration. Fixed exact9argument signature and verified in PostgreSQL.

Full managed OAuth/OIDC registration/interoperability, browser end-to-end, deployed historical schema/all-overload/default ACL, real identity/payment/notification services and operator opt-in remain release gates. No fake provider is presented as deployed proof. Same-owner multi-team email collision intentionally requires customer/operator resolution rather than automatic merging. Legacy document reuse now requires fresh external identity; returning guests may need another verification.

Migration-top SET LOCAL lock_timeout/statement_timeout protects applying SQL, not all future RPC lock waits. API HTTP deadline alone does not prove database query cancellation. Parent was alerted to runtime function/connection lock and statement timeout proof for later operational hardening; no database-hang guarantee is claimed.

## Known stubs

No placeholder customer/consent/recovery implementation.14hosted identity/payment handoffs and15operational exposure are later explicit ownership; endpoints implemented here do not contact those providers.

## Threat flags

| Flag | File | Description |
|---|---|---|
| threat_flag: verified profile association | hosted consent SQL/API | Signed verified OIDC email can explicitly associate existing canonical tenant customer. Never allow ordinary JSON/body email or operator-owned user_id to establish ownership. Fresh external identity provenance is separately required. |
| threat_flag: internal proof key | API runtime configuration | Configured BFF signing key is server-only and independent of provider access token verification. Missing configuration denies writes; no secret is sent to browser/agent output. |

## Self-Check: PASSED

Named production/test files and both task commits exist; own worktree clean. Parent-owned proof commits and integrated reconciliation are preserved. This is a partial backend adjunct, not completion of all frontend or hosted acceptance.
