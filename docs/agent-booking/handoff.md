# Exotiq technical and operations handoff to Claude

Portable public-repository copy. Start with [README.md](README.md) for source branches, document/path mappings and the newly identified GitHub-main integration gap. Environment identifiers and local paths have been redacted; original local evidence is retained.

Prepared October 8, 2026. Audience: Claude acting as the continuing technical lead, coordinating a human operations lead and a controlled agent booking rehearsal. This is a continuation brief, not proof of deployment or permission to make arbitrary live changes.

## 1. Read this first: the latest user direction

Exotiq wants a luxury and exotic rental marketplace that agents can discover, understand and use to make an explicitly authorized rental request. The first business cohort is the Exotic Demo Fleet at **https://book.exotiq.rent/exotiq**, with Scottsdale as the requested rehearsal location. The user wants to see the resulting request and inventory hold in the operator system.

The user has now clarified:

- **exotiq-migration-staging is reserved for the Lovable-to-owned-Supabase migration. Do not use it as a disposable agent test environment.**
- They believe another Supabase project serves live Exotiq Rent; its identity and actual domain routing have not been established.
- The Exotiq fleet is a demo and they manage both ends of the connected Stripe setup. Neither fact establishes the deployed database, real inventory source, Stripe mode or separation from other tenants.
- The immediate proposed test stops at a real booking request/hold, with payment links and payment completion remaining human steps. It need not charge a card or prove payment-confirmed booking.
- They are willing to defer/bypass Stripe Identity for this rehearsal. The current booking state machine still imposes identity conditions; the discussion did not implement a bypass or authorize weakening identity rules globally.
- They asked to discuss an existing healthy backend versus a full sandbox **before changing the plan**. The narrower rehearsal has not yet been incorporated into the checked Phase 2 plans or code.

Do not simply execute the old full-provider plan against migration staging. Start with read-only environment mapping and propose a precise amendment for the narrower rehearsal. Preserve the broader full-confirmation work as a later milestone.

Two questions have been sent to the user and remain pending when this document is written: whether first success means request/hold only or also operator approval/pending payment; and whether Claude will run locally on this Mac or in a separate chat/cloud environment. Incorporate their answers if available. This document does not assume either answer.

## 2. Business goal and what success actually means

The desired discovery surfaces include dots/Dot, Muse, Claude, Hermes, OpenClaw, Instinct, Hark and other workers. Exact products, versions and supported authentication modes still need identification. No real trial with any of those named products has been completed.

Measure three distinct outcomes:

1. **Cold discovery:** a worker asked about luxury/exotic rentals without being told Exotiq's brand, URL or MCP connection finds relevant Exotiq pages. Record prompt, engine, date and surfaced sources.
2. **Supplied-URL understanding:** a worker given the approved marketplace/tenant URL accurately identifies the fleet, location, demo status, booking limits and human steps.
3. **Connected task execution:** an actual supported client authenticates, checks availability, obtains a quote and human consent, submits through the API/MCP, and reads the saved request.

A connected MCP success is not organic discovery. Localhost browser tests are not cloud-client acceptance. A staging site kept out of search can test task execution, but cannot prove organic indexing. Helpful text files cannot guarantee ranking, universal compatibility or permanent future-proofing.

For the proposed request-only rehearsal, success requires **one genuine persisted request for the selected demo tenant and vehicle/window, the exact backend status and hold deadline, independent availability showing occupancy, and an operator-visible record**. No screenshot, mock confirmation, email or redirect alone establishes this.

## 3. Where the authoritative work lives

Planning and evidence root, abbreviated **O** below:

`<HANDOFF_ROOT>`

Integrated backend/operator app/API/MCP source, abbreviated **B**:

`<BACKEND_CHECKOUT>`

Branch `codex/agent-booking-backend`; current clean HEAD `ecdbb7228fe29424a6f4c13bc779e12639311511`. It includes the final integration and a test-only clock-fixture repair. The previous October 7 checkpoint was `7c3a9932f7d2dee17c2e30e646043af6279a07a8`.

