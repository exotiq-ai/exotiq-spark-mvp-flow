---
phase: 01
slug: api-docs-mcp-foundation
status: partial
nyquist_compliant: false
wave_0_complete: false
local_harness_complete: true
created: 2026-10-07
---
# Phase 1 — Validation Strategy

Updated2026-10-07 after isolated execution. Local harness and implementation exist; final API320 unit/36 contract, MCP50 default with five guarded SQL skips, actual guarded composition8, frontend665 checkpoint/final affected73 and actual Next/Chromium12 pass. Full hosted acceptance is unperformed. The original planned command map is retained below with actual local dispositions; it does not silently count substitute evidence as executed staged commands. See BUILD-STATUS, per-plan summaries and01-VERIFICATION.

## Test Infrastructure
01-01 task1 creates Node Vitest runner/config/scripts before own verify. Task2 capability audit and task3 fixtures use that runner. Wave0 foundation is execution wave1. Every later named test created RED before production behavior. Offline unit/contract target<30seconds; staging and Playwright/pilot are longer mandatory acceptance gates with unknown runtime, separate allowlisted services. No original checkout builds/tests.
Quick: `npm run test:agent:unit -- --run`; contract: `npm run test:agent:contract -- --run`; staging: `npm run test:agent:staging -- --run`; pilot: `npm run test:agent:pilot -- --project=synthetic`.
Frontend tests in its isolated worktree;14 customer-browser Playwright has owned playwright.agent-handoff.config.ts; adapter npm test/config owned10. Offline mocks never prove concurrency/payment/provider behavior.

## Sampling Rate
Affected named automated slice each task RED→GREEN; each wave full contract suite plus affected frontend/adapter checks; final all auth/security/grants/quote/concurrency/payment/actual-handler rollback/MCP/browser/pilot evidence. Never production fallback.

