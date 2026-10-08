---
phase: 02
slug: agent-discovery-and-isolated-demo-fleet-pilot
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-08
---

# Phase02 validation strategy

The exact per-task map is reconciled with all22 verified PLAN files and41 tasks. Planning success is not executed acceptance. Today's dated baseline/public probes are recorded separately in DISCOVERY-TEST-RESULTS-2026-10-08.md and testing/2026-10-08/*.json/log; known initial failures and RED/GREEN fixes remain preserved.

## Test infrastructure and sampling

- Backend existing Vitest3.2.6 guarded scripts/agent-booking/run-tests.mjs; unit/contract/staging selection in test-suites.mjs. Quick: npm run test:agent:unit -- --run tests/agent-booking/environment.test.ts; full offline: npm run test:agent:unit and npm run test:agent:contract. No .env or production fallback. A staging guard refusal is refusal, not pass.
- MCP pinned Vitest4.1.11 / official SDK2.3.1. Quick affected named tests, full npm --prefix packages/renter-mcp test; five SQL-dependent cases require the explicit owner manifest. Preserve selected partial-schema provenance and fresh disjoint booking windows for any repeated SQL journey.
- Frontend Vitest4.1.6, Playwright1.63.0. Quick affected domain/component test; full npm test and npx --no-install tsc --noEmit. Existing twelve real Next/Chromium cases use playwright.agent-handoff.config.ts and synthetic provider/API boundaries. New discovery-browser/pilot coverage needs separate reviewed config and actual guarded Playwright runner, not Vitest project discovery.
- After each task commit: its meaningful affected automated slice. After each wave: canonical/consumer/authority unit+contract and affected frontend/MCP tests. Full offline suite and actual environment/provider/browser/SQL/manual evidence before final goal acceptance. Target <=30seconds per offline slice; full browser/hosted runs have measured timing rather than a deadline guarantee. No three consecutive tasks without meaningful automated verification.

## Validation strata

1. Offline: real canonical contracts, source handlers, signed JWT/HMAC/CSRF and redaction, hostile data/script serialization, auth resource boundaries, byte/time caps, safe provider-case transition logic, environment/manifest guards. No fixture output is provider settlement evidence.
2. Genuine owner-guarded SQL: actual selected migrations, role denial, booking lock/lease/CAS, concurrent settlement/clearance/inventory writer races, rollback and safe old-session preservation. Partial schema must remain partial.
3. Local actual Next/Chromium: SSR public/private markup/canonicals, noindex/no-store/no-referrer, safe customer auth and explicit actions. Separate fixture boundary from hosted provider truth.
4. Read-only live HTTP: exact public Exotiq hosts, bounded total reads, content type/status/redirect/schema/robots/sitemap. Respect public crawler policies and do not query booking/private/provider URLs. Spoofed crawler User-Agent is only a markup probe, never actual crawler/search/client evidence.
5. Complete hosted staging: verified selected organization/budget/ownership/resources, synthetic tenant/operator/customers/cars, correct platform-sandbox Connect topology, managed identity/OAuth/two independent payment legs, gateway/jobs/email sink; actual complete applied schema/ACL/RLS/GUC/triggers/constraints and current hashes. Apply reviewed schema to proven staging BEFORE acceptance; never blind historical migration push or accept an attestation generated from local fixtures.
6. Real human-authorized Dot/other agent: confirm exact product/version/mode, cold discovery separately from direct URL/MCP connection, human sign-in/consent/identity/payment/operator approval. Observed authoritative status and exact settled itemization, not browser redirect or agent prose, establish confirmation. Unsupported clients remain unsupported/unverified. No automated outbound message to a person or named agent without destination authorization.

## Wave0 scaffolds and gates

