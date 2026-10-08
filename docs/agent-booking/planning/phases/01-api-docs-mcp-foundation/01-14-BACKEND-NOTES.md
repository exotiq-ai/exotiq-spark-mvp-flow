---
phase: 01-api-docs-mcp-foundation
plan: "14"
subsystem: owned-customer-handoffs
status: partial
tasks_implemented: [1, 3]
requirements_completed: []
completed: 2026-10-07
branch: codex/agent-booking-plan-14
implementation_head: 796f542e
provides:
  - Hashed scoped customer handoffs with real SQL leases and provider adapters
  - Explicit original delegated scopes plus independent customer completion
  - Source checkout/identity bridges and unresolved-payment inventory protection
affects: [01-10, 01-11, 01-12, 01-15]
---

# Plan14 backend task1/3 evidence notes

Opaque scoped handoffs now use actual booking/customer authority, immutable provider attempts and signed source bridges; unresolved checkout preserves inventory through delayed payment webhooks.

This adjunct records delegated backend work only. Root owns combined plan summary, frontend evidence, state/provenance and release decisions. No requirement is marked complete: provider interoperability, complete managed schema and hosted acceptance remain gated. User requested isolated local tests because hosted staging does not yet exist.

## Implemented behavior

- Agent handoff creation requires both current OAuth action scope and the original explicitly consented booking grant. Nonces are32random bytes,43base64url characters; only SHA256 hashes persist. Tenant/customer/issuer/subject/client/audience/action/current booking/deadline, grant expiry/revocation, and single-use leased resolution are independently checked in SQL. Provider reference is recorded durably before completion; lost responses obtain a new owned nonce referencing the same provider attempt.
- Hosted review requires independently verified resource JWT plus request-bound BFF proof. Resolve reviews current persisted action, reauthorizes/introspects the corresponding `identity:handoff` or `checkout:handoff` permission before claiming, then invokes real signed source handlers. A read-only customer resource token cannot trigger a provider mutation. Browser receives provider URLs only after explicit current authenticated Continue; no agent/tool receives provider URLs, receipts, legacy credentials or provider session identifiers.
- Customer account status and explicit action routes authorize the verified tenant customer independently of an expired/revoked agent grant. Existing customers with only read delegation can complete identity/payment on the same booking without silently adding agent scopes or creating another request. Persisted created/replay bodies and current status provide a fixed safe customer-account link. Renewal uses explicit fresh customer authorization; revoked IDs never revive.
- Consent explicitly selects1..3 allowed action scopes. Existing eight-argument SQL compatibility retains exactly historical read+checkout defaults, adding no identity scope. Fresh renewal preserves exactly original scopes. Canonical strict review/resolve/status schemas are consumed by the separate frontend owner.
- Actual identity/checkout source functions accept a separate signed internal HMAC proof with a fresh timestamp, exact method/body hash and source endpoint binding. Legacy public controls and response shapes remain compatible. Identity sessions require exact booking provenance and fresh document expiry; checkout requires consumed financial snapshot, current identity clearance, deadline, correct mode/amount/destination and no partial-charge recovery ambiguity.
- Shared booking-row checkout reservation prevents parallel legacy/external creation from duplicating operator charges. Original attempt key, origin, mode, kind, creation time, provider references and frozen session expiry remain stable. A null prepayment source mode does not imply test mode. Unknown attempts older than23hours cannot acquire a renewed provider deduplication window through nonce rotation.
- External Stripe success/cancel both return to the exact generic authenticated account selector, without legacy token or outcome selector; legacy returns retain their historical token-gated shape. Checkout session expiry is frozen at reservation, no later than payment authority; a new session is refused near the provider's minimum lifetime. Documented Stripe Checkout opaque `#fidkd...` fragments are preserved by one narrowly scoped provider format; identity and all generic HTTPS links remain fragment-free. Encoded credential/receipt selectors and malformed fragment escapes are denied.
- Follow-up090730 prevents direct cancellation/payment-expiry from releasing any booking with a durable checkout attempt/session before payment outcome is authoritative. Reservation metadata is immutable to stop clear-then-cancel bypass; BEFORE DELETE independently refuses reserved legacy bookings without relying on external-ledger foreign keys. Unreserved legacy delete compatibility remains preserved. The cron-only scheduler queues bounded oldest-first `SKIP LOCKED` manual review before expiry and refuses expiry when this queue RPC is unavailable. This is a safe operational fallback: **automatic provider-authoritative expire/retrieve cleanup and a safe manual clearance RPC are not implemented**. Uncertain holds can therefore persist until a reviewed operations procedure is delivered. No elapsed timer, grace period or absent webhook establishes unpaid status.

## Verification and evidence limits

Latest delegated offline checks:50tests passed across action-auth denial1, source4, provider9, scheduler3, Stripe URL8, quote-consent5, request routes10 and nonce policy10. Strict production API TypeScript graph passed. Earlier production runtime composition test passed before the added action review; root owns its positive trace expectation update for that legitimate extra RPC and redacted telemetry. Root is also adding separate bounded source-ingress checks; those later changes are not included in this50-test count.

