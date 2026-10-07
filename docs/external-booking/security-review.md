# Security evidence and remaining release checks

Status: implementation/local evidence only. No certification or full hosted/provider acceptance is claimed. Do not turn local fixture passes into a schema/provider attestation.

## Implemented boundaries

Managed resource JWTs require actual JOSE signatures, exact issuer/audience and at+jwt type, allowed algorithms/client IDs, bounded iat/nbf/exp, current token introspection and scope. Metadata/egress destinations are administrator pinned. Tenant customer bindings require explicit verified hosted identity; operator owner IDs and typed email are not renter identity.

Customer BFF holds encrypted short-lived HttpOnly __Host cookies. PKCE/state/nonce/issuer checks and fresh OIDC auth bind the session. Consent/onboarding/recovery/handoff writes require exact configured public origin, independent CSRF and method/path/body/token-bound proof. Proxy host behavior is verified by real local Chromium; hosted ingress/DNS/TLS parity remains a release gate. Privacy routes use noindex/no-referrer and suppress previews; bodies are bounded/no-store. Keys for cookie encryption and backend bridge differ.

Consent receipts and immutable quotes bind issuer/subject/original consumer client/customer/operator/window/options/versions/hash. Requests atomically consume authority, create one booking and ledger/grant/outbox, replay ledger before expired quote checks, and use shared inventory locks across legacy/manual/external writers and blocked dates. Denied roles cannot directly call private writers or mutate grants. Partial-schema PostgreSQL tests validate selected source functions and role calls, not the complete managed Supabase RLS/Auth/Storage environment.

Identity completion and payment reconciliation are durable/fenced. Exact both-leg proofs plus identity are needed for confirmation. Immutable rental/financial tuple is protected even in a combined update-to-confirmed statement. Stable charge attempts survive out-of-order/different event deliveries; uncertain/late/partial payments retain a reconciliation queue. Provider idempotency windows and uncertain decline/refund recovery remain tested-hosted release obligations.

Default-disabled external writes require current operator opt-in and independently reviewed rollout administrators. The independent private binding prevents an editable source super-admin row/email fallback alone from enabling global rollout. Source team/admin policy integrity still needs applied staging review. Request/financial audit events must be transactional; telemetry accepts only narrow redacted fields. Notification workers require cron/internal credentials, bounded leases/deadlines, provider dedupe evidence and receipt acknowledgements. No bearer, receipt, opaque nonce, email, card or document data belongs in operational telemetry.

## Evidence collection before deployment

Collect actual migration/function source hashes, pg_proc identities/defaults/effective ACLs, PUBLIC/role inheritance, RLS/trigger/constraint coverage, managed auth and provider/client profiles, gateway Origin/Host/proof behavior, timeout hoisting on the deployed PostgREST version, isolated scheduler configuration and worker profiles. Verify next-request revocation and25h/71h recovery with both market/client profiles. Run mixed-writer races, changed-term/expired-consent/UNKNOWN outages, duplicate/lost-response requests, operator approval denials, both charge legs, out-of-order identity/payment/refund, partial settlement, handoff revocation and rollback continuity.

Review the original historical source migrations rather than blindly applying them: one migration mutates a named historical booking and must stay quarantined. Production parity is unknown. Existing historic identity/payment records are not automatically trusted or backfilled. Zero/small operator amounts require explicit compatible provider proof or fail-closed pre-request capability restrictions; never invent a floor charge or alter the consented quote.

Dependency findings are tracked separately. The isolated frontend is evaluating a supported patched Next/React upgrade; exact build/audit evidence must be reconciled before release. A successful local build does not prove provider/deployment security. Egress DNS/rebinding controls and distributed rate budgets require deployment evidence beyond URL parsing/process-local checks.

No ASVS control IDs are asserted without checking the current official catalog. This report describes actual controls and tests; it is not an ASVS conformance certificate.
