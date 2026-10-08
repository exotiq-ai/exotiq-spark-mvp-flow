# Roadmap

## Phases
- [ ] **Phase 1: API docs MCP foundation** — Complete shared external booking interface, safety foundation, documentation, renter MCP and synthetic pilot rollout.
- [ ] **Phase 2: Agent discovery and isolated demo-fleet pilot** — Safe full-journey rehearsal, payment resolution, agent discovery and measured real-agent trials.

## Phase Details
### Phase 1: API docs MCP foundation
**Goal:** Deliver the complete safe API/docs/MCP foundation for a consent-bound rental request journey through operator approval and hosted checkout to verified confirmation.
**Depends on:** Nothing
**Requirements**: CAP-01, API-01, AUTH-01, VIS-01, QUOTE-01, SAFE-01, FAIL-01, PAY-01, DOC-01, TEST-01, MCP-01, OPS-01, ISO-01
**Success Criteria**:
1. Tenant-visible search/availability and consent-bound quote/request API is documented and authorized.
2. Retry/concurrency/unknown-state failures are safe and covered by staging acceptance tests.
3. Thin OAuth MCP shares backend rules and passes an end-to-end synthetic pilot including approval, separate charges, hosted checkout and confirmation.
4. Isolation, ownership, rollout/rollback and deployment parity gates are explicit.
**Plans:** 15/16 locally delivered; plan12 partial; 0/16 full acceptance

Plan checkmarks mean local implementation delivery, not hosted/provider acceptance.

Plans:
- [x] 01-01-PLAN.md — Isolation, capability audit and executable test harness
- [x] 01-02-PLAN.md — Canonical versioned API schemas and state contract
- [x] 01-03-PLAN.md — Delegated OAuth, per-booking grants and consent authority
- [x] 01-04-PLAN.md — Immutable quote snapshots and consent-bound terms
- [x] 01-05-PLAN.md — Shared inventory serialization and deterministic buffer policy
- [x] 01-06-PLAN.md — Transactional request creation, distributed retries and outbox
- [x] 01-07-PLAN.md — Catalog, tri-state availability and quote API routes
- [x] 01-08-PLAN.md — Hosted customer consent, receipt rendezvous and grant recovery
- [x] 01-09-PLAN.md — Rental-request status and guarded hosted payment handoff
- [x] 01-10-PLAN.md — Stable renter MCP adapter and two-client compatibility
- [x] 01-11-PLAN.md — Generated OpenAPI, readable guide and compatibility evidence
- [ ] 01-12-PLAN.md — Synthetic Miami/Tampa journey, metrics and guarded rollout
- [x] 01-13-PLAN.md — Actual frontend calendar, quote and request UNKNOWN guards
- [x] 01-14-PLAN.md — Owned opaque customer identity and checkout handoff resolver
- [x] 01-15-PLAN.md — Persisted rollout flags, redacted events and real API/MCP consumers
- [x] 01-16-PLAN.md — Frontend authority DTOs, adapters and booking facade

## Progress
| Phase | Plans Complete | Status |
|---|---|---|
| 1 | 15/16 local; 0/16 full acceptance | Local handoff; goal verification gaps_found; hosted pilot/code/operating gates remain |
| 2 | 0/22 executed acceptance | 22 plans / 41 tasks / 16 waves; independent plan check passed; execution pending |

## Local handoff and acceptance gaps

See ../BUILD-STATUS.md and phases/01-api-docs-mcp-foundation/01-VERIFICATION.md. Plan12 has actual guarded partial-schema composition, but its hosted pilot driver/configuration and complete provider-confirmed acceptance remain undelivered. Uncertain checkout inventory is retained safely; authoritative cleanup/safe clearance and legacy session drain remain operating gates. Full deployed schema/privileges/provider/gateway/scheduler parity is unproved. No phase or requirement is marked fully complete.

### Phase 2: Agent discovery and isolated demo-fleet pilot

