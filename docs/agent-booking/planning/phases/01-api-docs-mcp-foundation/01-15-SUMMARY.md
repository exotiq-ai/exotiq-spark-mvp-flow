---
phase: 01-api-docs-mcp-foundation
plan: "15"
status: partial
subsystem: persisted-admission-observability-runtime
requires: [01-10, 01-11, 01-14]
provides: [default-disabled-admission, private-admin-binding, durable-redacted-events, real-api-mcp-consumers, bounded-ingress-egress, persistent-capacity-repair]
affects: [01-12]
requirements_completed: []
completed: 2026-10-07
---

# Plan15 local implementation and acceptance limits

Global and operator admission default false. Missing/unavailable authority closes new quote/consent/request writes. Fresh API preflight and locked SQL transactional checks prevent admission races. Request replay reaches the committed ledger before admission; status/customer continuity/recovery/identity/checkout/reconciliation retain their original owned authority after disable or operator opt-out. Catalog hides opted-out operators. Global operations need a direct verified source-admin UUID plus independently reviewed private rollout-admin binding; editable-email fallback is not accepted and no binding is automatically backfilled.

Actual API operations enqueue bounded enum-only outcomes: request correlation, HMAC pseudonymous principal, tenant UUID and latency, plus authoritative UNKNOWN/replay classification. No raw path/body/receipt/token/customer/provider URL is copied. Optional logging failure cannot undo a committed transaction. Notification delivery has durable stable keys/fenced leases, bounded batches, fixed provider profile and23-hour ambiguity/manual-review boundary. Telemetry/retention configuration is narrow and durable; deployment/cron presence is not inferred from code.

The source persistent limiter had admitted forever at exact capacity. Migration090720 atomically reserves slots: actual SQL at limit2 yields true,true,false,false;24 real concurrent connections at limit7 produce seven accepts/seventeen denials/counter7. Lock/statement limits are500ms/4seconds; hosted PostgREST cancellation/pooling remains unverified.

Production runtime checks inbound abort before RPC/provider egress and before/after shared JWT key resolution, retaining the shared cache for other callers. API, customer BFF, MCP fetch/real Node ingress, source identity/checkout and both signed webhooks now have total body deadlines and size bounds; cancellation never waits for a hostile producer. Signed webhook payloads preserve exact valid UTF-8 bytes without JSON reserialization. API cold-resolver abort regression reproduces the old lookup, then proves zero lookup; already active shared JWKS fetching is preserved for other callers, bounded by the configured provider timeout. Managed JWKS response byte/key-count ceiling remains an explicit provider acceptance/resource limit.

Executed local evidence: actual SQL admission zero-mutation/enable/disable/outage/replay/status and lifecycle checks;19 runtime failure/control checks expanded to20 plus12 safe-outcome checks; signed actual runtime scope/proof/provider composition; four real SQL-backed SDK journeys and their admission/rollback/owned-link assertions; independent58 operations tests and four release-gate tests. Integrated final verification passes320 API unit tests,36 contract checks,50 MCP default tests (five guarded SQL skips), full shared Edge runtime typecheck, MCP typecheck/build, canonical generation and complete frontend consumer comparison. Counts and acceptance boundaries are recorded in BUILD-STATUS and01-VERIFICATION.

New source files are tracked before regeneration. The final source inventory includes OLD/NEW trigger guards via inventory-table wiring,87 writer candidates,76 final inventory-related function candidates and374 privilege statements; it still explicitly labels applied schema/effective grants unverified. Source fingerprint74fa2e861eb59ae88542bcdfe1066749e24025a92c2cf32e2ccb3bec33d28b78 and canonical/browser complete-byte drift checks let CI catch contract/source mismatch without asserting deployment parity.

Full acceptance remains partial. The user confirmed no hosted staging/payment/identity sandboxes and directed isolated local tests. Complete deployed schema/privileges, provider/OAuth registrations, schedules/gateway, confirmation pilot and release metrics remain unverified. requirements_completed stays empty. Originals and production were not modified.