Integrated Next storefront/customer flow source, abbreviated **F**:

`<FRONTEND_CHECKOUT>`

Branch `codex/agent-booking-frontend`; current clean HEAD `3411a4e49901441553e23772a829d4386067144b`.

The original checkouts were preserved and are not the continuation targets:

- Backend: `<ORIGINAL_BACKEND_CHECKOUT>`, original HEAD `442dd4d1cb00823132d0a0f24a26892a70dd5288`.
- Frontend: `<ORIGINAL_FRONTEND_CHECKOUT>`, original HEAD `a2260c3de1b539d0a59ab5fa4d21e12f341cb92d`.

Do not reset/clean those originals or remove their pre-existing untracked files. `O/IMPLEMENTATION-WORKTREES.json` is a historical allocation map, not the latest integrated source map. In particular, use **B/packages/renter-mcp**, not the historical adapter copy.

**O is not a Git repository.** The GSD `.planning` directory is under O, not `<LOCAL_HOME>`. Run planning workflows with the correct working directory and explicitly point implementation work at B/F. If Claude is running elsewhere, these absolute paths are references: arrange access to the integrated source and evidence before claiming it has inspected them. Do not substitute the older original checkout for missing integrated work.

## 4. What has been built

The API is the stable business boundary; MCP is a thin client of that API. Both use canonical schemas and the same authorization, prices, availability and lifecycle.

| Layer | Implemented locally |
|---|---|
| Booking API | Versioned eligible inventory/search, authoritative availability with an explicit UNKNOWN result, immutable itemized quotes, explicit customer authorization, durable idempotent rental requests, owned status and recovery/handoff actions. |
| Customer authority | Managed-OAuth integration boundaries, exact issuer/resource audience/original-client checks, customer-bound delegation, current scope/revocation checks, browser consent and one-use server-retrieved receipts. Hosted issuer acceptance remains unverified. |
| SQL inventory/request logic | Transactional inventory serialization across reviewed writers, durable replay ledger, quote/receipt/request locking, consent consumption, notification outbox, shared overlap protection and conservative lifecycle handling. |
| Renter MCP | Six tools: `search_vehicles`, `check_availability`, `create_quote`, `submit_rental_request`, `get_request_status`, `create_checkout_handoff`. Official SDK transport/auth integration; no independent pricing or booking engine. |
| Customer frontend | Actual Next sign-in/quote review/explicit consent, account/status continuity, expiring opaque identity/checkout handoff, grant renewal/revocation/expiry and explicit recovery. Provider secrets stay server-side. |
| Contracts/docs | Canonical TypeScript schemas, generated OpenAPI/examples, generated frontend validators with exact source provenance, adapter compatibility checks and rollout/staging guides. |
| Operational controls | Default-disabled new admission, persistent global/tenant flags and rate budgets, redacted events, bounded request/response handling, retries/jobs/outbox, existing accepted-booking continuation after admission closes. |

The ordinary agent flow is:

**Search → authoritative availability → immutable quote → human hosted sign-in/consent → request submission with stable idempotency key → owned status.**

A quote does not hold inventory. Waiting for consent does not create a booking. The user grants specific actions; those choices start unchecked. The agent may not invent customer IDs, supply its own prices, approve the operator's decision, enter a card, upload identity documents or report confirmation from a success page. A lost submission response must be retried with the same key and intent, not a new key or a legacy unkeyed writer.

Full confirmation additionally requires current owned verified identity, operator approval and the independently required settled payment legs. That is a separate acceptance target from request-and-hold.

## 5. The state/hold mismatch to resolve before rehearsal

These are current **isolated source rules**, not an attestation of deployed behavior:

| Starting/transition state | Current rule |
|---|---|
| New request without valid owned verified identity | `pending_documents`, next action `verify_identity`; normally a 24-hour hold from creation when there is no financial activity. |
| New request with valid owned verified identity | `requested`, next action `await_operator`; normally a 72-hour hold from creation when there is no financial activity. |
| Operator approval of an eligible marketplace request | `pending_payment`; payment deadline is the earlier of approval + 48 hours or pickup − 2 hours. |
| Issued/uncertain checkout | Conservative inventory retention. A deadline passing does not prove a safe release. |

