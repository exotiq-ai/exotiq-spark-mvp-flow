# Exotiq discovery and test results — October 8, 2026

The safe checks available today are complete and pass after two narrow repairs. Full hosted payment confirmation and a real Dot/other named agent trial remain unexecuted. This report distinguishes fresh evidence from the October 7 partial SQL checkpoint.

## Fresh executed checks

| Check | Outcome | Evidence in testing/2026-10-08 |
|---|---|---|
| API source/unit | 321 passed, 27 files | api-unit-final.log |
| API contract | 36 passed, 6 files | api-contract-final.log |
| MCP adapter | 50 passed; 5 guarded SQL cases skipped | mcp-default.log |
| Frontend full suite | 673 passed; 20 skipped | frontend-full.log |
| Actual local Next/Chromium handoff | 12 passed | frontend-browser-final.log |
| API-specific backend, MCP, frontend type checks | Passed after recorded frontend dependency remedy | api-typecheck-final.log, mcp-typecheck.log, frontend-typecheck-remedied.log |
| Canonical contract and exact consumer provenance | Passed | canonical-check.log, consumer-check.log |
| Bounded unauthenticated public GET probes | 21 requests recorded | public-discovery-evidence.json |

Skipped tests are not passes. The browser checks exercise real Next source, Chromium, sign-in/consent/customer handoff boundaries and signed internal proofs against synthetic API/provider services. They do not prove real Stripe settlement, identity verification or complete deployed database parity. A test name referring to a hosted OAuth flow/public HTTPS proxy still uses the local synthetic test boundary.

The API-specific TypeScript project does not cover every source Edge handler. Phase02 assigns native Deno checks for the scheduler and new recovery/operations entrypoints. These future checks are not relabeled as today's passes.

No new full deployed SQL/provider test ran today. The earlier eight guarded SQL/MCP cases used a partial schema and four journeys ending pending_documents; that historical proof is retained separately in BUILD-FINAL-SNAPSHOT.json. It is not confirmed booking acceptance.

## Failures found and repaired

The first API run had 319 passes and one failure: its fake reservation recomputed an expiry from a later clock reading than the original booking deadline. Crossing a second boundary made the real checkout handler correctly refuse the inconsistent deadline. A new regression deliberately advances the fixture clock two seconds. It failed before the fix (checkout-clock-red.log) and passed afterward (checkout-clock-green.log). The fixture now preserves the captured booking deadline. No production deadline or authorization rule was weakened. The final full API suite passed with the new regression. Backend commit ecdbb722 records the repair.

Frontend tests passed initially, but type checking found eight empty generated duplicate @types directories. Each was verified empty and non-symlink inside the isolated dependency tree, then removed with rmdir. Type checking passed without source, dependency-version, lockfile or configuration changes. dependency-empty-directory-remedy.json preserves scope. The cause of those directories is unproven. Phase02 includes reproducible dependency installation/preflight and stable fixture clocks.

## Public discovery observations

Read-only probes of [exotiq.rent](https://exotiq.rent/) and [the nominated demo fleet](https://book.exotiq.rent/exotiq) observed:

- The marketplace root redirects through book.exotiq.rent to /exotiq. This currently presents the demo fleet as the root brand destination; source/hosting ownership and intended marketplace canonical architecture need explicit correction.
- The demo fleet and one linked vehicle return readable server-rendered content and self-canonicals. Both sampled pages have zero JSON-LD blocks.
- robots.txt and a 53-URL sitemap respond successfully. The sitemap includes the demo fleet and vehicle pages.
- The demo page contains a $2 price signal. Synthetic/demo data must not become public evidence of genuine rentable supply, market pricing or availability. The nominated pilot needs a separate isolated synthetic counterpart.
- /llms.txt, /llms-full.txt and /agents.txt return 404 HTML at the sampled hosts. These optional proposal/site-guide artifacts can supplement truthful public pages and canonical API/MCP documentation.
- Conventional root /openapi.json, /.well-known/mcp.json and /.well-known/oauth-protected-resource probes return 404 HTML. This does not establish whether an API/MCP is deployed elsewhere. mcp.json at that exact path is not a universal requirement.
- Declared OAI-SearchBot and Claude-SearchBot user agents receive the tenant page. This is only a returned-markup check; it does not prove real crawler access, indexing, recommendation rank or product compatibility.

The audit used exact public origins, a 12-second total deadline and a 768-KiB response cap; it made no booking, identity, provider or private-customer request. The JSON record contains timestamps, redirect chains, selected safe headers, body hashes and bounded extracted metadata.

## Operational and staging findings

The operations lead completed OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md. Current uncertain-payment holds protect inventory but still require provider-authoritative resolution, safe audited clearance, legacy checkout-session handling and concurrency proof. Missing webhooks alone cannot justify releasing a car.

Read-only Supabase project metadata found a healthy project labeled exotiq-migration-staging. Its label does not prove that it is disposable or available for this pilot. Ownership/reuse, selected Supabase organization, spending limit, Stripe platform sandbox/connected-account topology and identity/OAuth service remain external inputs. No cloud resources, schemas, secrets or payment accounts were changed.

The technical lead is this chat. The appointed operations subagent handles booking/payment analysis and the rehearsal runbook. A real human operator/payment owner and backup must be assigned before monitored pilot admission; a subagent does not supply human staffing or financial authority.

## What Phase02 must prove next

1. Exact staging resource identities, test modes, tenant boundaries, budget and secret handling; a complete reviewed database baseline plus all new SQL applied only to the attested staging target before acceptance.
2. Provider-authoritative reconciliation of both payment legs and all possible checkout attempts. Preserve paid/unknown holds; clear only proven terminal-unpaid cases under fenced leases, version checks and inventory-writer races.
3. Full confirmed API and actual MCP journeys, repeated clicks, concurrency, expired/revoked consent, delayed/reordered webhooks, missing provider messages, identity failures, scheduler recovery, rollback and existing-booking continuity.
4. Truthful marketplace/tenant/vehicle SSR content, host routing, robots/sitemap/private-surface protection, structured data and generated discovery/API/MCP documentation. Optional text files do not substitute for these foundations.
5. Actual named-agent cold discovery, supplied-URL browsing and authenticated tool use as separately labeled trials. Cloud agents require a guarded HTTPS staging environment; localhost tests cannot establish that compatibility.
6. Maintained contract/schema/content drift checks, tested dependency/protocol versions, discovery measurements and a next-phase feedback backlog.

Research references and current standards are recorded in .planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-RESEARCH.md. No universal future-proof compatibility or first-place search ranking can be established by these tests.

TEST-SNAPSHOT-2026-10-08.json records current source identities and verifies that both original source repositories retain their prior HEAD/status. All work remains in isolated build copies; no production rollout was performed.


## Independent planning review outcome

Phase02 planning passed independent review after targeted corrections:22 plans,41 tasks,16 dependency waves and all10 requirements covered. Review corrected the impossible old-lab restart, assigned native new-handler checks, registered every new browser/config/test owner, split oversized plans and moved the account-selection checkpoint after all13 independent local plans so the actual GSD wave barrier cannot stall them. These are planning changes, not executed new backend capabilities. The final review and both earlier issue lists are retained.

The required GSD state helper uses SUMMARY counts as completion; its output was reconciled to this project's actual zero full accepted plans/phases rather than mislabeling the partial hosted phase complete. That workflow bookkeeping observation is an execution handoff constraint, not an Exotiq backend failure.