**Goal:** Deliver an isolated demo-fleet booking pilot and truthful, measurable agent discovery for Exotiq and eligible tenant slugs, closing provider/payment/deployment acceptance gaps before any live exposure.
**Requirements**: STAGE-02, PAYREC-02, PILOT-02, DISC-02, TENANT-02, SCHEMA-02, DOCS-02, AGENT-02, OPS-02, EVOL-02
**Depends on:** Phase1 locally integrated artifacts; closes its acceptance gaps. Phase1 full acceptance remains pending.
**Success Criteria**:
1. Separate synthetic staging is attested and actually tested, with complete applied authority/schema/provider/gateway/job proof.
2. Provider-authoritative payment resolution preserves paid/ambiguous holds and safely closes provably unpaid cases under concurrency.
3. Public marketplace/eligible tenant pages have truthful crawl/host/canonical/schema/docs behavior while private and synthetic staging surfaces remain protected.
4. Actual four confirmed API/MCP journeys and documented adverse/recovery/rollback tests pass; Dot/another named agent evidence clearly distinguishes cold discovery, guided URL and authenticated actions.
5. A staffed pilot, measured discovery/transaction/latency thresholds, pause/resume procedure and versioned evidence checks support a reviewed small launch.
**Plans:** 22 plans / 41 tasks / 16 waves; independent plan check passed; execution pending; 0/22 executed acceptance

Plans (execution follows dependency waves):
- [ ] [02-01-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-01-PLAN.md) — Wave 1: Attested environment contracts and exact test discovery
- [ ] [02-06-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-06-PLAN.md) — Wave 1: Source-backed public eligibility and canonical host policy
- [ ] [02-02-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-02-PLAN.md) — Wave 2: Bound shared managed JWKS transport
- [ ] [02-03-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-03-PLAN.md) — Wave 2: Audited payment-resolution ledger and atomic safe clearance
- [ ] [02-07-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-07-PLAN.md) — Wave 2: Authoritative public discovery metadata projection
- [ ] [02-04-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-04-PLAN.md) — Wave 3: Provider-authoritative reconciliation worker
- [ ] [02-09-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-09-PLAN.md) — Wave 3: Generate public connection artifacts from canonical contracts
- [ ] [02-19-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-19-PLAN.md) — Wave 3: Wire source-backed marketplace routes and crawler policy
- [ ] [02-05-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-05-PLAN.md) — Wave 4: Private operator payment-case resolver
- [ ] [02-08-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-08-PLAN.md) — Wave 4: Truthful escaped JSON-LD and actual browser discovery
- [ ] [02-20-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-20-PLAN.md) — Wave 5: Serve public agent guides and prove HTTP/OAuth discovery
- [ ] [02-17-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-17-PLAN.md) — Wave 6: Reproducible dependency, public discovery and release checks
- [ ] [02-22-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-22-PLAN.md) — Wave 7: Validated next-phase feedback and maintenance ownership
- [ ] [02-10-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-10-PLAN.md) — Wave 8: Select external accounts, resource budget and human owners
- [ ] [02-11-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-11-PLAN.md) — Wave 9: Provision selected isolated staging and synthetic cohort
- [ ] [02-12-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-12-PLAN.md) — Wave 10: Review and apply complete staging database and runtime
- [ ] [02-13-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-13-PLAN.md) — Wave 11: Genuine managed auth, provider, reconciliation and rollback acceptance
- [ ] [02-14-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-14-PLAN.md) — Wave 12: Implement guarded actual Playwright API/MCP pilot driver
- [ ] [02-21-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-21-PLAN.md) — Wave 13: Execute provider-confirmed pilot and publish actual receipts
- [ ] [02-15-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-15-PLAN.md) — Wave 14: Watched operations runbook and named-agent evidence harness
- [ ] [02-16-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-16-PLAN.md) — Wave 15: Human-controlled Dot or another real-agent rehearsal
- [ ] [02-18-PLAN.md](<HANDOFF_ROOT>/.planning/phases/02-agent-discovery-and-isolated-demo-fleet-pilot/02-18-PLAN.md) — Wave 16: Review readiness for a small watched pilot