`pending_documents`, `requested`, `pending_payment`, legacy `pending`, `confirmed` and `active` block inventory. Current operator approval deliberately rejects `pending_documents`. Do not use the legacy direct-booking confirmation path to manufacture an apparent marketplace success.

Therefore, “agent submits and the vehicle is held for 48 hours pending payment” is **not the current first transition**. Resolve this explicitly:

- If the user accepts request-and-hold first, demonstrate a real `pending_documents` request with its truthful current hold. No Stripe Identity execution is necessary for that narrower result.
- If the user needs approval/pending payment, determine whether an appropriately verified test customer exists, or design a reviewed demo-only identity-deferral policy confined to the chosen tenant/customer/environment. Do not label deferred identity as provider verified. Do not weaken real-customer confirmation or silently rewrite the shared lifecycle.
- If the user intends a new 48-hour-from-submission business rule, that is a real lifecycle/contract change requiring planning, implementation and tests.

Check actual writers and expiry jobs, not just frontend labels. Inspect:

- B `supabase/functions/_shared/external-booking/state.ts`
- B `supabase/functions/rent-approve-booking/index.ts`
- B `supabase/functions/_shared/rentFormat.ts`
- B `supabase/migrations/20261007090600_customer_handoff_nonces.sql`
- B `supabase/migrations/20261007090500_external_lifecycle_reconciliation.sql`

## 6. Demo and Scottsdale eligibility are not already proved

The current shared `is_marketplace_team` SQL predicate requires visible/approved/non-deleted teams and **excludes `is_demo_account=true`**. External quote SQL uses that predicate. Thus a public `/exotiq` page does not establish that the new API permits demo requests. Earlier locally exercised market profiles were Miami/Tampa; Scottsdale needs an explicit current eligibility/location review.

Inspect B `supabase/migrations/20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql` and `20261007090100_external_quote_snapshots.sql`, then trace their deployed definitions and callers. Establish the real tenant/team/vehicle IDs, location, timezone, source and writer.

F `domain/booking/config.ts` defaults to mock data unless `NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=supabase`. Explicit Supabase mode with missing public URL/key throws rather than silently falling back. Its older header comment is stale; use the actual function. The public demo's data mode has not been established.

Prefer a narrowly authorized pilot eligibility mechanism with tenant-scoped tests over globally removing the demo exclusion. The mechanism must preserve other tenants' boundaries, consent, truthful prices and occupancy. If the demo is purely mock data, creating a real backend cohort and operator view is prerequisite work, not a cosmetic test toggle.

## 7. Verified tests and what remains unverified

Fresh October 8 results at the source HEADs above:

| Check | Result | Limit |
|---|---|---|
| API unit | 321 passed | Controlled local fixtures. |
| API contract | 36 passed | Source/schema/provenance safety. |
| MCP default | 50 passed; 5 guarded SQL skipped | Actual adapter/SDK locally; skips are not passes. |
| Frontend full | 673 passed; 20 skipped | Local component/integration coverage. |
| Actual Next/Chromium | 12 passed | Actual local browser; synthetic API/provider boundaries. |
| API-specific, MCP, frontend typechecks | Passed | Not native checking of every Edge entrypoint. |
| Canonical generation / exact frontend consumer check | Passed | No deployed-schema attestation. |

Total of these test suites: **1,092 passed; 25 skipped**. Do not add historical runs to this total.

October 7 also has eight guarded SQL/MCP cases, including four Miami/Tampa × SDK-profile journeys ending at `pending_documents`. They used a partial PostgreSQL schema and were not rerun October 8. They are not full Supabase/provider/confirmed-booking acceptance.

The first October 8 API run found a fixture clock race. A deliberately two-second regression failed before the repair and passed afterward; the fixture now preserves the original booking deadline. Commit `ecdbb722` changes tests, not production deadline rules. Frontend typechecking required removing eight verified empty duplicate `@types` directories in the isolated dependency tree; no source/lock/config change was made. Their origin is unproven.