Existing unit/contract/browser harnesses exist. New exact stage-attestation, payment-reconciliation SQL/provider, managed-JWKS, discovery/schema/content, full confirmed pilot/guarded Playwright and named-agent evidence files MUST be created with meaningful denial/RED tests before their implementation; no empty stub/passWithNoTests/skip-as-pass or widened discovery. Plan01's user/account/budget resource checkpoints are required for hosted work, not local planning/testing. Credentials stored in environment/approved secret store, never plan/log/trace/generated publicfile.

## Mandatory manual checks

- Account/sandbox/operator identity and provider topology, all exact resource ownership and actual limit/mode evidence; two test-leg identities need source-specific Connect topology rather than two unrelated sandbox accounts.
- Search/browser indexing/registration results and exact named client feature compatibility; crawler directives and optional files do not promise exposure or ranking.
- Staffed human operator/payment owner plus backup and actual pause/resume/clearance approval; subagent role is planning/testing support rather than financial discretion or human availability.
- Canary/live enabling remains outside this planning/testing turn, only after staged thresholds/review and separately concrete launch decision.

## Per-task verification map

Exact commands, all .test.ts/.test.tsx/.spec.ts paths, Playwright/TypeScript configurations, current existence and owning task/dependency are recorded in 02-VALIDATION-MAP.json. Abbreviations below expand to:

- B: <BACKEND_CHECKOUT>
- F: <FRONTEND_CHECKOUT>

All rows are planned and unexecuted. Missing tests require meaningful RED in the owning task or an explicit earlier dependency. Threat references identify the owning plan register. External-input/human checkpoint validators do not substitute for actual manual evidence. Configurations are counted explicitly as owned scaffold work.

