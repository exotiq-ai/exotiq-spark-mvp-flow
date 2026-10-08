---
phase: 01-api-docs-mcp-foundation
plan: "09"
status: partial
subsystem: request-status-lifecycle
requires: [01-03, 01-04, 01-05, 01-06, 01-08]
provides: [durable-http-request-replay, current-grant-status, owned-recovery, financial-settlement-authority, atomic-webhook-completion, fair-reconciliation]
affects: [01-10, 01-11, 01-14, 01-15, 01-12]
requirements_completed: []
completed: 2026-10-07
---

# Plan09 local implementation and acceptance limits

Both task owners' implementation is integrated in the isolated backend. POST request creation returns201 only for creation and200 for committed replay of the same immutable body. Status checks the current persisted owner and grant before200 or304. Expired/withdrawn owners can start hosted review by request reference; another owner receives404. Trusted resource base prefixes survive every stored/public link. Requested never means confirmed.

Lifecycle changes require exact consumed-quote/customer/tenant/window/options/charge cents and current owned identity provenance. Both operator and Exotiq settlements are independent durable proofs. Intent IDs, paid_at and browser redirects do not establish settlement. Combined financial tuple/status mutations cannot bypass the confirmation guard. Webhook completion is recorded atomically after successful business work; interrupted attempts retain fenced leases for recovery. Cross-event retries reuse one original Exotiq charge key and exact parameters. Ambiguous charge/refund outcomes enter durable reconciliation instead of minting a fresh key or silently acknowledging lost work. A fair bounded scan prevents the oldest unresolved booking from starving others.

Executed local evidence:

- API owner's76 affected offline tests and strict API graph TypeScript pass. Three actual PostgreSQL/HTTP tests cover ownership, expiry/withdrawal, current-grant304, scoped recovery, role ACLs and runtime request/status composition. Twenty concurrent SQL connections produce one creation and nineteen replay classifications with identical bodies. Held row waits are bounded below2seconds; hosted PostgREST timeout hoisting is separately unverified.
- Lifecycle owner's actual transpiled webhook tests and strict TypeScript pass. Root's guarded PostgreSQL lab verifies nine identity/payment/reconciliation scenarios, immutable financial binding, duplicate/out-of-order event recovery, expiry/late-payment preservation, lease fencing and source legacy compatibility. Latest checks roll back fixtures in a partial schema, with no provider calls.
- Root reproduced and fixed a stalled inbound body risk: one total five-second read budget prevents a never-ending JSON stream from holding an Edge request forever. Four actual ingress security tests pass, including the RED stalled-stream case.
- Integrated full offline verification before provenance refresh had253 unit and27 contract passes; only each suite's reviewed-source fingerprint was stale after new source integration. This is recorded as pending regeneration, not a clean full run.

Implementation references and granular commit evidence are in01-09-API-NOTES.md and01-09-LIFECYCLE-NOTES.md. Main integration includes5daf3937 request/status,615d3f52 lifecycle and6839b785 bounded ingress. Root's later15 transactional audit check successfully exercises these actual request/status functions under rollout disable/configuration outage.

Deviations: reference recovery was necessary because agents never receive grant UUIDs; accurate HTTP201/200 needs an atomic wrapper; raw SQL lock deadlines and fair scan markers address actual stuck/retry behavior. Identity reuse requires current link verification and booked-owner provenance rather than typed-email legacy evidence. Default legacy checkout/approval interfaces remain compatible.

Full acceptance is partial.14 owns the concrete hashed nonce/customer resolver and source internal provider modes. No hosted Supabase, Stripe test accounts or identity sandbox exists; the user explicitly requested isolated local tests. Provider interoperability, complete applied source/ACL/scheduler parity, PostgREST cancellation and the final hosted pilot remain release gates. No requirements are marked complete and no production deployment is performed.