**No production deployment, hosted provider-confirmed journey or real named-agent trial has been performed.** Fifteen of sixteen Phase 1 plans have local delivery; the hosted pilot plan is partial. Full accepted plans/phases remain zero. Passing local checks and an independently approved plan do not mean a live booking API is already available.

Remaining broader release gaps include complete applied schema/ACL/RLS/trigger/gateway/job parity; real hosted OAuth/client registrations; bounded managed JWKS response handling; a dedicated actual hosted Playwright driver; provider-authoritative uncertain-payment resolution and safe audited clearance; legacy checkout-session reconciliation; and genuine client/discovery/operations acceptance.

Current issued/unknown payment holds can persist pending review. Do not clear reservation fields, delete bookings, disable triggers or infer nonpayment from absent webhooks. A request-only rehearsal can defer provider payment testing, but must avoid creating payment attempts accidentally and must define lawful cleanup.

## 8. Supabase and deployment mapping: Claude's first preparation job

Read-only management inventory on October 8 reported these project labels/refs:

| Label | Ref | Meaning currently established |
|---|---|---|
| Loveable 2 gen MVP | `<MVP_PROJECT_REF>` | Candidate; do not assume it is current live Rent. |
| exotiq-migration-staging | `<RESERVED_MIGRATION_PROJECT_REF>` | Reserved migration project; exclude from disposable rehearsal. |
| Exotiq Protect | `<PROTECT_PROJECT_REF>` | Separate named project; not selected. |
| exotiq-exchange | `<EXCHANGE_PROJECT_REF>` | Separate named project; not selected. |

Older source documentation names `<HISTORICAL_LOVABLE_PROJECT_REF>` as a Lovable production project. **That differs from the visible label/ref above.** Resolve the discrepancy from actual deployment bindings; never merge these identities by guesswork. ACTIVE_HEALTHY only means the resource was running when inspected.

Supabase CLI `supabase` was authenticated and available, version 2.90. Stripe CLI `stripe` is installed. Access must be rechecked in Claude's execution environment. Lack of shell environment variables did not imply lack of CLI authentication. No Stripe account or identity issuer has been selected for a hosted pilot.

Preparation assignment:

1. Read deployment/build configuration and inspect permitted management metadata. Trace `exotiq.rent`, `book.exotiq.rent`, the operator dashboard, actual API/MCP origins and frontend data mode to exact projects/builds.
2. Record nonsecret resource IDs, origins, source HEADs, migration baseline, relevant function definitions/permissions, scheduler configuration and admission flags. Keep credentials and customer data out of reports.
3. Verify whether the demo tenant is persisted, which system owns its inventory, whether Scottsdale/location/timezone are correct, and whether the operator can see requests created by the intended API writer.
4. Present the smallest safe target: a separate request-focused practice backend/branch, or a tightly bounded supervised canary on the actual demo tenant. Describe shared triggers/jobs, notification recipients, admission scope, cleanup, rollback and known impacts. Do not mistake tenant isolation for separate infrastructure.
5. Before cloud creation, paid resources, schema application or live admission, resolve the exact target/ownership/budget and scope checkpoint. The latest user requested discussion before changing the plan. The reserved migration project is not a fallback.

A request-focused environment needs real auth/consent, database inventory/request logic and an operator view. It need not reproduce payment and identity providers if those steps are genuinely excluded. A full provider sandbox remains valuable for later confirmed bookings. Same code/contracts can serve stage and live with explicit resource/origin/auth configuration; environment changes do not require rebuilding API/MCP from scratch.

## 9. Work Claude can prepare before any hosted rehearsal

Do the authorized read-only mapping and isolated local preparation first. Do not wait for provider accounts to write a useful request-only driver/runbook.