| Task | Wave | Requirements | Threat refs | Type | Automated command | Current test/config/command files | Status |
|---|---|---|---|---|---|---|---|
| 02-01-1 | 1 | STAGE-02, PILOT-02 | T-02-01-01, T-02-01-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/stage-attestation-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-01-2 | 1 | STAGE-02, PILOT-02 | T-02-01-01, T-02-01-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/environment.test.ts tests/agent-booking/stage-attestation-unit.test.ts` | 2 existing / 1 Wave0/dependency | pending |
| 02-02-1 | 2 | STAGE-02, PILOT-02 | T-02-02-01, T-02-02-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/managed-jwks-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-02-2 | 2 | STAGE-02, PILOT-02 | T-02-02-01, T-02-02-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/managed-jwks-unit.test.ts tests/agent-booking/failures.test.ts && npx --no-install tsc -p tsconfig.external-api.json` | 3 existing / 1 Wave0/dependency | pending |
| 02-03-1 | 2 | PAYREC-02, SCHEMA-02 | T-02-03-01, T-02-03-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-reconciliation-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-03-2 | 2 | PAYREC-02, SCHEMA-02 | T-02-03-01, T-02-03-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-reconciliation-unit.test.ts && node scripts/agent-booking/run-reconciliation-sql.mjs --fresh --run-root .agent-labs/reconciliation` | 1 existing / 2 Wave0/dependency | pending |
| 02-04-0 | 3 | PAYREC-02, OPS-02 | T-02-04-01, T-02-04-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-reconciliation-worker-unit.test.ts && node scripts/agent-booking/check-edge.mjs --bootstrap --profile=scheduler` | 1 existing / 2 Wave0/dependency | pending |
| 02-04-1 | 3 | PAYREC-02, OPS-02 | T-02-04-01, T-02-04-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-reconciliation-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-04-2 | 3 | PAYREC-02, OPS-02 | T-02-04-01, T-02-04-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-reconciliation-worker-unit.test.ts tests/agent-booking/checkout-expiry-unit.test.ts && node scripts/agent-booking/check-edge.mjs --profile=reconciliation && npx --no-install tsc -p tsconfig.external-api.json` | 3 existing / 2 Wave0/dependency | pending |
| 02-05-1 | 4 | PAYREC-02, OPS-02 | T-02-05-01, T-02-05-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/payment-operations-unit.test.ts && node scripts/agent-booking/check-edge.mjs --profile=operations` | 1 existing / 2 Wave0/dependency | pending |
| 02-05-2 | 4 | PAYREC-02, OPS-02 | T-02-05-01, T-02-05-02 | auto | `cd 'B' && npx --no-install vitest run src/pages/PaymentCases.test.tsx && npx --no-install tsc -p tsconfig.app.json` | 1 existing / 1 Wave0/dependency | pending |
| 02-06-1 | 1 | DISC-02, TENANT-02 | T-02-06-01, T-02-06-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/discovery.test.ts domain/booking/seo.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-06-2 | 1 | DISC-02, TENANT-02 | T-02-06-01, T-02-06-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/discovery.test.ts domain/booking/marketplaceService.test.ts domain/booking/provenance.test.ts` | 2 existing / 1 Wave0/dependency | pending |
| 02-07-1 | 2 | DISC-02, TENANT-02, SCHEMA-02 | T-02-07-01, T-02-07-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/public-discovery-source-unit.test.ts && cd 'F' && npx --no-install vitest run domain/booking/discovery.test.ts domain/booking/marketplaceService.test.ts` | 2 existing / 2 Wave0/dependency | pending |
| 02-08-1 | 4 | SCHEMA-02, DISC-02, TENANT-02 | T-02-08-01, T-02-08-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/structuredData.test.ts domain/booking/discovery.test.ts && npx --no-install tsc --noEmit` | 0 existing / 2 Wave0/dependency | pending |
| 02-08-2 | 4 | SCHEMA-02, DISC-02, TENANT-02 | T-02-08-01, T-02-08-02 | auto | `cd 'F' && npx --no-install playwright test --config=playwright.agent-discovery.config.ts` | 0 existing / 3 Wave0/dependency | pending |
| 02-09-1 | 3 | DOCS-02, AGENT-02, DISC-02 | T-02-09-01, T-02-09-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/discovery-docs-unit.test.ts && node scripts/agent-booking/generate-discovery.mjs --check --frontend-root 'F'` | 1 existing / 2 Wave0/dependency | pending |
| 02-10-1 | 8 | STAGE-02, OPS-02, AGENT-02 | T-02-10-01, T-02-10-02 | checkpoint:decision | `test -s '<HANDOFF_ROOT>/OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md' && test -s '<HANDOFF_ROOT>/testing/2026-10-08/staging-resource-candidates.json'` | 1 existing / 0 Wave0/dependency | pending |
| 02-11-1 | 9 | STAGE-02, PILOT-02 | T-02-11-01, T-02-11-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/stage-provision-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-11-2 | 9 | STAGE-02, PILOT-02 | T-02-11-01, T-02-11-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/fixtures.test.ts tests/agent-booking/environment.test.ts tests/agent-booking/stage-provision-unit.test.ts` | 3 existing / 1 Wave0/dependency | pending |
| 02-11-3 | 9 | STAGE-02, PILOT-02 | T-02-11-01, T-02-11-02 | auto | `cd 'B' && node scripts/agent-booking/provision-staging.mjs --verify --selection "$AGENT_STAGING_SELECTION"` | 0 existing / 1 Wave0/dependency | pending |
| 02-12-1 | 10 | STAGE-02, SCHEMA-02, PILOT-02 | T-02-12-01, T-02-12-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/schema-bundle-unit.test.ts && node scripts/agent-booking/prepare-staging-schema.mjs --check` | 1 existing / 2 Wave0/dependency | pending |
| 02-12-2 | 10 | STAGE-02, SCHEMA-02, PILOT-02 | T-02-12-01, T-02-12-02 | auto | `cd 'B' && node scripts/agent-booking/apply-staging-schema.mjs --verify --config "$AGENT_STAGING_CONFIG" --bundle supabase/staging/phase02-bundle.json && node scripts/agent-booking/deploy-staging.mjs --verify --config "$AGENT_STAGING_CONFIG"` | 0 existing / 3 Wave0/dependency | pending |
| 02-12-3 | 10 | STAGE-02, SCHEMA-02, PILOT-02 | T-02-12-01, T-02-12-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs staging tests/agent-booking/managed-schema.test.ts` | 1 existing / 2 Wave0/dependency | pending |
| 02-13-1 | 11 | STAGE-02, PAYREC-02, PILOT-02, OPS-02 | T-02-13-01, T-02-13-02, T-02-13-03 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs staging tests/agent-booking/managed-auth.test.ts tests/agent-booking/handoff-continuity.test.ts` | 1 existing / 2 Wave0/dependency | pending |
| 02-13-2 | 11 | STAGE-02, PAYREC-02, PILOT-02, OPS-02 | T-02-13-01, T-02-13-02, T-02-13-03 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs staging tests/agent-booking/managed-providers.test.ts tests/agent-booking/payment-reconciliation.test.ts` | 1 existing / 2 Wave0/dependency | pending |
| 02-13-3 | 11 | STAGE-02, PAYREC-02, PILOT-02, OPS-02 | T-02-13-01, T-02-13-02, T-02-13-03 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs staging tests/agent-booking/managed-rollback.test.ts tests/agent-booking/handoff-resolver.test.ts tests/agent-booking/rollback.test.ts` | 1 existing / 3 Wave0/dependency | pending |
| 02-14-1 | 12 | PILOT-02, AGENT-02, STAGE-02 | T-02-14-01, T-02-14-02, T-02-14-03 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/pilot-runner-unit.test.ts` | 1 existing / 2 Wave0/dependency | pending |
| 02-14-2 | 12 | PILOT-02, AGENT-02, STAGE-02 | T-02-14-01, T-02-14-02, T-02-14-03 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/pilot-runner-unit.test.ts && node scripts/agent-booking/run-pilot.mjs --project=synthetic` | 1 existing / 3 Wave0/dependency | pending |
| 02-15-1 | 14 | OPS-02, AGENT-02 | T-02-15-01, T-02-15-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/pilot-operations-unit.test.ts` | 1 existing / 1 Wave0/dependency | pending |
| 02-15-2 | 14 | OPS-02, AGENT-02 | T-02-15-01, T-02-15-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/agent-pilot-unit.test.ts tests/agent-booking/pilot-operations-unit.test.ts` | 1 existing / 2 Wave0/dependency | pending |
| 02-16-1 | 15 | AGENT-02, OPS-02, PILOT-02 | T-02-16-01, T-02-16-02 | checkpoint:human-verify | `cd 'B' && node scripts/agent-booking/validate-agent-pilot.mjs --evidence "$AGENT_REAL_CLIENT_EVIDENCE" && node scripts/agent-booking/validate-pilot-operations.mjs --evidence "$AGENT_OPERATIONS_EVIDENCE" && node scripts/agent-booking/validate-phase-feedback.mjs --file docs/external-booking/phase02-feedback.json --ingest "$AGENT_REAL_CLIENT_EVIDENCE"` | 0 existing / 4 Wave0/dependency | pending |
| 02-17-1 | 6 | EVOL-02, DISC-02, DOCS-02, OPS-02 | T-02-17-01, T-02-17-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/dependency-preflight-unit.test.ts tests/agent-booking/handoff-source-unit.test.ts && node scripts/agent-booking/generate-discovery.mjs --check --frontend-root 'F' && cd 'F' && npx --no-install vitest run domain/booking/frameworkDependencies.test.ts` | 3 existing / 2 Wave0/dependency | pending |
| 02-17-2 | 6 | EVOL-02, DISC-02, DOCS-02, OPS-02 | T-02-17-01, T-02-17-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/discovery-measurement-unit.test.ts && node scripts/agent-booking/run-tests.mjs contract tests/agent-booking/release-gates.test.ts` | 2 existing / 1 Wave0/dependency | pending |
| 02-18-1 | 16 | OPS-02, AGENT-02, PILOT-02, EVOL-02 | T-02-18-01, T-02-18-02 | checkpoint:human-verify | `cd 'B' && node scripts/agent-booking/release-gates.mjs --evidence "$AGENT_PILOT_EVIDENCE" --source-fingerprint "$AGENT_SOURCE_FINGERPRINT" && node scripts/agent-booking/validate-agent-pilot.mjs --evidence "$AGENT_REAL_CLIENT_EVIDENCE" && node scripts/agent-booking/validate-pilot-operations.mjs --evidence "$AGENT_OPERATIONS_EVIDENCE" && node scripts/agent-booking/validate-phase-feedback.mjs --file docs/external-booking/phase02-feedback.json` | 1 existing / 4 Wave0/dependency | pending |
| 02-19-1 | 3 | DISC-02, TENANT-02, SCHEMA-02 | T-02-19-01, T-02-19-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/discovery.test.ts domain/booking/seo.test.ts && npx --no-install tsc --noEmit` | 1 existing / 1 Wave0/dependency | pending |
| 02-19-2 | 3 | DISC-02, TENANT-02, SCHEMA-02 | T-02-19-01, T-02-19-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/discovery.test.ts domain/booking/seo.test.ts && npx --no-install tsc --noEmit` | 1 existing / 1 Wave0/dependency | pending |
| 02-20-1 | 5 | DOCS-02, AGENT-02, DISC-02 | T-02-20-01, T-02-20-02 | auto | `cd 'F' && npx --no-install vitest run domain/booking/discoveryArtifacts.test.ts domain/booking/discovery.test.ts && npx --no-install tsc --noEmit` | 0 existing / 2 Wave0/dependency | pending |
| 02-20-2 | 5 | DOCS-02, AGENT-02, DISC-02 | T-02-20-01, T-02-20-02 | auto | `cd 'F' && npx --no-install playwright test --config=playwright.agent-discovery.config.ts && cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/discovery-docs-unit.test.ts` | 1 existing / 3 Wave0/dependency | pending |
| 02-21-1 | 13 | PILOT-02, AGENT-02, STAGE-02 | T-02-21-01, T-02-21-02, T-02-21-03 | auto | `cd 'B' && node scripts/agent-booking/run-pilot.mjs --project=synthetic && node scripts/agent-booking/generate-discovery.mjs --frontend-root 'F' && node scripts/agent-booking/generate-discovery.mjs --check --frontend-root 'F' && node scripts/agent-booking/deploy-staging.mjs --refresh-public-docs --config "$AGENT_STAGING_CONFIG" && node scripts/agent-booking/run-tests.mjs contract tests/agent-booking/docs.test.ts` | 2 existing / 3 Wave0/dependency | pending |
| 02-22-1 | 7 | EVOL-02, OPS-02, AGENT-02 | T-02-22-01, T-02-22-02 | auto | `cd 'B' && node scripts/agent-booking/run-tests.mjs unit tests/agent-booking/phase-feedback-unit.test.ts && node scripts/agent-booking/validate-phase-feedback.mjs --file docs/external-booking/phase02-feedback.json` | 1 existing / 3 Wave0/dependency | pending |

No phase02 acceptance or Wave0 completion is claimed. Each PLAN.md supplies full behaviors, paths and manual instructions. The JSON map gives exact owner task IDs for every missing reference.

## Sign-off

Independent static plan checking PASSED on2026-10-08 (iteration3):22 plans,41 tasks,16 waves, all10 requirements, every task automated feedback, exact new test/config ownership, no same-wave ownership conflict. See02-PLAN-CHECK.md and02-VALIDATION-MAP.json. Research questions have resolved planning dispositions; genuine account/client/staffing inputs remain gated.

nyquist_compliant:false and wave_0_complete:false remain honest execution flags until the meaningful owned scaffolds/tests/evidence exist. No new phase02 code, managed confirmation or real-agent E2E has executed. Today's local/public results remain separately dated. No Phase01 requirement is auto-completed, and SUMMARY presence alone is not full acceptance.
