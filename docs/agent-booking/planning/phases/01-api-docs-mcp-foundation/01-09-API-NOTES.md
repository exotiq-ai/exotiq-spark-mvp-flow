---
phase: 01-api-docs-mcp-foundation
plan: 09
task: 1
status: partial
subsystem: request-status-api
requires: [01-03, 01-04, 01-05, 01-06, 01-08, 01-09-task-2]
provides: [durable-request-http, current-grant-status, ref-grant-recovery, bounded-rpc-lock-waits]
affects: [01-10, 01-11, 01-14, 01-15]
completed: 2026-10-07
commits: [07c0cf1f, b3e1c2e1, 5daf3937]
---

# Plan01-09 API task notes

Production runtime now mounts durable request creation, current-grant status and owned-reference customer reauthorization. This adjunct covers Task1 only; root owns the combined09 summary/state and Task2 payment lifecycle proof.

POST `/v1/rental-requests` requires the matching one-use receipt and durable Idempotency-Key. A narrow SQL wrapper uses the same06 transaction advisory lock, then delegates to the existing booking transaction: exactly the first creation returns201, committed replays return200 with the same stored public body. Quote/customer/operator/issuer/subject/client/audience binding remains authoritative SQL. No duplicate booking implementation or in-memory idempotency store was introduced.

GET `/v1/rental-requests/{ref}` verifies the persisted actor/customer/tenant ledger and current scoped grant on every request, including conditional304. Exact lifecycle identity, consumed-quote financial authority, settlement proofs and reconciliation queue evidence drive safe status projection. Intent IDs, redirects and paid_at never establish settlement. ETags omit the changing observation clock; changed substantive authority changes the ETag. Polling is bounded5–60 seconds. Another owner receives404. The verified owner receives grant_expired/grant_revoked409 and a fixed Link relation to POST `/v1/rental-requests/{ref}/grant-renewals` with an empty body. That route resolves the prior grant internally and starts the actual08 hosted customer review; it never approves itself or revives a withdrawn grant.

The configured full API resource path is retained in status, recovery and checkout links. The minimal06 validation change accepts only trusted HTTPS resource bases with safe fixed path segments; the original durable response stores that base at creation. No quote receipt, legacy confirmation token, provider client secret or PII is returned. Checkout capability stays unpublished until14 supplies the concrete nonce store/customer resolver; the composition hook is typed and absent by default.

Narrow request/status/consent/recovery RPCs have function-level lock_timeout500ms and statement_timeout4s plus PostgREST schema reload notification. Whole idempotent creation transactions retry40001/55P03 at mostfive times with bounded backoff. Ambiguous transport failures and non-idempotent customer writes are not blindly retried. No global role setting changed. Per-path authentication challenges now request the actual operation scope. Root-requested configuration_unavailable and external_writes_disabled errors are canonical503 responses with appropriate retryability.

Verification:

- Two recorded RED commits: missing durable route module, then unmounted production request/status behavior.
- GREEN:76 affected offline tests, including actual jose-signed JWT verification, each-request provider introspection via isolated transport, runtime RPC composition, full API resource-path links and operation scopes; strict TypeScript API graph compilation passes.
- GREEN:three actual PostgreSQL17/HTTP tests through `request-lab/status.vitest.config.ts`: first/replay metadata, cross-actor/client/audience and tenant/customer linkage, expired versus revoked recovery, no automatic approval, SQL ACLs/current function settings, actual HTTP201/200/304, and revocation checked before304.
- Twenty actual concurrent PostgreSQL connections produce one201 and nineteen200 classifications with identical bodies. A held customer-link row causes a real bounded lock timeout (roughly575ms unloaded; loaded rerun remained below2s). Unrelated new connections retain zero/global-default timeout settings.
- Lab owner3067b0cf31b0 uses an internal Docker network, no published ports, an ownership marker and per-operation guards. Fixture changes roll back where applicable. Recorded evidence marks partialSchema=true, providerParity=false and postgrestStatementTimeoutHoistingProven=false.
- Full offline suite before final root provenance refresh:232 passed, one expected stale source-fingerprint fixture. Root regenerates audit/OpenAPI artifacts after integration.
- The ordinary staging command explicitly refused without dedicated staging/provider configuration, as intended. No fake staging exposure, provider exchange, deployed ACL or provider interoperability proof is claimed.

Deviations needed for correctness: added accurate transaction metadata wrapper; reference-based recovery because agents never received the original grant UUID; recoverable owner-specific409 after trusted ledger binding; actual row wait bounds rather than only an HTTP abort; configured resource-base link retention; safe projection of existing Task2 reconciliation evidence. Necessary shared error/state/consent adapters were updated without changing source legacy checkout/approval contracts.

Release limits: no hosted staging or provider sandbox is configured. Raw PostgreSQL proves lock_timeout enforcement, not PostgREST>=12.2 statement-timeout hoisting, pooled connection cancellation or gateway/deployed DNS policy. Those remain staged release gates.14 owns nonce/resolver/source checkout integration,15 owns final flags/telemetry/worker enforcement. No STATE/requirements completion changes were made by this task owner.

Known stubs: none in mounted request/status/recovery paths. The intentionally absent14 checkout resolver prevents publishing that capability until its implementation exists.

Threat flags: the additive ref-recovery POST is protected by managed-provider authentication and exact persisted owner binding; it does not depend on ref secrecy and does not bypass fresh hosted customer approval.

Self-check: PASSED. All listed commits and implementation/test/lab files exist; working-tree task changes were committed individually. Parent owns metadata commits and combined09 acceptance.