- Draft the reduced rehearsal scope amendment, success states and deferred acceptance items against the existing Phase 2 plan. Keep all current evidence intact.
- Trace demo eligibility, Scottsdale location, data source, identity gate and operator approval path. Prepare narrowly scoped changes in integrated isolated source where needed; clearly separate a proposed policy from existing behavior.
- Build the actual guarded request-only API/MCP/browser rehearsal harness. Require exact allowed origins/project/tenant/customer IDs, approved windows, genuine human consent and a test-only recipient. Make production fallback and unguarded test discovery impossible.
- Add meaningful regressions for any changed policy: other tenants remain denied; unauthorized writes/replays fail; consent and grant expiry/revocation remain enforced; collisions/replays preserve one request and one occupancy record; pending stays pending.
- Prepare an operations runbook with a named human owner/backup, steps to inspect the real request and availability, pause-new-admission action, existing-booking continuity and supported cleanup.
- Prepare generated discovery/API/MCP guidance and truthful marketplace/tenant pages. Label synthetic inventory/prices, keep private pages protected and check canonical/SSR/robots/sitemap/structured-data behavior on the intended hosts.

Two existing harness gaps matter: B `scripts/agent-booking/run-tests.mjs` currently dispatches Vitest even for `pilot`; the broader plan assigns a real guarded Playwright implementation. Also the planned release-gate CLI must actually invoke its evaluator; an exported module exiting zero is not a checked release. Do not use placeholder tests, `passWithNoTests`, mock-only results or guard refusal as pilot passes.

Six prior local PostgreSQL labs were stopped with their volumes/evidence retained. Existing lab startup refuses retained manifests and its entrypoint initializes the database. **Do not blindly restart/init/reset these old labs.** Use a reviewed fresh owned run/root/container/internal network/empty volume with disjoint fixture IDs/windows, or first implement and test a genuine safe resume path. A partial lab still cannot attest full hosted schema parity.

When modifying new Supabase Edge handlers, run the applicable native Deno checks assigned by the plan as well as TypeScript/unit tests. Today's API-specific typecheck does not cover every new scheduler/recovery/operations handler. Native Deno was not installed/proven by today's evidence.

## 10. Request-and-hold rehearsal protocol

This protocol is the proposed narrower test. Obtain the target and state decision first; do not claim it is already enabled.

1. **Preflight:** attest the selected environment, deployed source/migrations, exact demo IDs and Scottsdale timezone, real data mode, API/MCP auth resources, allowed client, scoped admission, operator view and test email. Select an available noncustomer window. Keep charges and checkout creation out of this request-only run.
2. **Baseline:** independently record the vehicle's authoritative availability and absence of a conflicting rehearsal request. Use offset-bearing timestamps. UNKNOWN is an unresolved result and stops submission.
3. **Agent discovery:** separately record cold discovery, supplied-URL comprehension and connected API/MCP execution. Identify exact client/product/version; record unsupported capabilities rather than bypassing auth.
4. **Quote:** search/check/create quote; compare exact vehicle/window, currency, itemized price/terms and expiry. Quotes do not occupy the car.
5. **Human authorization:** customer signs in and reviews the exact quote on the actual first-party consent page; explicitly chooses delegated scopes. Keep Stripe identity verification distinct from account authentication/consent. A no-identity test still needs proper customer authority.
6. **Submission:** agent uses one stable idempotency key. Record redacted request ID, client/environment and submission outcome. No retries through the legacy unkeyed writer.
7. **Independent proof:** confirm the genuine booking row, tenant/customer/vehicle/window binding, status/next action and actual hold deadline. Confirm the same request in the operator UI and independently verify the vehicle is blocked. Ask the user/operator to observe it.
8. **Replay and interruption:** retry the same intent/key after a repeated click or simulated lost response; prove the same request returns. Exercise another-customer/tenant denial, expired or revoked permission and a competing overlapping request. Keep fixtures disjoint from real bookings.
9. **Optional approval lane:** only if selected, follow the approved identity/test-policy path and real operator action. Assert `pending_payment` and its actual capped deadline. Do not claim paid/confirmed status or execute checkout as part of this lane without separate scope.
10. **Close:** use a supported authoritative cancellation/release path for a request proven to have no financial activity; verify availability returns and record the disposition. If financial uncertainty exists, preserve the hold and assign review. A timestamp alone is not cleanup proof.
11. **Report:** attach redacted evidence, exact sources/deployments, actual state transitions and deadlines, duplicate/occupancy/auth assertions, operator acknowledgement, cleanup and all skipped/deferred cases.