## Per-Task Verification Map
| Task ID | Wave | Requirement coverage | Behavior suite | Automated command | Scaffold dependency | Execution |
|---|---|---|---|---|---|---|
| 01-01-1 | 1 | CAP-01, ISO-01, TEST-01 | environment | `npm run test:agent:unit -- --run tests/agent-booking/environment.test.ts` | Creates its Node runner before check | Passed in local offline suite; no hosted acceptance |
| 01-01-2 | 1 | CAP-01, ISO-01, TEST-01 | capabilities | `npm run test:agent:contract -- --run tests/agent-booking/capabilities.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-01-3 | 1 | CAP-01, ISO-01, TEST-01 | fixtures | `npm run test:agent:unit -- --run tests/agent-booking/fixtures.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-02-1 | 2 | API-01, DOC-01, PAY-01, FAIL-01, VIS-01 | contracts | `npm run test:agent:contract -- --run tests/agent-booking/contracts.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-02-2 | 2 | API-01, DOC-01, PAY-01, FAIL-01, VIS-01 | state-errors | `npm run test:agent:unit -- --run tests/agent-booking/state-errors.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-03-1 | 3 | AUTH-01, MCP-01, ISO-01 | authorization | `npm run test:agent:unit -- --run tests/agent-booking/authorization.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-03-2 | 3 | AUTH-01, MCP-01, ISO-01 | grants | `npm run test:agent:staging -- --run tests/agent-booking/grants.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-04-1 | 3 | QUOTE-01, FAIL-01, PAY-01 | quote-consent | `npm run test:agent:staging -- --run tests/agent-booking/quote-consent.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-04-2 | 3 | QUOTE-01, FAIL-01, PAY-01 | quote-validation | `npm run test:agent:unit -- --run tests/agent-booking/quote-validation.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-05-1 | 3 | SAFE-01, CAP-01, FAIL-01, PAY-01 | concurrency | `npm run test:agent:staging -- --run tests/agent-booking/concurrency.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-05-2 | 3 | SAFE-01, CAP-01, FAIL-01, PAY-01 | inventory-parity | `npm run test:agent:staging -- --run tests/agent-booking/inventory-parity.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-06-1 | 4 | SAFE-01, QUOTE-01, AUTH-01, PAY-01 | idempotency | `npm run test:agent:staging -- --run tests/agent-booking/idempotency.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-06-2 | 4 | SAFE-01, QUOTE-01, AUTH-01, PAY-01 | request-compatibility | `npm run test:agent:staging -- --run tests/agent-booking/request-compatibility.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-07-1 | 4 | API-01, VIS-01, FAIL-01, QUOTE-01 | visibility | `npm run test:agent:contract -- --run tests/agent-booking/visibility.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-07-2 | 4 | API-01, VIS-01, FAIL-01, QUOTE-01 | failures | `npm run test:agent:unit -- --run tests/agent-booking/failures.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-08-1 | 4 | AUTH-01, QUOTE-01, PAY-01, ISO-01 | externalConsent | `npm run test -- --run domain/booking/externalConsent.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-08-2 | 4 | AUTH-01, QUOTE-01, PAY-01, ISO-01 | consent-routes | `npm run test:agent:unit -- --run tests/agent-booking/consent-routes.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-08-3 | 4 | AUTH-01, QUOTE-01, PAY-01, ISO-01 | externalGrantRecovery | `npm run test -- --run domain/booking/externalGrantRecovery.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-09-1 | 6 | API-01, AUTH-01, PAY-01, SAFE-01, OPS-01 | request-routes | `npm run test:agent:staging -- --run tests/agent-booking/request-routes.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-09-2 | 6 | API-01, AUTH-01, PAY-01, SAFE-01, OPS-01 | payment-states | `npm run test:agent:staging -- --run tests/agent-booking/payment-states.test.ts` | 01-01 runner; task creates own named test RED first | Hosted not run; separate local SQL evidence in summary |
| 01-10-1 | 8 | MCP-01, AUTH-01, API-01, PAY-01 | protocol | `npm --prefix packages/renter-mcp test -- --run tests/protocol.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-10-2 | 8 | MCP-01, AUTH-01, API-01, PAY-01 | oauth | `npm --prefix packages/renter-mcp test -- --run tests/oauth.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-11-1 | 8 | DOC-01, API-01, VIS-01, CAP-01, ISO-01 | docs | `npm run test:agent:contract -- --run tests/agent-booking/docs.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-11-2 | 8 | DOC-01, API-01, VIS-01, CAP-01, ISO-01 | security | `npm run test:agent:contract -- --run tests/agent-booking/security.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-12-1 | 10 | OPS-01, TEST-01, PAY-01, VIS-01, ISO-01 | pilot | `npm run test:agent:pilot -- --project=synthetic` | 01-01 runner; task creates own named test RED first | Driver/config absent; guarded invocation refused before network |
| 01-12-2 | 10 | OPS-01, TEST-01, PAY-01, VIS-01, ISO-01 | release-gates | `npm run test:agent:contract -- --run tests/agent-booking/release-gates.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-13-1 | 5 | FAIL-01, SAFE-01, ISO-01 | AvailabilityProceed | `npm run test -- --run components/drive-exotiq/flow/AvailabilityProceed.test.tsx` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-13-2 | 5 | FAIL-01, SAFE-01, ISO-01 | AvailabilityProceed-integration | `npm run test -- --run components/drive-exotiq/flow/AvailabilityProceed.integration.test.tsx` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-14-1 | 7 | AUTH-01, PAY-01, API-01, ISO-01 | handoff-resolver | `npm run test:agent:staging -- --run tests/agent-booking/handoff-resolver.test.ts` | 01-01 runner; task creates own named test RED first | Named staged suite absent; separate local evidence; acceptance gap |
| 01-14-2 | 7 | AUTH-01, PAY-01, API-01, ISO-01 | handoff-browser | `npm exec --offline -- playwright test tests/agent/handoff-browser.spec.ts --config=playwright.agent-handoff.config.ts` | 01-01 runner; task creates own named test RED first | 12 actual local Next/Chromium cases passed; synthetic provider/API |
| 01-14-3 | 7 | AUTH-01, PAY-01, API-01, ISO-01 | handoff-continuity | `npm run test:agent:staging -- --run tests/agent-booking/handoff-continuity.test.ts` | 01-01 runner; task creates own named test RED first | Named staged suite absent; separate local evidence; acceptance gap |
| 01-15-1 | 9 | OPS-01, VIS-01, TEST-01, PAY-01 | flags | `npm run test:agent:unit -- --run tests/agent-booking/flags.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-15-2 | 9 | OPS-01, VIS-01, TEST-01, PAY-01 | rollback | `npm run test:agent:staging -- --run tests/agent-booking/rollback.test.ts` | 01-01 runner; task creates own named test RED first | Named staged suite absent; separate local evidence; acceptance gap |
| 01-15-3 | 9 | OPS-01, VIS-01, TEST-01, PAY-01 | mcp-rollback | `npm --prefix packages/renter-mcp test -- --run tests/rollback.test.ts` | 01-01 runner; task creates own named test RED first | Named file absent; actual rollback assertions in local-composition.test.ts |
| 01-16-1 | 4 | FAIL-01, ISO-01 | externalAvailabilityTypes | `npm run test -- --run domain/booking/externalAvailabilityTypes.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |
| 01-16-2 | 4 | FAIL-01, ISO-01 | externalAvailability | `npm run test -- --run domain/booking/externalAvailability.test.ts` | 01-01 runner; task creates own named test RED first | Passed in local offline suite; no hosted acceptance |

Mandatory full acceptance design below remains a requirement, not a claim of execution: all threat mitigation and cross-owner/secret-redaction behaviors must be tested; effective SQL privileges need actual denied staged calls. Deployed handlers and official MCP must prove flags/logger/rollback continuity; helper-only tests are insufficient. Current partial SQL and actual local SDK evidence are recorded separately. MCP-only pilot uses customer browser consent/recovery and server API rendezvous; no fixtures inject/copy receipt or grant into adapter.25h/71h test clock proves grant expiry recovery without hold/ledger mutation; revoked old IDs never revive.14 browser test proves allowlisted provider redirect with raw legacy credential kept backend, no referrer/analytics/log leaks.

## Full Requirement and Locked Decision Fidelity
No separate D-xx IDs supplied; actions trace PRD decisions with13 requirement IDs. All are fully planned; no partial/simplified scope.
| Requirement | Plans | Fidelity |
|---|---|---|
| CAP-01 | 01-01, 01-05, 01-11 | Full planned coverage |
| ISO-01 | 01-01, 01-03, 01-08, 01-11, 01-12, 01-13, 01-14, 01-16 | Full planned coverage |
| TEST-01 | 01-01, 01-12, 01-15 | Full planned coverage |
| API-01 | 01-02, 01-07, 01-09, 01-10, 01-11, 01-14 | Full planned coverage |
| DOC-01 | 01-02, 01-11 | Full planned coverage |
| PAY-01 | 01-02, 01-04, 01-05, 01-06, 01-08, 01-09, 01-10, 01-12, 01-14, 01-15 | Full planned coverage |
| FAIL-01 | 01-02, 01-04, 01-05, 01-07, 01-13, 01-16 | Full planned coverage |
| VIS-01 | 01-02, 01-07, 01-11, 01-12, 01-15 | Full planned coverage |
| AUTH-01 | 01-03, 01-06, 01-08, 01-09, 01-10, 01-14 | Full planned coverage |
| MCP-01 | 01-03, 01-10 | Full planned coverage |
| QUOTE-01 | 01-04, 01-06, 01-07, 01-08 | Full planned coverage |
| SAFE-01 | 01-05, 01-06, 01-09, 01-13 | Full planned coverage |
| OPS-01 | 01-09, 01-12, 01-15 | Full planned coverage |

Shared deterministic backend, operator approval, identity and both payment legs preserved02/04/06/09/14. Customer consent/revocation/recovery03/08/10. Opt-in/demo/browse policy07/11/15. UNKNOWN type/facade16 and actual proceed13. All-writer concurrency05. Source/staging ownership01/11. Website integration, delegated payment and ACP/UCP excluded.

## Wave and Ownership Map
| Wave | Plans | Ownership check |
|---|---|---|
| 1 | 01-01 | Disjoint file ownership |
| 2 | 01-02 | Disjoint file ownership |
| 3 | 01-03, 01-04, 01-05 | Disjoint file ownership |
| 4 | 01-06, 01-07, 01-08, 01-16 | Disjoint file ownership |
| 5 | 01-13 | Disjoint file ownership |
| 6 | 01-09 | Disjoint file ownership |
| 7 | 01-14 | Disjoint file ownership |
| 8 | 01-10, 01-11 | Disjoint file ownership |
| 9 | 01-15 | Disjoint file ownership |
| 10 | 01-12 | Disjoint file ownership |

Plan08 tasks1/3 frontend, task2 backend consent/recovery. Plan13/16 frontend only. Plan14 task2 frontend browser bridge, tasks1/3 backend resolver+legacy checkout. Plan15 sequentially owns backend handlers and adapter consumers after09/14/10/11. Shared-file dependencies explicit; implementation worktree paths and other-agent reconciliation01. Worktrees do not isolate deployed resources.

## Wave 0 and Source Gates
Dedicated staging project/test providers/email sink, deny-production URL/project/Stripe/prefix guard, synthetic seed/manifest teardown, offline OAuth/upstream/schema-grants/webhook replay fixtures and reviewed clean schema baseline. No credentials now. Required effective writer/default grants and all insert/update/import/blocked editor audit before external writes; no blind historical migration corpus replay.

## Design Resolutions and Mandatory Evidence Gates
RESEARCH Open Questions marked RESOLVED only as planning dispositions: universal shared writer guard; one post-rental60m snapshotted buffer with caller compatibility; verified customer/identity/document-expiry predicate. Deployed signatures/jobs/provider configuration remain unknown and owned01/11 evidence gates. ASVS5 control IDs verified officially before mapping, no obsolete number/certification claim. Missing evidence stops release rather than seeking live credentials during planning.

## Release Criteria
Four synthetic Miami/Tampa×two-client journeys and all adverse fixtures pass;100% itemization quote→request→both settled legs; zero unauthorized writes/duplicates/overlap/false confirmation/secret leaks; revoke next request; measured expiry transition lag≤5m. UNKNOWN/handoff failure>1% over15m with100-sample floor alerts; low-volume every failure investigated; authority outage blocks new writes. Real flags15 defaultdisable new quote/request, preserving existing booking status/customer reauth/identity/checkout/webhook/reconciliation; no rollback cancellation. Canary later separately authorized, never test fallback.

## Sign-Off
Local foundation delivered;36 task verifications were planned. Most local checks passed, but the hosted pilot/configuration and named managed handoff/rollback acceptance suites remain absent or unexecuted. nyquist_compliant:false and wave_0_complete:false remain intentional because managed scaffolds/gates are unfinished; local_harness_complete:true records the delivered local runner only. Full requirements remain unchecked. Independent goal verifier owns the gaps_found verdict, and security/integration/operations reports record mitigation evidence and limitations.
