# Operations pilot assessment — 2026-10-08

Owner: delegated operations lead. Scope: booking/payment operating plan for the user-nominated Exotiq exotic demo fleet cohort at `https://book.exotiq.rent/exotiq`. This assessment writes only this report, reads isolated source, and performs no provider, tenant, database, production or original-branch mutation.

## Decision and evidence boundary

Proceed with isolated rehearsals and finish the hosted test/reconciliation work. Keep new external booking admission disabled for live use. The nominated URL identifies the desired business cohort; the word “demo” does not establish separate Supabase resources, test Stripe mode, sandbox identity, synthetic customers, or authorized test charges. Create its staging representation with separate tenant IDs, resources and a distinctly marked slug. Do not point a test agent at the public URL for a booking until its exact environment is proved.

The technical lead is the parent Codex agent; this delegated agent supplies operations design and review. A human accountable operator/payment owner and backup still need named assignment. An agent cannot provide human availability or own financial/customer decisions outside the user’s authorization.

Inspected backend HEAD: `7c3a9932f7d2dee17c2e30e646043af6279a07a8`. Final frontend checkpoint recorded in the reviewed handoff: `3411a4e49901441553e23772a829d4386067144b`. Source fingerprint: `74fa2e861eb59ae88542bcdfe1066749e24025a92c2cf32e2ccb3bec33d28b78`. Existing evidence below is inherited from explicit owner/audit artifacts, not relabeled as tests rerun by this assessment.

- [Build status](<HANDOFF_ROOT>/BUILD-STATUS.md): 320 API unit, 36 contract, 50 MCP tests; guarded eight-case partial-schema composition includes four pending-request journeys; twelve actual local browser cases use synthetic provider/API boundaries.
- [Goal verification](<HANDOFF_ROOT>/.planning/phases/01-api-docs-mcp-foundation/01-VERIFICATION.md): full acceptance remains gaps_found; hosted provider driver/configuration are undelivered.
- [Operations review](<HANDOFF_ROOT>/OPERATIONS-REVIEW.md), [security audit](<HANDOFF_ROOT>/.planning/phases/01-api-docs-mcp-foundation/01-SECURITY.md), [integration review](<HANDOFF_ROOT>/INTEGRATION-HANDOFF-REVIEW.md): resolved local race/hold/body bugs and explicit managed/provider limits.

No newly selected hosted accounts, managed issuer registrations or actual Dot client evidence has been supplied to this assessment.

## Booking ownership and the states customers should hear

An agent finds an eligible car, checks current availability, presents an unchanged itemized quote, obtains explicit hosted human consent, and submits a request with a stable idempotency key. The agent can read the owned request and offer customer completion links. It cannot approve an operator booking, upload identity documents, enter cards, invent a settlement, change pricing, or announce confirmation from a redirect.

The happy journey may begin with `pending_documents`, proceed to `requested` after verified identity, then `pending_payment` after operator approval. Human-approved identity/payment work may arrive in another order; the authoritative backend decides the resulting state. Customer wording and test assertions must follow returned `status` and `next_action`, not impose a prettier sequence. The user’s illustrative “approve → verify → pay” journey is a scenario to test, not authority to bypass the current identity-first path. Full confirmation needs current owned identity covering the rental, operator approval evidenced by the authoritative payment deadline/transition, immutable exact pricing, and both required payment legs independently settled. A zero Exotiq amount needs its explicit authoritative zero-leg ledger proof.

Inventory blocks for `pending_documents`, `requested`, `pending_payment`, legacy `pending`, `confirmed`, and `active`. A displayed hold/payment deadline does not itself release a car. State projection, Stripe object IDs, browser redirects and absent webhooks are not writers or proof that money settled.

Source: [state.ts](<BACKEND_CHECKOUT>/supabase/functions/_shared/external-booking/state.ts), [lifecycle/confirmation SQL](<BACKEND_CHECKOUT>/supabase/migrations/20261007090500_external_lifecycle_reconciliation.sql), [handoff SQL](<BACKEND_CHECKOUT>/supabase/migrations/20261007090600_customer_handoff_nonces.sql).

