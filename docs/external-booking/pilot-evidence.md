# Pilot evidence and remaining acceptance

This build is being verified in isolated local worktrees and explicitly owned
partial-schema PostgreSQL labs. The customer confirmed that a separate hosted
Supabase/Stripe/identity staging project does not yet exist. No hosted pilot has
run, no provider acceptance is inferred, and external admission remains disabled
in the deployable migrations.

## Evidence classes

| Check | Current evidence | Limit |
| --- | --- | --- |
| Canonical contract, generated examples and consumer compatibility | Offline executable checks | Does not establish applied schema or provider behavior |
| JWT, introspection, request-bound BFF/gateway/internal proofs | Production runtime with signed synthetic local identities | Managed issuer/registration and ingress acceptance remain unverified |
| Hosted customer consent and completion | Actual local Next/Chromium; twelve browser cases at frontend `ce44f37` | Local provider/API fixtures, no Stripe interaction |
| Quote/consent/request admission and rollback | Actual selected SQL under owned partial lab | Complete managed schema/RLS/privilege parity remains unverified |
| Inventory concurrency and payment/identity lifecycle | Actual selected SQL and source Edge handler fault tests | Provider delivery, schedules and settlement accounts remain unverified |
| Persistent rate budget | Actual SQL threshold and 24 concurrent calls: limit seven, seven accepted, seventeen denied, counter seven | Deployed PostgREST timeout/cancellation and pooling remain unverified |
| Four market/client API–MCP composition journeys | Actual eight-case guarded run passes, including four signed Miami/Tampa × legacy/modern SDK journeys, admission denial and replay/status continuity | Pending request evidence is not a confirmed hosted payment journey |
| Four hosted confirmed Miami/Tampa × API/MCP journeys | Not run | Requires dedicated managed staging and test provider accounts |

The combined local test uses the production API and MCP factories, real signed
local authorization, the official SDK clients, public onboarding and hosted
consent routes, and the guarded local SQL transport. It never seeds receipts or
grants into MCP. Its explicit `AGENT_LOCAL_LAB_MANIFEST` selects a locally owned
container with an internal network and no host database port. Absence of that
manifest skips the SQL cases; it never selects a cloud project. This evidence
cannot qualify as a hosted pilot. The completed run took93.70seconds and persisted
only synthetic pending-document requests for February2035 in the owned lab.
Earlier January records were preserved. Repeat runs must use reviewed fresh
synthetic windows or a newly owned lab; no broad booking/receipt/grant deletion
is a reset procedure.

## Release decision

`scripts/agent-booking/release-gates.mjs` requires reviewed, current hosted
evidence with complete applied schema/privilege proof, managed provider and
gateway/scheduler acceptance, next-request revocation, outage/rollback
continuity, and all four authoritative confirmed journeys. Both settled charge
legs must equal the consented itemization. Missing metrics are missing evidence,
never zero failures. Local or partial evidence is always rejected.

The hosted staging/pilot command refuses before test loading or network access
without the reviewed environment record described in [the staging runbook](staging-runbook.md).
Do not create a synthetic attestation to bypass that guard. No production
canary, database migration, deployment, email or provider charge was used here.

Remaining hosted acceptance includes full migration/ACL/RLS/trigger parity,
both managed client registrations, actual Stripe Checkout and Identity URL and
retry behavior, settlement account bindings, signed webhook delivery, isolated
scheduler/notification sinks, near-deadline checkout expiry, 25h/71h recovery,
mixed-writer races, lost responses, partial payments and rollback continuity.
Preserve redacted run records with source and canonical hashes before enabling
either the global switch or either operator's opt-in.

The dedicated hosted pilot driver (`pilot.spec.ts` / `playwright.agent.config.ts`)
has not been delivered or executed. Its provider/browser choreography must be
finished against the selected dedicated staging environment; the local
composition suite and release evaluator are executable now, and do not stand
in for that driver. No passing stub or fabricated hosted record is supplied.

A real two-connection delayed-settlement versus expiry test passed in326ms
with one complete transaction retry; the settlement was stored once and
inventory remained blocked. A separate customer nonce rotation test completed
in432ms with two nonces, one active nonce and one inherited provider key/age.
These are SQL concurrency proofs in the owned partial schema, not provider
delivery proofs. Unresolved checkout reservations now retain inventory and
enter bounded manual review. Automatic provider cleanup/clearance remains
unimplemented, and pre-migration legacy sessions require rollout reconciliation.
