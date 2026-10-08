# Exotiq team action plan — October 8, 2026

Continue from the existing API/MCP build. Today we completed the available safe local tests and public discovery audit. The next implementation phase adds a protected practice environment, safe stuck-payment recovery, a full confirmed-booking rehearsal and stronger agent discovery. Hosted payment confirmation and a real Dot trial have not happened yet.

## What is already done today

- Technical lead: this Codex chat owns technical coordination and acceptance evidence.
- Operations lead: an appointed subagent completed the booking/payment review and operating runbook. A human accountable operator/payment owner and backup remain to be named for the actual watched pilot.
- Pilot cohort: the user nominated Exotic Demo Fleet at [book.exotiq.rent/exotiq](https://book.exotiq.rent/exotiq). We will use an isolated synthetic staging counterpart. The public URL's demo label does not establish that it is a safe payment sandbox.
- Fresh tests: 321 API, 36 contract, 50 MCP, 673 frontend and 12 actual local browser cases pass. Five guarded MCP SQL cases and twenty frontend cases were skipped, not passed. API-specific backend/MCP/frontend type checks and exact API/frontend contract checks pass.
- Repairs: a test fixture now preserves the original payment deadline instead of recomputing it from a later clock reading; eight verified empty duplicate dependency directories were removed from the isolated frontend. No production booking/payment rule changed.
- Discovery audit: 21 read-only public probes found the root brand redirecting to the demo fleet, no structured data on the sampled fleet/vehicle pages, missing optional agent text files, and demo price signals that should not be represented as real rentable supply.

Detailed evidence: [today's test report](<HANDOFF_ROOT>/DISCOVERY-TEST-RESULTS-2026-10-08.md) and [source/test snapshot](<HANDOFF_ROOT>/TEST-SNAPSHOT-2026-10-08.json). Original source repositories retain their prior HEAD/status.

## The next steps, in plain language

| Step | What the team will do | Responsible lead | What lets us move forward |
|---|---|---|---|
| 1. Choose the practice accounts | Select the staging project, spending limit, Stripe platform sandbox and compatible test connected account, identity/sign-in service and HTTPS hosts. Keep these separate from live customer resources. | Human account owner + technical lead | Exact account ownership, test mode and isolation are verified; credentials remain in approved secret storage. |
| 2. Build the remaining safety pieces | Add a way to check what the payment provider actually did and resolve stuck bookings safely. A car stays reserved whenever money or an active payment session remains uncertain. Bound identity-key downloads and make dependencies/test fixtures reproducible. | Technical lead, operations review | Meaningful automated tests prove both payments, retries, old sessions and competing booking/payment updates behave correctly. |
| 3. Prepare the whole staging backend | Assemble the reviewed complete database baseline, apply it and all new changes only to the verified staging target, and check permissions, inventory locks, jobs, sign-in and notification isolation. | Technical lead | Evidence comes from the actual deployed environment, not a partial local test database or an unchecked flag. |
| 4. Improve how agents find and understand Exotiq | Establish the proper marketplace and tenant URLs, public readable pages, truthful vehicle/location/price details, structured data, robot rules, bounded sitemaps and generated API/MCP guides. Add optional agent text files with factual links. | Technical lead + business content owner | Public content is accurate; private bookings and synthetic staging are protected; generated guides match the API. |
| 5. Rehearse a complete booking | Run API and MCP journeys through both test locations, human authorization, identity, operator approval, both required payments and verified confirmation. Then interrupt/repeat actions and delay/reorder messages. Follow the backend's actual next action rather than assuming approval must always precede identity. | Technical and operations leads | Authoritative database/provider evidence confirms the booking; no duplicate money movement, overlap, false confirmation or leaking information. |
| 6. Invite Dot and another real agent | After automated hosted checks pass, try discovery, supplied-URL browsing and authenticated tool use separately. Record the exact product/version/mode and what it actually supports. | User/client owner + technical lead | Real client observations and backend evidence agree; unsupported features remain explicitly unverified. |
| 7. Review a limited pilot | Assign the human operator, payment reviewer and backups; rehearse pause/resume; review the evidence and limits before a small live launch decision. | Human business/operations owner | Critical safety metrics are zero failures, all charge itemizations match, cases have owners and financial recovery continues when new admission is paused. |

Steps 2 and 4 can progress while account selection is pending. Actual hosted deployment and transaction testing depend on steps 1 and 3. Public production rollout follows a separate concrete review; the current work has not enabled a live pilot.

## The small set of decisions needed from you

1. Confirm whether **exotiq-migration-staging** belongs to ongoing migration work and must stay reserved, or is available as this pilot's dedicated environment. Its healthy project label alone does not prove that reuse is safe. If reserved, choose a separate staging project/organization and monthly spending cap.
2. Identify the Stripe account/platform sandbox and identity/sign-in service owners, plus the DNS/hosting owner. Labels are enough in chat; never send credentials here.
3. Name the real pilot operator, payment reviewer and backups who will be available during the watched session.
4. Confirm which Dot/dots product you mean and where you will invoke it. We researched official OpenAI dots as a possible match; product identity and installed capabilities still need confirmation. Give websites/product identities for the other named agents when they join the compatibility matrix.

These are resource and staffing inputs needed to carry out your request, not a request to restart the build.

## Your real-agent rehearsal

Run the first prompt in a fresh conversation without saying Exotiq's name. Use a real market and dates, and stop before booking:

> Find luxury or exotic rental-car companies serving Scottsdale for a weekend trip. Prefer services that an assistant can understand and use with my explicit approval. Compare relevant options, cite the pages you used, and explain how a booking request and final confirmation work. Do not submit a booking or payment.

Scottsdale is an exploratory discovery query, not a claim that the demo location proves real service coverage. Repeat the cold trial in Miami/Tampa and any other markets supported by verified public operator supply. The noindex staging counterpart is never the target of organic discovery.

This measures whether the product finds and cites Exotiq unaided. Record the prompt, product/version/mode, date, sources, Exotiq's appearance/rank and competitors. A miss is useful evidence and becomes a next-phase improvement; supplying the URL would invalidate this cold-discovery measurement.

Once the hosted automated journey passes, start a separate staged booking trial:

> This is an authorized test using only the supplied Exotiq staging URL and synthetic Exotic Demo Fleet account. Find the designated test vehicle for the supplied test dates and show the actual availability, full itemized quote and terms. Obtain my explicit permission for the exact booking request. Follow the service's current next action and stop for human sign-in, consent, identity verification and hosted test payment when needed. An operator will handle approval. Do not use production URLs, real payment details or invent confirmation. Confirm only when the service reports authoritative confirmed status and both required test payments are settled. If interrupted or uncertain, retrieve the existing request's status instead of creating another request.

Supply the attested staging URL, synthetic vehicle/date tuple and exact supported client setup from the runbook. Cloud agents cannot reach localhost automatically; the staging HTTPS/access controls must support the selected client. A browser-only agent, an MCP-connected agent and a search-only assistant are different trial profiles. Do not claim MCP support unless the actual product connects and completes the selected tool flow.

Capture redacted request/booking IDs, quote cents, authoritative statuses, payment-leg evidence, timestamps and the human handoff points. Rehearse interruption, repeated request/replay, revoked consent and delayed messages. Keep sign-in/identity/payment details out of transcripts, screenshots and public reports. The [operations runbook](<HANDOFF_ROOT>/OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md) provides the fuller matrix and pause/review procedure.

## What “strong agent discovery” means here

Exotiq should have an accurate public marketplace identity, linked eligible tenant pages, readable vehicle/location/policy content, useful rental structured data and an explicit documented route from discovery to authorized booking. Demonstration content must be identified accurately. API/MCP descriptions and optional llms/agents text are generated or checked against the same contracts, so a backend change does not silently make guides wrong.

Robot rules, llms.txt, agents.txt, structured data and optional emerging browser-tool protocols do not guarantee that every assistant will recommend Exotiq or put it first. Search inclusion, recommendation quality and completed authorized bookings will be measured separately. We can build a maintainable system with versioned checks and ownership; no standard or model can make it permanently future-proof.

## What happens when the backend changes

Keep the public API contract stable where possible. Ordinary internal schema/refactor changes usually require updating the backend adapter and tests; an agent should continue using the same documented contract. A deliberate breaking public change requires an explicit new contract/version, generated API/MCP/docs updates, consumer checks and repeated real-client acceptance. Phase02 adds source/schema/content drift checks and a maintenance owner rather than requiring an API/MCP rewrite after every backend edit.

Test findings are captured as execution feedback for the following phase: fixture clocks, reproducible dependency installation, marketplace/demo separation, honest public data, safe payment resolution, genuine managed schema proof, selected client limitations and observed cold-discovery misses. Nothing from a skipped, synthetic or unrun test is counted as full acceptance.


## Executable phase plan

The [Phase 2 roadmap](<HANDOFF_ROOT>/.planning/ROADMAP.md) indexes 22 executable plans, 41 tasks and 16 dependency waves. Each task names source files to read, acceptance criteria, automated checks and security threats. Account/owner selection, real-agent rehearsal and watched-pilot readiness have explicit checkpoints. The validation map records current missing test files as meaningful Wave0 work, never as completed tests. The independent plan checker passed after three reviews. It verified the actual GSD scheduling, complete staging/deployment order, payment safeguards, all10 requirements and every task's test ownership.

The next implementation entry point is `/gsd-execute-phase 2`, explicitly using the saved planning project at <HANDOFF_ROOT> (its .planning directory), rather than treating <LOCAL_HOME> as the project. Source work stays in the isolated backend/frontend paths recorded in TEST-SNAPSHOT-2026-10-08.json; local recovery and discovery work can begin while hosted account inputs are resolved. No automatic phase execution or production launch has occurred.

The external resource-selection checkpoint is scheduled after every stage-independent local deliverable. Earlier supplied account choices are reused there; missing budget/account answers cannot stall local development through the normal GSD wave barrier. Hosted provisioning and transactions still require genuine selected and attested resources.

The [independent plan-check report](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-PLAN-CHECK.md) records the final PASS. Planning is ready for execution; all38 combined plans still have zero full accepted completion. Phase1's15 local deliveries and today's regression passes remain useful evidence with explicit hosted limits.