## The stuck-hold problem and the remaining implementation

Migration090730 intentionally preserves an issued/ambiguous Checkout reservation through delayed payment events. Reservation fields cannot be cleared/overwritten and reserved legacy DELETE is denied. The scheduler visits a fair bounded batch and queues `ambiguous_charge` for review. Its reviewed timestamp means “queued/visited”; it does not mean Stripe proved the charge absent.

This prevents a second renter getting the same car while a first payment may still exist. It can retain inventory indefinitely. The existing code has no automatic authoritative Stripe expire/retrieve cleanup and no safe manual clearance RPC. Operations must not work around this with SQL field-clearing, disabling a trigger, a booking DELETE, a timer, a new idempotency key, or “we did not receive a webhook.”

Minimum next-phase reconciliation implementation:

1. Persist an append-only reconciliation case with booking/tenant IDs, immutable attempt identity, provider mode/account, session/intent references, redacted outcome, case state/version, lease, timestamps and reviewer identity. Do not persist cards, identity documents, private hosted URLs or bearer credentials.
2. Reuse an existing provider session/attempt where safe. Resolve an ambiguous create response within the original supported idempotency window. Outside it, do not blindly retry creation: search/retrieve in the correctly bound provider account, escalate unresolved absence, and preserve occupancy. “No stored reference” is not proof that creation failed.
3. Retrieve session and underlying payment objects in the exact account/test mode. Match booking/attempt metadata, customer binding, amounts, currency, destination, session status, intent status/amount_received and both leg records. Wrong account/mode/metadata, partial payment, pending processing, duplicate payment, missing resource or failed retrieval remains retained/manual review.
4. For a still-open session whose payment deadline has passed, expire it through the authenticated provider API if it is eligible, then obtain authoritative terminal evidence. A concurrent completed/processing payment wins reconciliation; an expire error does not establish unpaid cancellation. Provider expiry alone is not proof for all related intents/legs or delayed payment methods. Restrict the pilot to the implemented reviewed card profile; other methods require acceptance.
5. Make network calls outside long booking/database locks. On authoritative return, reacquire the sorted inventory/booking locks and compare current case/attempt/settlement state with the observed version. Stale evidence must not override a webhook that committed meanwhile.
6. Implement a narrowly authorized clearance transition that consumes verified evidence and preserves immutable reservation history. It must have service-only reviewed permissions, an independently verified reviewer action where manual judgment is required, transactional audit, idempotent execution and no agent-facing authority. A trigger bypass is not a design. Show that late settlement after terminal/refund handling queues a recoverable financial case and never silently reconfirms/reallocates inventory.
7. Partial/duplicate/succeeded payments are settlement or refund cases. Refund decisions are human operations decisions; completed provider refunds need their own account-bound, exact-amount, fenced evidence before financial closure. Preserve historical settlement records. The ordinary booking flags do not refund or cancel previous charges.
8. Prove legacy continuity and audit/drain/reconcile pre-reservation-tracking sessions before exposure; these old records cannot acquire trustworthy “unpaid” status through a blanket backfill.