Actual PostgreSQL17 guarded partial laboratory:

| Proof | Result |
| --- | --- |
| Complete current906 definitions/FKs/ACLs and UUID source credential comparison | Compiled; full `handoff-check.sql` PASS |
| Read-only delegation, original grants, independent customer identity after agent revocation | `read-only-check.sql` PASS |
| Two concurrent customer nonce rotations | Both succeed in432ms;2stored nonces,1active nonce,1inherited provider attempt and creation time |
| Delayed-webhook/issued checkout expiry bug | RED: issued checkout released inventory before reconciliation |
| Unknown attempt after deadline, issued session cancellation, immutable reservation/clearance denial | GREEN actual `checkout-hold-check.sql` PASS, rollback-only |
| Two concurrent expiry/settlement transactions, clean synthetic seed | PASS in326ms with1whole-transaction retry,1settlement, pending_payment and inventory still occupied |
| Legacy reservation deletion without external ledger FK | RED actual deletion/release; GREEN exact checkout_reservation_immutable with occupied row retained; unreserved legacy DELETE compatibility passes |

SQL artifacts in `plan-14-worktree/handoff-lab`: reviewed migration function deltas, handoff/read-only rollback checks, exact synthetic concurrency seed/cleanup, guarded two-connection runner and delayed-settlement race. Root lab evidence includes `handoff-current-check-evidence.txt`, `read-only-check-evidence.txt`, `checkout-hold-red-check-evidence.txt`, `checkout-hold-migration-evidence.txt`, and `checkout-hold-check-evidence.txt`. Concurrency runners print only aggregate proof, no provider URL or credential. Root-owned laboratory guarded local Unix Docker/container/network/volume/image ownership with internal networking/no host database port. Synthetic a141 fixtures were cleaned precisely; the original global write switch was restored. Existing a120 January/February pilot bookings were preserved. Cleanup temporarily disables/re-enables only the immutable quote trigger inside the exact synthetic tenant deletion transaction; production quote immutability remains enforced.

No provider calls, deployment, live service mutation, push, source credential loading or original repository write occurred. Local source-handler SDK doubles and synthetic settled SQL are not Stripe/Identity acceptance. Raw PostgreSQL cannot establish deployed PostgREST timeout hoisting, connection cancellation or managed RLS parity. Deployed provider/bank USD capability, old untracked legacy Checkout sessions at rollout, complete schema/ACL/RLS/trigger integrity, actual25h/71h managed recovery and browser-provider return behavior remain acceptance gates. Pre-migration legacy provider sessions require explicit audit/drain/reconciliation because they lack the new durable reservation metadata.

## Deviations and fixes

Actual source uses UUID confirmation_token; comparison now casts database UUID to text, with malformed caller tokens cleanly denied. Exact independent nonce foreign keys preserve customer-session authority even when grant_id isNULL. Customer shared-lock upgrade was replaced by one directly locked owner query, proven concurrently. Provider attempt time is immutable across rotation. Stripe's documented opaque Checkout fragment and provider minimum/maximum lifetime required narrowly scoped validator and stable expiry corrections. The delayed-webhook race required additive migration090730 and source scheduler protection. These are correctness/security fixes within root-authorized scope. No speculative provider or synthetic staging attestation was added.

Key atomic commits:88417bee(initial RED),e16e5e79(SQL/routes/runtime),6d3883e7(source bridges),cf462ecf/f610249f(exact return RED/GREEN),20d235dd/d2cacf62(fragment RED/GREEN),ccf16161/328afbfc(expiry/attempt age),8253cd4f(FKs/source compatibility),e72ba66c/9c5d3980(UUID comparison/deny),662aab99(current action reauthorization),b496dce4/d2241dcd(delayed webhook RED/GREEN),188e93b9(exact laboratory cleanup),4e95ed1f(actual concurrent payment race),75d2a01f/fc656387(legacy booking DELETE RED/GREEN),796f542e(unreserved DELETE compatibility).

## Threat flags

| Flag | Surface | Mitigation/limit |
| --- | --- | --- |
| Customer-owned completion | New authenticated status/action routes | Signed BFF proof, current resource scope, verified tenant/customer link, exact existing booking and consumed financial authority; never expand agent grant |
| Internal provider bridge | Source identity/checkout handlers | Separate HMAC secret, timestamp/body/endpoint binding, current SQL lease and pinned same-source destination; managed ingress remains gated |
| Legacy reservation protection | Immutable source booking metadata and cron-only manual queue | Prevents cancellation from releasing unresolved charges; automatic safe cleanup deliberately not claimed |

## Known stubs

No placeholder implementation or TODO/FIXME was found in the owned handoff/store/provider modules or906/0730 migrations. Real provider adapters and real SQL composition are wired. Hosted acceptance suites remain guarded/unperformed and automatic unresolved-checkout cleanup is absent as explicitly documented above; these limitations prevent a complete production acceptance claim.

## Self-Check: PASSED

Owned source/migration/test/laboratory files exist, listed atomic commits are present, current tree is clean at796f542e, and recorded tests/SQL checks were executed. Root retains final combined-summary/state ownership; this adjunct makes no completed requirement claim.