Stop on uncertain environment routing, wrong tenant/customer, hidden live notifications, availability UNKNOWN, duplicate/overlapping requests, false confirmation, auth boundary failure, accidental checkout/payment or inability to clean up safely. Close new admission through the reviewed controls while leaving accepted-booking recovery operational.

## 11. Questions to resolve, without asking the user for discoverable technical facts

Claude should investigate routing, data mode, schemas and deployment state first, then bring back concise choices:

1. **Outcome:** request saved and held first, or operator-approved awaiting payment? Does the user require exactly 48 hours, or accept the current lifecycle deadline for the chosen lane?
2. **Environment choice:** after mapping, is the user comfortable with a supervised demo-only canary on the real backend, or should a separate small practice backend be created? Who owns it and what spending limit applies?
3. **Human participant:** who is the operator and backup, which customer test account is appropriate, and where may rehearsal emails go? Ask for labels/addresses as needed, never passwords or card details in chat.
4. **Test inventory:** which demo vehicle/window should be used, and may it be made temporarily unavailable? Confirm Scottsdale timezone and that the window is not serving a real customer.
5. **Identity policy, only if approval is required:** is a properly verified test customer available, or should a tightly scoped explicit demo deferral be designed? Avoid global bypasses and fake provider verification.
6. **Agent surface:** what exact Dot/vendor URL/version and client mode will the user run? Can it connect to a remote authenticated MCP? For Claude, is this local Claude Code or a separate app/cloud chat?

Already answered: the nominated pilot fleet, migration staging's reservation, the preference to defer payments/Identity for the immediate request discussion, and willingness to start with isolated local tests. Do not ask those again as though unknown.

## 12. Discoverability findings and work to retain

The October 8 read-only audit made 21 bounded public GETs. At that time:

- `exotiq.rent` redirected through `book.exotiq.rent` to `/exotiq`. Decide the intentional marketplace root/tenant canonical architecture.
- Demo fleet and one vehicle returned SSR content/self-canonicals, but neither sampled page contained JSON-LD.
- Robots and a 53-URL sitemap responded; the demo page exposed a synthetic $2 price signal. Do not advertise demo values as genuine supply/market prices.
- `/llms.txt`, `/llms-full.txt`, `/agents.txt` returned 404 HTML on sampled hosts. Conventional root OpenAPI/MCP/protected-resource paths also returned 404; this does not establish absence of an API elsewhere or make every probed path a universal standard.
- Declared crawler user agents received content; this does not prove real crawling/indexing or a named-agent booking run.

Retain the plan for truthful SSR/canonicals/tenant and vehicle identities, accurate eligible supply/location and rental terms, robots/sitemaps/private-surface protection, appropriate structured data, generated API/MCP/auth documentation and optional machine-readable site guides. Recheck current official standards/client support during implementation rather than freezing proposals into permanent requirements. Do not publish private reservation/customer/provider data or fabricated reviews/offers.

Internal database refactors normally require updating the API facade/migrations and testing preserved v1 behavior. Public fields, states, scopes or semantics require canonical contract review, regenerated docs/frontend validators, adapter compatibility tests and a version/migration decision. Those checks detect drift; they do not automatically repair integration logic.

## 13. Existing broader plan and continuation rules

Phase 2 is at O `.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot`: **22 plans, 41 tasks, 16 waves**, independently checked, execution not started. It covers environment, payment recovery, managed schema/provider/browser acceptance, public discovery, operations, named-client testing and feedback. The plan's full-provider gate is deliberately broader than the latest proposed request rehearsal.