Design rationale from current primary sources: Stripe expiration applies to an open session and can fail for a session that is no longer expireable; therefore a failed expire call is not clearance evidence. [Stripe expiration API](https://docs.stripe.com/api/checkout/sessions/expire). Stripe documents duplicate/out-of-order delivery and API retrieval for missing/current objects; the operating procedure must tolerate those conditions. [Stripe webhooks](https://docs.stripe.com/webhooks). Stripe can remove idempotency keys after at least24 hours; the existing conservative23-hour policy must preserve its original attempt age. [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Current implementation source: [090730 conservative reservation SQL](<BACKEND_CHECKOUT>/supabase/migrations/20261007090730_preserve_unresolved_checkout_inventory.sql), [rent checkout](<BACKEND_CHECKOUT>/supabase/functions/rent-checkout/index.ts), [rent payment webhook](<BACKEND_CHECKOUT>/supabase/functions/rent-payment-webhook/index.ts), [rollout operating limits](<BACKEND_CHECKOUT>/docs/external-booking/rollout.md).

### Manual case handling before clearance is implemented

The operations owner opens a case, verifies environment/account/mode and the booking tuple, retrieves provider truth using trusted administrative tooling, checks both required legs and current identity, and records redacted evidence plus the reviewer’s proposed disposition. The technical owner checks race/idempotency/permissions and the implemented authoritative transition. During development, a case remains retained if no safe transition exists, even when a human suspects it is unpaid. Explain “payment requires review; your request is not yet confirmed” to the synthetic customer. No production notification is sent during staging.

The approved future manual procedure must state exactly which reviewed RPC/action is used, what evidence it requires, what rolls back on conflict, and how a delayed event is handled. Until that exists, staging can demonstrate retention and escalate a case; it cannot claim clearance automation is complete.

## Separate practice resources and creation checklist

The user authorizes staging planning/setup. Actual creation requires access to the selected organizations/accounts and decisions about account owners, billing/project names and DNS; no credentials should be requested in chat. Use a secret manager or authenticated provider UI.

| Resource | Required record and mode | Isolation proof and unresolved input |
| --- | --- | --- |
| Supabase | Dedicated project ID, exact origin, schema-only reviewed baseline, separate keys | Never original project `<HISTORICAL_LOVABLE_PROJECT_REF>`; explicit allowlist; actual applied functions/defaults/ACL/RLS/triggers/constraints and denied role calls. Organization/project owner and selected new project are unspecified. |
| Staging frontend/API/MCP | Separate HTTPS origins and pinned routes; visible staging indicator | No wildcard tenant fallback, public booking-origin write routing, forwarded-host authority, shared cookies or production service tokens. DNS/hosting owner and chosen origins are unspecified. |
| Exotiq demo cohort representation | New synthetic operator/customer/vehicle/location IDs; clearly marked staging slug such as `agent-test-exotiq-demo` | Business label refers to the nominated cohort; IDs never equal production IDs. Scope/slug alias, Miami/Tampa eligibility and opt-in need explicit fixture mapping. No live fleet price/availability assertions are published. |
| Stripe operator and Exotiq legs | Separately evidenced test/sandbox accounts or resources, correct test connected account destination, `sk_test_` server keys, matching test webhook secrets | Both actual returned objects/events must have `livemode:false`; exact account/mode provenance, no shared live webhook routing or live payment method/customer IDs. Account owner/access is unspecified. |
| Managed OIDC/OAuth | Dedicated agent-test HTTPS issuer, customer registration and two genuine consumer registrations | Exact issuer/audience/client binding, callback/resource URLs, PKCE/state/nonce, introspection/revocation and rotation profile. Existing guard requires issuer hostname containing `agent-test`; legitimate provider hostname compatibility must be reviewed rather than bypassed. Provider choice/registrations are unspecified. |
| Identity | Provider’s sandbox/test verification session and documented synthetic results | Never real personal documents or old guest verification trusted through backfill. Stripe’s test-mode Identity flows simulate result states; they are not live identity verification. [Identity testing](https://docs.stripe.com/identity/testing). |
| Scheduler, outbox, email and logs | Isolated cron/jobs/notification sink; fake non-deliverable contact details; redacted event storage | Worker schedule/invocation/dedupe proof, no real customer/operator mail or SMS, retention/access/ownership. Provider notification profile must match actual implementation. |
| Seed/cleanup | Bounded manifest with exact synthetic markers, UUIDs and owner IDs | Current REST seeder supports five table types and rejects sensitive fields. Location/Auth/Connect fixtures and approved teardown for issued immutable reservations need a reviewed extension; do not assume broad seeder teardown can delete booked/issued reservations. |

Use realistic fixed synthetic prices in cents with valid nonzero provider amounts, itemized operator and Exotiq legs, normal terms and pickup/return/buffer policy. Do not promote the historical $2 Audi or Scottsdale demo into live eligible supply. The chosen staging cohort can represent Exotiq while retaining the currently required Miami/Tampa market coverage. If it only represents one market, the four required release journeys remain incomplete; broadening source policy requires a reviewed requirement/test change.

The current environment runner demands an external config `AGENT_STAGING_CONFIG`, exact project/origin allowlists, matching dated reviewer evidence expiring within seven days, baseline checksum, applied schema/grants and isolated scheduler proof, OAuth issuer/test legs/sandbox identity/email sink, and secret-manager-injected test keys. Filling booleans without the underlying evidence is not acceptance. Service seeding currently requires a project-bound service JWT; opaque service keys are refused. Account labels/test-key prefixes supplement actual resource checks and never prove isolation alone.

Source: [guard-environment.mjs](<BACKEND_CHECKOUT>/scripts/agent-booking/guard-environment.mjs), [seed-staging.mjs](<BACKEND_CHECKOUT>/scripts/agent-booking/seed-staging.mjs), [staging runbook](<BACKEND_CHECKOUT>/docs/external-booking/staging-runbook.md).

## Test matrix and evidence to collect

Implement the hosted driver/configuration and named managed acceptance cases first. Run four complete Miami/Tampa × API/MCP journeys, plus actual selected client profiles. “Legacy/modern SDK” is local compatibility evidence, not proof that Dot or Claude connected. Use a run ID, synthetic fixture IDs, source/deployed fingerprints, exact client/version, redacted event/session identifiers, UTC event times plus Denver report date, state/action/occupancy transitions, expected/actual cents, disposition and reviewer for every case.

| Case | Expected safe result | Evidence required |
| --- | --- | --- |
| Genuine discovery → quote | Only selected eligible opt-in market/tenant; current availability; immutable price/terms | Tool/API transcript plus actual source/RPC availability and quote hash. Search rank is recorded separately. |
| Human consent and submit | Human reviews exact quote/original client/actions; one request created | Actual managed login/consent; receipt consumption; request/outbox/audit; never a hand-inserted grant. |
| Approval/identity/payment ordering | No confirmation before all gates; actual next_action guides human | Reject direct premature confirmation; demonstrate identity-first and approval-first permitted paths without forcing status. |
| Full payment | Both exact required legs settled, including explicit zero-leg scenario | Correct accounts, modes, signed events/trusted retrieval; original itemization equals charged totals; confirmed only after identity/approval. |
| Duplicate click/retry/timeout | Same key gives original response and one booking; changed payload conflicts | HTTP lost-response replay, simultaneous client requests, SQL row/outbox count; no duplicate charge. |
| Browser return before webhook | Pending/awaiting settlement/reconciliation; no false confirmation | Delay signed event, reload completion/status page, then event recovery. |
| One leg settles; other fails/unknown | Occupancy retained; partial/manual case; no forced confirmation | Provider test decline/outage for fee leg; stable attempt ID and bounded retry; correct recovery/refund handling. |
| Late settlement versus expiry | Paid booking never released/oversold | Real provider delayed delivery and transaction race; second booking refusal; inspect final ledger/state. |
| Cancel/expiry with issued session | Session/attempt preserved until authoritative evidence; no delete/clear bypass | Legacy and external issued reservations; adversarial table mutation denied; post-expiry late event. |
| Expired/revoked permission or nonce | Next request denies withdrawn authority; explicit human recovery with unchanged scopes/client | Actual introspection/grant revoke; expired link and fresh customer click; no GET/autorenew;25h/71h cases distinguished from clock simulations. |
| Identity mismatch/rejection/expiry | No cross-customer/team authority; no confirmation | Provider sandbox reject/requires-input, owned-link timing and document expiry covering return. |
| Unknown availability/provider outage | No quote/request/checkout authority on unknown; safe bounded error | AS/JWKS/RPC/provider/timeouts/disconnects, zero unintended writes, no secrets. |
| Disable new admission | New requests/quotes blocked; accepted owner status/replay/identity/payment continue | Global and tenant toggles independently; notification/financial workers continue. |
| Webhook duplicate/out-of-order/wrong mode | Dedupe; current truth; wrong signature/mode/account rejected | Actual signed provider samples/retrieval; old/new events and settlement uniqueness. |
| Cleanup/rollback | Exact reviewed synthetic scope; existing money/holds/recovery preserved | Runtime/project preflight, no wildcard deletes, worker continuity, preserved audit/evidence. |

Current release evaluator checks source fingerprint, full applied privileges, managed providers/gateway/scheduler, next-request revocation, outage/rollback continuity, four confirmed market×transport journeys, itemization equality, critical failure counts and scheduler lag. The plan must extend it with payment clearance and real named-client evidence; the existing evaluator alone does not check all new rows.

Source: [release-gates.mjs](<BACKEND_CHECKOUT>/scripts/agent-booking/release-gates.mjs), [pilot evidence](<BACKEND_CHECKOUT>/docs/external-booking/pilot-evidence.md).

## Human operating coverage and pause/resume

Technical lead owns deployed provenance, auth/transport/database changes and fixes. Operations lead owns case queue, customer wording, reservation and money dispositions, and evidence review. Pilot operator’s human representative owns approve/decline and pickup/service readiness. A named backup covers each role during an active hosted pilot; if nobody is watching, close new admission and keep completion/reconciliation running.

Existing acceptance thresholds: zero unauthorized actions, duplicate requests/charges, overlaps, false confirmations or secret leaks;100% compared quote/charge itemizations equal; scheduler lag≤5minutes. Existing high-volume alert is UNKNOWN/handoff failure>1% over15minutes at≥100 samples. At small pilot volume, investigate every UNKNOWN, handoff failure and stuck/partial case instead of waiting for100 samples.

Recommended staging operating cadence, to implement and confirm rather than claim current automation: continuously monitor critical errors; review each manual case immediately during the watched session; give every case an accountable owner within15minutes; review queue count/oldest age/scheduler lag every5minutes; hand over unresolved cases before closing the session. These are proposed operating targets, not measured backend SLAs.

Pause new admission immediately on any critical invariant failure, uncertain production routing/mode, authorization outage, unowned stuck payment case, worker lag over5minutes without recovery, or inability to demonstrate inventory safety. Operations may conservatively pause a tenant earlier on a single ambiguous payment. Use reviewed authenticated flag actions; do not stop financial/webhook/recovery jobs, clear holds, delete ledger rows, refund everything or drop migrations.

Resume after root cause and repair, targeted regression plus relevant complete journey, provider-authoritative financial disposition of affected cases, unchanged/isolation-verified resource bindings, reviewed metrics and technical+operations sign-off recorded in the pilot evidence. Default-off remains the start condition.

Source thresholds and flag continuity: [rollout.md](<BACKEND_CHECKOUT>/docs/external-booking/rollout.md). Its current command examples do not authorize production mutation during this assessment.

## Manual Dot or other real-agent rehearsal

Run this only after the selected client can reach the reviewed staging endpoint, authenticates with a supported genuine resource/client profile, and the hosted driver/provider gates pass. This is explicitly planned work; no real Dot test has occurred.

1. Record exact app/vendor URL/version, whether it supports custom remote MCP with OAuth or another supported API/browser path, the actual transport/issuer/client/audience/scopes and staging host. Unsupported capability is “unsupported/not tested,” never a hand-waved pass.
2. Give the human tester this instruction: “Use only [reviewed staging marketplace URL]. Find an exotic/luxury car in [seeded Miami/Tampa market] for [available fixture window]. Treat every car/price as a staging example. Show the itemized quote and provider/operator identity. Do not submit, approve, pay or verify identity without the required human steps. Never use a live host or payment method.”
3. First run discovery without a direct Exotiq link or MCP preconnection, in a separate measured public read-only scenario. Record surfaced sources and whether Exotiq appears. Then run connected staging booking. Connecting the MCP or telling the agent the brand demonstrates task execution, not organic discovery.
4. Agent searches/checks availability/creates a quote. Human follows the actual hosted consent/login review and explicitly chooses scopes; agent submits with one stable key. Operations verifies one request and pending state.
5. Human pilot operator approves in staging. Synthetic human renter completes provider sandbox identity when the backend’s next_action requests it. Human completes hosted Stripe test checkout; test-card entry stays in the provider UI. The backend executes only the authorized existing charge model.
6. Agent reads status, describes pending states honestly, and only announces confirmed after authoritative status returns confirmed. Record both payment proofs and current identity/approval.
7. Repeat selected interruption/replay/expiry/late-event cases; do not manufacture signed paid evidence. Operations records known failure/next action/case owner.
8. Withdraw agent grant, verify denial on its very next protected request, then exercise separately authorized human account continuation. Disable new admission; verify existing continuity.
9. Human reviewer signs the run and records any new issue as a next-phase item with reproducible trigger, actual state/amount, risk, owner, regression and acceptance evidence.

### Named-client support evidence matrix

| User name | Current verified booking-client support | Required next action |
| --- | --- | --- |
| Dot / dots | Unknown; no exact product/version or real OAuth run supplied | Confirm exact product URL/version, remote MCP/OAuth capability and who performs the human-controlled session. |
| Muse | Unknown | Confirm vendor/product URL; do not infer from an ambiguous name. |
| Claude | Not tested in this project | Select exact product surface and actual connector/account support, then record genuine client acceptance. |
| Hermes | Unknown | Confirm exact implementation/version and supported API/MCP auth path. |
| OpenClaw | Not tested in this project | Identify repository/version/configuration and genuine staging auth support. |
| Instinct | Unknown | Confirm exact vendor/product URL. |
| Hark | Unknown | Confirm exact vendor/product URL. |
| Any other worker | No blanket compatibility or ranking claim | Run capability/auth/schema/error/human-handoff acceptance per actual client/version. |

The actual local compatibility result is two SDK protocol profiles, not these products. A client failing native MCP/OAuth does not justify exposing anonymous booking or credentials; use a separately reviewed supported pathway or record incompatibility.

## What can be completed today and what depends on accounts

Feasible October8 within authorized isolated work: fresh scoped offline checks and browser/partial-schema rehearsal, source/discovery URL read-only inventory, this operating plan, executable next-phase plans, hosted-driver and reconciliation design/regressions using controlled fixtures, Dot rehearsal instructions and evidence format. The parent owns actual execution and records fresh results; this report does not promise today’s tests have run.

Hosted complete acceptance is dependent on genuinely provisioned staging, issuer/client/provider accounts, selected origins, schema/permissions/scheduler/gateway proof, missing driver implementation, safe clearance implementation and human operator/tester availability. No technical lead can honestly count a mock success or a generated attestation as a completed provider payment journey.

Prioritize next-phase tasks in this order: resource/tenant guards and account selection → authoritative payment recovery/clearance with adversarial races → hosted provider/browser driver and applied schema verification → four confirmed market×API/MCP journeys plus selected real-client rehearsal → watched small staging pilot/rollback review. Public discoverability work can proceed in parallel where it is read-only or isolated; real supply publication and customer-facing writes require their own release path.

The user’s “first to surface” goal must become measured discovery/connection/task outcomes across named engines and prompts; no robots/llms/agent text file can guarantee ranking or future compatibility. Ensure the discoverability plan publishes truthful current authority, tool access/auth, cities/tenant canonicals and human payment/identity limits. A marketplace that is easy to find but mislabels demo inventory or promises unverified confirmed bookings fails the operations acceptance.

## New issues to carry into the executable phase

- Provider-authoritative clearance/reconciliation, immutable reservation history and payment/webhook race tests.
- Legacy pre-reservation session audit/drain; old case migration provenance.
- Staging-only Exotiq cohort ID/slug/location/market mapping, no live tenant credential reuse.
- Seed/teardown extension for location/auth/connected-account resources and immutable issued reservations.
- Managed issuer hostname policy compatibility and explicit JWKS body/key-count cap or accepted bounded-provider proof.
- Actual Dot/vendor identification and client auth/human-handoff acceptance; no SDK-to-product pass substitution.
- Genuine organic discovery versus manually connected booking test separation.
- Operations case queue/age/ownership, pause controls, human backup and evidence handover.
- Hosted driver/configuration and release evaluator extension for new requirements.

Report created from current local artifacts and primary Stripe documentation on2026-10-08. No source edits, provider charges, live messages or hosted mutations were made.