Thirteen stage-independent plans precede the external resource/owner/budget checkpoint. Later waves provision the selected environment, apply the complete reviewed baseline and all new SQL to the attested target, prove managed auth/providers/rollback, run actual confirmed journeys and real-client trials, and review pilot readiness. No automatic production launch is authorized by a plan check.

Do not silently mark those broader requirements accepted after a narrow request test. Amend scope explicitly and preserve deferred payment/identity/confirmed-booking gates. GSD has a real wave barrier; do not invent unsupported local flags or auto-approve checkpoints. Automatic advancement is disabled. Generic state helpers may count SUMMARY files as completion; reconcile to actual evidence instead. Current full acceptance is **0 of 38 combined plans**, with 15 separately labeled local deliveries.

## 14. Reading list, commands and expected return package

Read these in order under O:

1. `TEST-SNAPSHOT-2026-10-08.json` and `DISCOVERY-TEST-RESULTS-2026-10-08.md` — current source/test truth.
2. `BUILD-STATUS.md` — implementation/gaps; its older test totals/HEAD are superseded by the snapshot above.
3. `OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md` — financial/hold/runbook reasoning; its original full-provider/staging recommendations precede the user's latest narrower discussion.
4. `.planning/PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` — broader scope/state; do not assume they already contain the latest user clarification.
5. Phase 2 `02-RESEARCH.md`, `02-PLAN-CHECK.md`, `02-VALIDATION.md` and relevant numbered plans — checked design, not executed features. Research questions marked resolved may mean a planning disposition, not supplied external account facts.
6. Phase 1 `01-VERIFICATION.md`, `01-SECURITY.md`; root `INTEGRATION-HANDOFF-REVIEW.md`, `OPERATIONS-REVIEW.md`, `BUILD-DISCOVERIES.md` — authority/integration/legacy constraints.
7. `testing/2026-10-08/public-discovery-evidence.json`, `staging-resource-candidates.json`, raw test logs and repair evidence — reproducible observations.

In B read `docs/external-booking/guide.md`, `openapi.yaml`, `mcp-compatibility.md`, `staging-runbook.md`, `rollout.md`, `pilot-evidence.md`; `packages/renter-mcp/src`; and the source files listed above. OpenAPI issuer URLs ending `.invalid` are placeholders, not a deployed issuer.

Useful **offline checks**, with cwd B:

```sh
npm run test:agent:unit
npm run test:agent:contract
node scripts/agent-booking/generate-contract.mjs --check
node scripts/agent-booking/check-consumer-contracts.mjs <FRONTEND_CHECKOUT>
./node_modules/.bin/tsc --noEmit -p tsconfig.external-api.json
```

With cwd B/packages/renter-mcp: `npm test` and `npm run typecheck`. With cwd F: `npm test`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/playwright test --config playwright.agent-handoff.config.ts` for the existing synthetic-boundary local browser suite. Inspect the configs first; do not confuse that browser suite with the missing hosted driver. Re-run relevant tests after changes, not every historical lab blindly.

Read-only environment inventory can begin with `supabase projects list --output json` after checking authentication. Do not print secrets, copy production customer data, apply migrations to a guessed project, blindly `db push`, or bypass the selected-target checkpoint.

Claude should return:

- **Environment map:** actual origins/builds/projects/data sources, selected target and unresolved bindings.
- **Scope amendment:** exact request/hold/approval acceptance, identity policy if needed, deferred full-provider work and changes to plans.
- **Preparation summary:** source changes/commits, applied or proposed Supabase actions, affected boundaries and targeted verification.
- **Rehearsal runbook:** participants, exact client/tenant/windows, guards, observer steps, pause and cleanup.
- **Results:** redacted genuine request/occupancy/operator evidence, actual states/deadlines, failures/skips and cleanup disposition.
- **Next-phase feedback:** every learned issue with reproducible trigger, impact, owner, regression and acceptance criterion. Keep discovery, API/MCP execution and payment-confirmation results distinct.

This handoff was prepared from current integrated source and retained evidence. Writing it did not change backend resources, execute a live booking, amend the phase plans or send anything to Claude automatically.
