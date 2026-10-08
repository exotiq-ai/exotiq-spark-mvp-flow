# Phase02: Agent discovery and isolated demo-fleet pilot — Research

**Researched:** 2026-10-08, America/Denver  
**Domain:** Public agent discovery, authenticated API/MCP, synthetic full-provider rental pilot, authoritative payment reconciliation  
**Confidence:** HIGH for inspected code and primary standards; MEDIUM for unperformed hosted/client acceptance.  
**Evidence vocabulary:** `[VERIFIED: ...]` means inspected source, tool result or dated local evidence in this session. `[CITED: URL]` identifies primary documentation. `[RECOMMENDATION]` identifies a proposed design, not an existing capability or a locked business policy. No unverified product capability is asserted.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Root is technical lead; appoint a subagent as operations lead for booking/payment problems. Operations findings and test results must feed this phase's plans, runbooks, requirements and validation.
- User nominates https://book.exotiq.rent/exotiq, the Exotic Demo Fleet tenant, as the pilot cohort. This explicitly supersedes its former exclusion FOR an isolated staging cohort only. It does not authorize exposing fake inventory to general search, enabling live checkout, copying production identities/data or weakening source market predicates. Use an explicitly synthetic isolated counterpart with new resource/tenant/user/vehicle/booking IDs. Public page GETs are allowed; booking/payment/identity writes must target proven staging only. EarlierMiami/Tampa paid-provider acceptance gates remain: explain how the demo-only testcohort and laterverifiedrealmarkets differ rather than silently removing those gates or claiming Scottsdale coverage.
- Set up separate practice backend, test payment accounts for both payment legs, identity and sign-in sandboxes, isolatedemail/webhooks/jobs/gateway. Missing org/account labels, budget and access are real external prerequisites; ask names/labels not secrets. No paid resource creation without an explicit budget/organization selection. User has not yet supplied those; no current environment credentials by relevant env-variable name scan.
- Finish missing guarded Playwright pilot driver/config/runner and hosted suites, plus authoritative uncertain-payment reconciliation/clearance. Current invariant safely keeps inventory for uncertain issued checkout; finish resolution without timer-based release, duplicate charge, fake provider truth or sharedwriter bypass. Current managed APIJWKS needs bounded response/profile; preserve shared rotation/cache and cancellation.
- Exercise the complete journey: discover fleet -> source-authoritative quote -> human authorization -> operator-only approval -> currentownedverifiedidentity -> requiredoperator/Exotiq payments -> confirmed. Include repeats/disconnects, UNKNOWN, grant expiry/revocation/25h71h recovery, delayed/lost/out-of-orderevents, close-deadlinecheckout, uncertain resolution, privatecustomerdata/tenantisolation, global/peroperatorpause and existingcustomercontinuity.
- Main business goal: exotiq.rent and eligible tenant slugs be found and used by agentic workers for luxury/exotic marketplace booking and service. Aim to establish authority early with truthful publiccontent, crawlability, hostownership/canonicalmapping, accurate structured data and machine-readable safe contracts. No guaranteed ranking, every-agent compatibility or 'future-proof' certification.
- Research robots.txt, sitemap, canonical/meta/SSR/schema markup, llms.txt/agent files and current MCP/OAuth discovery. Distinguish adopted standards from proposals/optionalfiles; robots cannot protect private routes. Preserve auth/noindex/privatecache for consent/nonces/booking/customer/OAuth URLs, stage+demoindexseparation and tenantvisibility/opt-in. Never advertiseprices/availability/reviews/services unsupportedby source or fulfillability. No SearchAction/ReserveAction side effects absentconsent/approval; no publicnonce/receipt/providercredential URLs in sitemaps/docs/files.
- Include manual black-box Dot/another realagent E2E after automated checks, with explicit scope, repeatable prompt, actualobservedhostedjourneyreceipt evidence and human approvals. Clarify productURL for Dot/dots; don't equate DotBotSEO crawlerwithDotagent. Dots, Muse, Claude, Hermes, OpenClaw, Instinct, Hark are user-named desiredtargets, not verifiedsupportedclients. Build evidence matrix for product/version/discovery/HTTPbrowser/MCP/OAuth/originalclient exchange/humanconsent/state/results. Separate coldweb discovery from guidedURL/manualMCP connection; no seededURLsuccess counted as organicdiscovery. No tools contacting agents/people until explicit destinationauthorization.
- Production rollout only after implementation/review/staging/provider gates; small opt-in cohort, staffedmonitoring, documentedpause/resume/rollback criteria. Do not enable production during this planning/testing turn. Never remove prior verifiedinvoice/pricing/safety invariants for marketing convenience.
- Today's output: actual dated test/evidence report, research, executable wave/dependency plans with per-taskread_first and acceptancecriteria, threatmodels, realvalidation coverage/gates, operationsrunbook and manualagenttestinstructions. Skipped/blockedstagedproviderjourneys explicitlycount unexecuted, notpass. Keep current reports/history insteadof rewriting pastworkasaccepted.


### Codex's Discretion

Use maintainable source-generated public discovery/schema artifacts and versioned change checks. Decide exact architecture/fileallocation from source/research. Normalize phase02 and timestamp unique migration allocations; no blind historicalmigrationpush. Account/org/budget selection andDotproductidentity questions are pending; plans must name conditionaloperational actions/checkpoints rather thanassume accounts. Publicstagingnoindex; optionallyrestricted authenticatedagentpilotstage supports intentionaltestURLs without claimingorganicsearchindexing. Set noauto_advance/auto_chain flags; preservecommit_docs=false.


### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md contains no separate Deferred Ideas section. Its locked decisions explicitly prohibit production activation in this planning/testing turn and unproven public synthetic offers. Preserve those boundaries. [VERIFIED: 02-CONTEXT.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|---|---|---|
| STAGE-02 | Separate attested synthetic backend/OAuth/identity/bothpaymentaccounts/email/jobs/gateway; noproductionfallback or resourcecreation beyondselectedbudget. | Exact resource/account/mode/schema/job/manifest attestation before writes; candidate resource is not accepted staging. [VERIFIED:requirements; guard-environment.mjs] |
| PAYREC-02 | Provider-authoritative uncertainpaymentresolution and auditedsafeinventoryclearance; preservepaid/ambiguousholds, currentauthority, originalkeys andbothlegtruth. | Leased provider reconciliation and atomic audited terminal clearance; uncertain/partial/stale truth retains occupancy. [VERIFIED:requirements;090730; operations assessment] |
| PILOT-02 | ExecutableguardedPlaywright/API/MCP fourconfirmedjourneys plusadverse/recovery/rollbackchecks; nominateddemo fleet onlyasexplicitstagingcohort. | Missing driver/config and Vitest dispatch mismatch; required actual confirmed journeys and distinct inherited market coverage. [VERIFIED:requirements;01verification;run-tests.mjs] |
| DISC-02 | Correctlivehostcanonical/redirect/robots/sitemap/SSRprivateindexing policy withdatedread-onlypubliccrawl evidence andcrawler-class distinctions. | Actual redirect/demo-sitemap/noJSONLD findings, host/crawler/private header tests. [VERIFIED:requirements;publicaudit] |
| TENANT-02 | Accuratepubliceligibletenant/vehicle content, opt-in/demorules, geography/stock/price/terms provenance andstablecanonicalslugs. | Shared public eligibility/indexability, source data/geography/terms and stable slug/canonical policy. [VERIFIED:requirements;Fsource] |
| SCHEMA-02 | Truthfulstructureddataforactualmarketplace/operators/vehicles/services;validatedJSON-LD with stableIDs/nofakeoffers/actions andcompleteapplieddatabaseparitybeforeproviderpilot. | Escaped SSR Organization/AutoRental/rental vehicle graph, private actual reservations and independently tested deployed schema. [VERIFIED:requirements; CITED:Schema.org primarytypes] |
| DOCS-02 | MaintainablegeneratedpublicAPI/MCPdiscoveryandhuman/agentguides;optionalllms/agentfileslabeledproposals, noauthority/secretleaks. | Owned-origin source-generated guide/OpenAPI/MCP and optional llms.txtv2 links; no public authority/credentials. [VERIFIED:requirements;contracts; CITED:https://llmstxt.org/] |
| AGENT-02 | Measuredcold-discoveryvsdirect-URLvsMCP clientmatrix andhuman-authorizedblackboxDot/anotheragentE2E; unknownproductsclearlyunverified. | Separate trials, real product/version/permission matrix and human browser takeover; interoperability unperformed. [VERIFIED:requirements; CITED:officialdots/Claude docs] |
| OPS-02 | Assignedoperationsowner, manualpaymentexceptionrunbook, measuredthresholds,pause/resume,ownedcontinuity,smallopt-incohorthandoff. | Human owner/backup, retained payment cases, queue monitoring, pause/resume with owned continuity. [VERIFIED:requirements;operations assessment] |
| EVOL-02 | Versionedcontract/content/source-provenancechecks,dependency/protocolmonitoringownershipandtestfindingfeedback; nofirst-rank/futureproofguarantee. | Versioned source/contract/content/client evidence and maintenance; measurable discovery without ranking promise. [VERIFIED:requirements; RECOMMENDATION] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

No AGENTS.md exists at the current <LOCAL_HOME> working directory or either isolated backend/frontend root; neither repository has .Codex/skills or .agents/skills project directories. This was checked directly. Existing home skill catalogs are not repository instructions. The phase config sets commit_docs=false, nyquist_validation=true, security_enforcement=true and both automatic advance/chain flags false. Do not commit this research, advance the phase, or check full acceptance from local success. [VERIFIED:filesystem probes; .planning/config.json]

## Summary

The immediate discovery problem is substantive: the live exotiq.rent origin redirects to book.exotiq.rent, whose root redirects to the Exotic Demo Fleet. The current public sitemap includes that demo tenant and 52 vehicle URLs, and sampled tenant/vehicle pages have no JSON-LD or noindex. Optional discovery files and conventional API/MCP probes returned HTML404. These results concern exactly probed public hosts, not an unknown API host, real search indexing, or actual agent compatibility. The backend public/robots.txt, llms.txt and sitemap.xml describe exotiq.ai fleet-management SaaS; copying them would advertise the wrong product and host. [VERIFIED:testing/2026-10-08/public-discovery-evidence.json; B/public files]

The local foundation is already implemented and guarded, but full hosted acceptance is absent. The Phase01 verifier identifies a missing hosted pilot driver/config, selected-schema-only SQL evidence, conservative indefinite uncertain-payment holds, and no explicit API JWKS byte/key ceiling. Provider truth and deployment parity must close those gaps before live admission. The nominated demo fleet must become a distinctly marked synthetic staging counterpart with new IDs; its live URL is a reference for the cohort, not a sandbox attestation. [VERIFIED:01-VERIFICATION.md; 02-CONTEXT.md; operations assessment]

**Primary recommendation:** Run parallel workstreams for truthful public discovery and safe staging/reconciliation, then join them in a guarded browser/API/MCP pilot. Keep synthetic staging outside general indexing, let humans perform identity/payment steps, and report cold discovery separately from seeded-URL task success. [RECOMMENDATION consistent with CONTEXT.md]

## Standard Stack

### Core — retain existing reviewed pins

| Library/tool | Existing pin; registry publication UTC | Current registry version on2026-10-08 | Purpose / decision |
|---|---|---|---|
| Next.js |15.5.27;2026-09-30T16:19:50Z|16.4.0|Existing SSR/metadata/route host. Retain phase pin; do not add a framework-major migration. [VERIFIED:F/package.json; npm registry] |
| @playwright/test |1.63.0;2026-09-04T22:44:00Z|1.64.0|Existing actual browser tests; use same reviewed runner for new pilot. [VERIFIED:F/package.json; npm registry] |
| @modelcontextprotocol/server |2.3.1;2026-10-05T11:52:39Z|2.3.1|Existing thin remote MCP. [VERIFIED:B/packages/renter-mcp/package.json; npm registry] |
| @modelcontextprotocol/client |2.3.1;2026-10-05T11:50:23Z|2.3.1|Two SDK profiles and hosted transport tests. [VERIFIED:same package; npm registry] |
| jose |6.2.3;2026-04-27T15:23:35Z|6.2.12|JWT/JWKS and customFetch cap. Evaluate targeted maintained patch separately with regression/security review. [VERIFIED:package; installed remote.d.ts; npm registry] |
| zod |4.6.5;2026-09-13T23:25:14Z|4.6.5|Existing MCP schemas, canonical validators remain authoritative. [VERIFIED:package; npm registry] |
| Vitest |MCP4.1.11;2026-08-18T14:27:07Z|5.0.3|Existing unit/contract runner; retain pinned4.x and avoid unrelated major upgrade. Frontend manifest still allows4.1.6 and needs a targeted advisory review. [VERIFIED:B/F packages; npm registry; B/docs/external-booking/mcp-compatibility.md] |

Publication dates above are the version's own registry timestamps, not package time.modified. No package was installed or upgraded for research. Use npm ci in the existing isolated roots/package; missing pilot framework ownership belongs to the plan. [VERIFIED:npm view time/version; research actions]

### Supporting

| Component | Version/authority | Use |
|---|---|---|
| Supabase CLI |2.90.0 installed|Read-only inventory and reviewed clean migrations; never blindly push historical migrations. [VERIFIED:CLI probe; CONTEXT.md] |
| Node |22.22.3 installed|Existing Node ingress, test orchestration and scripts. [VERIFIED:node --version] |
| Docker |28.3.2 installed|Existing owner-guarded PostgreSQL lab; full hosted PostgREST/provider parity is separate. [VERIFIED:docker --version; Phase01 verification] |
| Stripe SDK/API |Existing source SDK and independently pinned account API versions|Reuse checkout/webhook authority; record exact sandbox account/mode/version before provider assertions. [VERIFIED:rent-checkout/rent-payment-webhook source; CITED:https://docs.stripe.com/webhooks] |
| Schema.org JSON-LD |Reviewed vocabulary subset, no extra runtime library required|Generate from source DTOs in server components; sanitize before embedding. [CITED:https://nextjs.org/docs/app/guides/json-ld; RECOMMENDATION] |

### Alternatives Considered

| Instead of | Alternative | Recommendation |
|---|---|---|
| Explicit separate staging project |Supabase branch|Branches are data-less by default, but merging invokes deployment. Use only after ownership, budget, egress and lifecycle review; never treat a branch merge as an innocent test reset. [CITED:https://supabase.com/docs/guides/deployment/branching] |
| Conventional SSR/robots/sitemaps plus remote MCP |Optional llms.txt/WebMCP|Add maintainable llms.txt; WebMCP is a progressive enhancement after core acceptance, not a universal discovery requirement. [CITED:https://llmstxt.org/; https://learn.chatgpt.com/docs/webmcp] |
| Full shared backend policy |Separate demo-only rewritten booking path|Use explicitly synthetic eligibility in attested staging while preserving pricing, identity, grant and inventory invariants. [RECOMMENDATION; VERIFIED:CONTEXT.md] |

## Architecture Patterns

### Recommended allocation

Paths prefixed B are backend-worktree; F are frontend-worktree under work/exotiq-agent-build. Proposed files are task ownership suggestions, not delivered artifacts. [VERIFIED:current root paths; RECOMMENDATION]

```text
F/domain/booking/discovery.ts           # one public eligibility/host/indexability policy
F/domain/booking/structuredData.ts      # pure source DTO → JSON-LD graph
F/app/agents/page.tsx                   # readable capability and human approval guide
F/app/llms.txt/route.ts                 # generated concise public guide links
F/app/agents.md/route.ts                # optional public website-use instructions, clearly scoped
F/app/[operatorSlug]/llms.txt/route.ts   # optional eligible tenant projection
B/scripts/agent-booking/run-pilot.mjs    # guarded Playwright dispatch, not Vitest
B/playwright.agent.config.ts            # fixed allowlisted pilot project/config
B/tests/agent-booking/pilot.spec.ts      # actual frontend+API/MCP+provider journey
B/tests/agent-booking/fixtures/          # manifest/run/account-bound evidence helpers
B/supabase/functions/_shared/external-booking/payment-reconciliation.ts
B/supabase/functions/external-payment-reconciler/index.ts
B/supabase/migrations/<allocated>_checkout_resolution.sql
B/docs/external-booking/agent-pilot.md
```

### Pattern1: Separate host identity, data mode, public eligibility and indexing

getDataMode() currently selects mock/supabase; robotsPolicy permits all live-data pages except four private path patterns. A live-data synthetic tenant is consequently indexable, as observed. siteUrl() trusts configured NEXT_PUBLIC_SITE_URL or Netlify URL and falls back to localhost; the default sitemap uses a default storefront without a synthetic-index exclusion. marketplace mode forbids tenant/detail routes, so sitemap generation must explicitly match routable host modes rather than assume every source slug is served on every host. [VERIFIED:F/domain/booking/config.ts, seo.ts; F/app/sitemap.ts; tenant/detail generateMetadata; public audit]

Use a reviewed production host map with separate marketplaceOrigin, bookingOrigin, resourceOrigin and stagingOrigin. Explicitly validate HTTPS bare origins and reject localhost/provider/wrong-host canonicals in production. Do not infer origin from untrusted request Host/X-Forwarded-Host. Each distinct public page has a self-canonical on its actual serving host; redirects and genuinely duplicate page canonicals agree. Use only actual routable indexable public URLs in each host's sitemap and guides. Slug rename needs a reviewed redirect mapping and invalidation, not silently changing existing canonical IDs. [RECOMMENDATION grounded in source; CITED:https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls]

For the demo, keep authenticated/noindex staging URLs usable for intentional agent browser tests; omit synthetic inventory from production sitemaps, schema offers, marketplace public catalog and machine-readable guides. If public demo examples remain, label them as nonbookable demonstrations, add noindex and avoid truthful-looking real availability/price claims. Blanket robots disallow alone cannot guarantee deindexing or privacy; existing indexed URLs need crawler-visible noindex/removal handling by an authorized site owner. [RECOMMENDATION; CITED:https://developers.google.com/search/docs/crawling-indexing/robots/intro]

For private /agent consent/handoff/renewal/auth, booking/ref, identity and provider-return routes preserve authorization, no-store, no-referrer and noindex in both HTML and response headers, no sitemap/JSON-LD/public links exposing tokens. Current /agent/layout.tsx already has noindex/nofollow/noarchive/nocache and no OpenGraph/Twitter; root robots does not enumerate /agent. Robots is crawl guidance, not an access-control barrier. [VERIFIED:F/app/agent/layout.tsx; F/domain/booking/seo.ts; CITED:https://www.rfc-editor.org/rfc/rfc9309.html]

Current sitemap.ts stamps lastModified=new Date() on every generated entry. Use the actual source page/entity content-modified timestamp or omit lastmod when unavailable; sitemap-generation time is not page modification time. Add bounded pagination/chunking before large catalogs rather than Number.MAX_SAFE_INTEGER fetches, preserve same-host valid canonical URLs and XML escaping, and check no private query links leak. [VERIFIED:F/app/sitemap.ts; CITED:https://www.sitemaps.org/protocol.html; RECOMMENDATION]

### Pattern2: Truthful entity graph, not fabricated booking offers

| Page/data | Schema choice | Boundaries |
|---|---|---|
| Marketplace/company |Organization + WebSite; factual service description|Marketplace is not automatically a physical local rental branch. Do not invent addresses,25+active cities, ratings or supported agents. [RECOMMENDATION; VERIFIED:F/app/layout.tsx currently contains25+city claim] |
| Actual operator storefront |AutoRental with stable @id and supported location/contact/areaServed|AutoRental is a LocalBusiness subtype for a car rental business. Omit unknown address/hours and unsupported service areas rather than fabricate. [CITED:https://schema.org/AutoRental] |
| Source-approved real vehicle rental |Car/Product + Offer or Service representation with provider reference|Offer explicitly represents rent/service rights; set businessFunction=GoodRelations LeaseOut because unspecified offers default to Sell. Daily rate must be labeled a daily base unit, not all-in total. Omit offer when price/terms cannot be stated faithfully. [CITED:https://schema.org/Product; https://schema.org/Offer; https://schema.org/UnitPriceSpecification] |
| Individual actual reservation |RentalCarReservation only on owned private confirmation/email if justified|This type describes actual reservations, not public fleet inventory. Never publish customer/ref/token/identity in public JSON-LD. [CITED:https://schema.org/RentalCarReservation] |
| Public navigation |BreadcrumbList where visible actual hierarchy exists|Navigation to a detail page is not a booking action; no GET side effect or fabricated ReserveAction target. [RECOMMENDATION consistent with CONTEXT.md] |

Stable entity @ids can be canonical URLs plus #organization/#operator/#vehicle. Source-authoritative date-bound API availability is distinct from generic catalog presence: omit InStock/available-now when no exact rental window has been checked. Reviews, deposits, insurance, mileage, min duration, fees, delivery and cancellation must come from a documented source and match visible content. Google's product-snippet eligibility is conditional; correct Schema.org does not promise rental rich results or ranking. Validate vocabulary separately from search feature eligibility. [RECOMMENDATION; CITED:https://developers.google.com/search/docs/appearance/structured-data/product-snippet; https://developers.google.com/search/docs/appearance/structured-data/sd-policies]

### Pattern3: Public content discovery and authenticated action discovery are different

Use standard hyperlinks/SSR text, correct robots/sitemaps/canonicals and credible real tenant content first. Google states its AI Search has no special AI-file or schema requirement. llms.txt v2 is a proposal, modified2026-08-10, with links to concise Markdown and alternate/describedby relations; add it as public documentation generated from the same eligibility/contract source. Do not use it as an ACL or allowlist. AGENTS.md is officially a convention for coding-agent repository instructions; /agents.txt has not been established here as a mandatory web discovery protocol. An optional website-use guide must state its own purpose and avoid pretending every client interprets it. [CITED:https://developers.google.com/search/docs/appearance/ai-features; https://llmstxt.org/; https://agents.md/]

Publish a human-readable agent connection page with exact approved MCP URL, protocol profiles, provider issuer, capabilities/scopes, support/limitations and OpenAPI URL. Remote MCP uses RFC9728 protected-resource metadata and a challenge pointing to metadata; this discovers authorization once a client already knows a protected resource. It does not independently advertise the marketplace to the entire web. The current spec favors Client ID Metadata Documents, retains deprecated DCR compatibility, supports OAuth/OIDC authorization-server discovery and distinct resource audience binding. Keep existing no-passthrough exchange/original-client customer grants. [CITED:https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization; VERIFIED:B/docs/external-booking/oauth-compatibility.md]

Root /.well-known/mcp.json is a conventional probe, not proof of the required protocol discovery mechanism. The official MCP Registry uses server.json metadata and verified namespaces and is presently preview. Prepare validated registry metadata only after a reachable production server and acceptance; do not submit private synthetic staging or promise downstream discovery/ranking. Publishing to a registry or installing a connector is a separate operational action requiring its real destination/access. [VERIFIED:public audit limits; CITED:https://modelcontextprotocol.io/registry/about]

### Pattern4: Provider-authoritative resolution outside locks, then fenced SQL transition

Stripe's current documentation recommends general Sandboxes for new integrations and notes that a Connect platform sandbox cannot connect to separate connected-account sandboxes. Current rent-checkout uses the platform STRIPE_SECRET_KEY, teamConnectedAccountId(mode), card-only payment_method_types and the pinned2025-08-27.basil API. Select the proper sandbox platform/connected test-account topology for the existing destination-charge integration; two unrelated sandbox accounts are not an equivalent configuration. Independently attest both required leg account/destination/mode and Identity availability. General sandbox/test-mode limitations need a selected-provider spike before marking resources ready. No anonymous sandbox or provider resource was created during research. [CITED:https://docs.stripe.com/sandboxes; VERIFIED:B/supabase/functions/rent-checkout/index.ts; RECOMMENDATION]

Current090730 retains reservation metadata and rejects clear/delete; external_queue_unresolved_checkout_batch visits at most100 rows with oldest-review order and SKIP LOCKED. It queues ambiguous_charge but does not establish unpaid truth. Keep this protective behavior while adding an append-only reconciliation case/attempt ledger, lease/version, exact booking/operator/account/mode/session/intent bindings and redacted evidence. External agents get status/next_action only, not a financial-clearance capability. [VERIFIED:090730 SQL; operations assessment; RECOMMENDATION]

Claim bounded work, release transaction locks, retrieve through the existing trusted Stripe SDK in the exact account/mode, then reacquire booking/sorted inventory locks and compare lease/attempt/settlement version. A known open Checkout session can be expired through Stripe; after a race/error, retrieve current session and underlying intent rather than interpret error/no webhook as unpaid. Require terminal no-charge evidence for all possible required leg attempts, with card-profile restrictions and late-settlement handling. Partial, duplicate, processing, missing, wrong-account/mode or unreachable evidence remains retained/manual review. [RECOMMENDATION; CITED:https://docs.stripe.com/api/checkout/sessions/expire; https://docs.stripe.com/api/checkout/sessions/retrieve; https://docs.stripe.com/api/payment_intents/object; https://docs.stripe.com/connect/authentication]

Consume trusted evidence through narrowly service-only audited functions, preserving immutable reservation/settlement history. Do not add client-set booleans, arbitrary PostgreSQL GUC bypasses, trigger disabling or service-RPC parameters that manufacture provider proof. A stale worker must not release after a webhook settlement. Reconciliation/release and webhook settlement need one consistent lock/version discipline; legacy untracked sessions require separate audited investigation, never blanket backfilled innocence. Human refund decisions and authoritative refunds are distinct from unpaid clearance. [RECOMMENDATION; VERIFIED:operations assessment; 090730 immutability and current lifecycle source]

Stripe may prune idempotency keys after24hours; retrying an old ambiguous create can create a fresh operation. Retain the original key/creation age and existing conservative23-hour limit. No stored session reference or a missing object response alone proves no charge. Resolve old ambiguity through audited account-bound evidence; if still unknowable, keep the hold and escalate. Stripe event order is not guaranteed; dedupe by event/object identity and current provider truth, not timestamp ordering. [CITED:https://docs.stripe.com/api/idempotent_requests; https://docs.stripe.com/webhooks; VERIFIED:B/docs/external-booking/mcp-compatibility.md; operations assessment]

### Pattern5: Preserve shared JOSE resolver while bounding transport

The API creates a shared createRemoteJWKSet with3s timeout/1s cooldown/5min cache, but has no explicit byte/key ceiling. Installed jose6.2.3 exposes the customFetch symbol. Attach bounded pinned-endpoint fetch to that resolver, cap actual decoded bytes regardless of Content-Length, validate keys count/shape, forbid redirects/untrusted DNS targets, preserve JOSE's signal and one shared cache/rotation behavior. Choose documented limits as reviewed configuration, not an invented compliance constant. Test oversized known-length/chunked key sets, stalled reads, many keys, rotation and concurrent callers; one caller cancellation must not break shared in-flight work for others. [VERIFIED:B/external-booking-api/index.ts; installedjose remote.d.ts; OPERATIONS-REVIEW.md; CITED:https://github.com/panva/jose/blob/v6.2.3/docs/jwks/remote/variables/customFetch.md; RECOMMENDATION]

## Don't Hand-Roll

| Problem | Use | Reason / source |
|---|---|---|
| JWT/JWKS verification/rotation |Existing jose + bounded customFetch|Preserve signature/key selection/cache behavior. [CITED:https://github.com/panva/jose/blob/v6.2.3/docs/jwks/remote/functions/createRemoteJWKSet.md] |
| OAuth resource/client discovery |MCP SDK + pinned RFC9728/8414/OIDC metadata|No homemade issuer, token passthrough or unauthenticated claims. [CITED:current MCP authorization; VERIFIED:current OAuth source] |
| Payments/identity |Existing hosted Stripe SDK/provider events/retrieval|Agents never enter cards or IDs; browser redirects do not prove completion. [VERIFIED:current handoff/lifecycle sources; CONTEXT.md] |
| Double booking/idempotent requests |Existing atomic SQL/inventory trigger/request ledger|Do not add a parallel cache lock or frontend-only hold. [VERIFIED:01-VERIFICATION.md] |
| Host metadata/sitemaps |Next Metadata/MetadataRoute and shared eligibility DTOs|Keep HTML/JSON-LD/sitemap/guides coherent. [VERIFIED:F/app/robots.ts,sitemap.ts; CITED:Next JSON-LD guide] |
| Browser E2E |Fixed Playwright config + guarded fixture manifest|Vitest pilot dispatch cannot stand in for a real browser driver. [VERIFIED:run-tests.mjs; F/playwright.agent-handoff.config.ts] |

## Runtime State Inventory

This phase includes backend migration, public canonical/index policy changes and staging setup, so source-only grep is insufficient. [VERIFIED:CONTEXT.md]

| Category | Items found / boundary | Action required |
|---|---|---|
| Stored data |Existing phase01 local requests persist; public live demo has tenant/vehicle URLs. Whole managed schema/data/ACL/RLS is not inspected by this research. [VERIFIED:01-VERIFICATION; publicaudit]|Preserve local history, use fresh run IDs/windows, seed new synthetic IDs; inspect selected managed schema and retain exact migration proof before deployment. |
| Live service config |Live Netlify redirects and53-entry demo sitemap observed; parent found candidate migration-staging Supabase project but reuse/provider attestation pending. OAuth/provider/gateway/jobs config must be audited. [VERIFIED:publicaudit; parentinventory evidence]|Read-only inventory then selected-resource attestation; separate hostname/noindex, test-mode secrets/webhooks/email/jobs; never assume git or a label covers deployed settings. |
| OS-registered state |No phase-specific OS registration was inspected; current Docker lab ownership is recorded in prior phase. Cannot claim none. [VERIFIED:research scope; Phase01]|Inventory exact owned container/volume/internal network and running test servers; preserve user services; controlled stop/cleanup only. |
| Secrets/env vars |Parent reports no relevant env names and an authenticated Supabase CLI account; neither means selected test keys/issuer exist. [VERIFIED:parentinventory evidence]|Account access check and configuration attestation without printing secrets; no production dotenv fallback. |
| Build artifacts |Existing locked node_modules/Next/MCP builds; live public HTML differs from isolated root app/page.tsx. [VERIFIED:packages; publicaudit; F/app/page.tsx]|Record build SHA, artifact provenance, host env and invalidation; do not infer deployed code version from local tests. |

## Common Pitfalls

1. **Demo discovered as real inventory.** Live main-domain redirects already lead to a demo and its sitemap. Fix public routing/indexability before increasing crawl exposure; a hosted Supabase data mode is not proof inventory is real. [VERIFIED:publicaudit; seo/config/sitemap source]
2. **Training permission confused with agent search/use.** OAI-SearchBot controls OpenAI search; GPTBot concerns model-training collection; ChatGPT-User fetches at user request and robots may not apply. Anthropic similarly separates ClaudeBot, Claude-SearchBot and Claude-User. Preserve any deliberate training choice separately and check CDN/WAF as well as robots. Repeat private exclusions in any specific-agent rules because a more specific group must not accidentally allow private paths. [CITED:https://developers.openai.com/api/docs/bots; https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler; https://www.rfc-editor.org/rfc/rfc9309.html]
3. **Metadata file exists but wrong host/product.** B/public artifacts use exotiq.ai; actual rental response audit shows different files. Test deployed URL/status/content type/canonical and exact supported links, not existence on disk. [VERIFIED:B/public; publicaudit]
4. **Injected text becomes HTML/prompt authority.** Tenant descriptions are untrusted content, not instructions; escape JSON-LD '<', sanitize URLs, never copy private customer fields, and refuse embedded instructions to skip consent or change payee. [CITED:https://nextjs.org/docs/app/guides/json-ld; VERIFIED:CONTEXT.md]
5. **Guided success mislabeled organic discovery.** A supplied URL/MCP connection proves task usability, not spontaneous search surfacing. Record separate denominators, prompt/version/context, chosen source/citation/rank and failures. Do not claim bots visited because an audit declared their User-Agent. [VERIFIED:publicaudit limits; RECOMMENDATION]
6. **Full journey imposed in a false order.** Current state may require identity before operator approval. Test returned status/next_action and permutations while retaining all confirmation predicates. No convenience change to workflow is authorized. [VERIFIED:operations assessment; state/lifecycle source]
7. **Uncertain payment declared unpaid after timeout.**090730 correctly keeps occupancy; terminal provider evidence and a fenced safe clearance path are missing. An expired deadline/error/absent webhook must not release. [VERIFIED:090730; operations assessment]
8. **Staging evidence checkbox creates fake safety.** Existing guard accepts explicit reviewed statements; live resource/SDK mode/account/schema/job evidence must substantiate them. Supabase schema partial lab success cannot validate whole deployed schema/PostgREST/provider parity. [VERIFIED:guard-environment.mjs; Phase01verification]
9. **Hosted pilot accidentally runs Vitest.** run-tests.mjs currently dispatches every suite to Vitest, including pilot and --project=synthetic; pilot.spec.ts/config are missing. Route pilot to guarded Playwright with fixed config before accepting any project flags. [VERIFIED:run-tests.mjs; test-suites.mjs;01verification]

## Code Examples

### Safe SSR JSON-LD serialization

Official Next pattern, adapted to a source-derived graph; example is not a delivered serializer. [CITED:https://nextjs.org/docs/app/guides/json-ld]

```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(publicGraph).replace(/</g, '\\u003c')
  }}
/>
```

### Resource metadata is exact protected-resource discovery

Schematic RFC9728 response; replace all example domains with attested approved resource/issuer, never advertise deployment from this example. [CITED:https://www.rfc-editor.org/rfc/rfc9728.html]

```json
{
  "resource": "https://mcp.example.invalid/mcp",
  "authorization_servers": ["https://issuer.example.invalid"],
  "scopes_supported": ["catalog:read"]
}
```

Use an authenticated endpoint's401 Bearer challenge with exact resource_metadata URL and action scopes; current source already implements administrator-pinned resource metadata. Public agent documentation links to the actual endpoint. [VERIFIED:B/docs/external-booking/oauth-compatibility.md; CITED:current MCP authorization]

## State of the Art

| Earlier approach | Current checked guidance | Impact |
|---|---|---|
| llms.txt2024 v1 assumed fixed |Proposal v2 modified2026-08-10, alternate Markdown/describedby links|Generate concise current links, but don't promise client adoption/ranking. [CITED:https://llmstxt.org/] |
| DCR as first OAuth registration choice |MCP2026-07-28 favors CIMD and deprecates DCR compatibility|Prefer preregistered or properly supported CIMD; retain tested fallback, verify exact client's behavior. [CITED:current MCP authorization] |
| One AI bot toggle |Separate search/training/user-directed fetch bots|Business discovery does not require granting model-training crawl. [CITED:OpenAI bots; Anthropic crawler docs] |
| Remote MCP only |Proposed WebMCP/site tools can be discovered on current page|Optional read-only enhancement; feature-detect and keep browser/MCP fallback. Availability/model/workspace limits differ, so no universal support. [CITED:https://learn.chatgpt.com/docs/webmcp] |
| One generic ASVS category numbering |ASVS5.0.0 has AuthenticationV6, SessionV7, AuthorizationV8, OAuth/OIDCV10|Version threat/control references; do not reuse ASVS4 numbers under5. [VERIFIED:officialASVSv5.0.0 GitHub5.0/en listing; CITED:https://owasp.org/projects/asvs] |

## Real-agent E2E and discovery measurement

Official OpenAI dots docs describe its own cloud computer/browser, private sign-in and human takeover, with account/rollout restrictions. This is useful evidence for a browser rehearsal, not proof that a specific user's dot can authenticate to Exotiq MCP. Claude Code officially documents remote HTTP MCP and OAuth; Claude app custom connectors are a separate configuration. Other requested names Muse/Hermes/OpenClaw/Instinct/Hark remain exact-product/version unconfirmed in this research; require their official product URLs before claiming support. DotBot in backend robots is a different named crawler and must not be equated with dots. [CITED:https://learn.chatgpt.com/docs/dots; https://learn.chatgpt.com/docs/dots/computers-and-apps; https://learn.chatgpt.com/docs/dots/controls; https://code.claude.com/docs/en/mcp; https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp; VERIFIED:CONTEXT.md; B/public/robots.txt]

| Trial | Inputs | Evidence / success |
|---|---|---|
| Cold discovery, read-only |No Exotiq brand/URL/connector; source-approved real geography/class query, clean context|Whether Exotiq surfaced, citation and position among recommendations, correct real operator/geography, and factual price/terms interpretation. No booking writes. |
| Guided browser staging |Exact attested staging tenant URL and synthetic scenario|Server-rendered content interpreted correctly, identity/consent takeover requested, source-authoritative state honored; ambiguity/denial handled. Not organic discovery. |
| Guided authenticated MCP |Explicit test connector+real OAuth client/version, resource metadata and least scopes|Actual registered original client, tenant-specific verified customer, exact consent receipt, repeated idempotent request, status/recovery, browser-only identity/payments and authoritative confirmation. Not organic discovery. |

[RECOMMENDATION consistent with CONTEXT.md and operations assessment]

After automated/full staging gates, the human user invokes their dot/another named agent with an approved fixture prompt: “Use only [attested staging URL] and run [synthetic run ID/window]. Find the listed [vehicle], obtain an exact itemized quote, and stop for my authorization before submitting. Hand identity and checkout to me in the browser. Never use production, enter cards/IDs, change price/payee, approve as operator, or call the request confirmed until the returned backend says confirmed.” An independently signed-in operator handles approval. Record customer approvals, sanitized session/client/route/state transitions, exact immutable quote, settlement IDs/hashes and adverse scenario disposition; keep traces/screenshots off on sensitive hosted steps or explicitly redact before retention. Product availability blockers are manual-only outcomes, not automated passes. Do not message a remote agent or staff account without an explicit destination and authorization. [RECOMMENDATION; VERIFIED:CONTEXT.md; F/playwright.agent-handoff.config.ts trace/screenshot/video off]

## Environment Availability

| Dependency | Available | Version/status | Fallback/gate |
|---|---|---|---|
| Node/npm |Yes|22.22.3/10.9.8|Existing isolated dependencies. [VERIFIED:CLI] |
| Docker CLI |Yes|28.3.2|Runtime exact owned-lab proof still required before DB mutation. [VERIFIED:CLI; Phase01] |
| Supabase CLI |Yes|2.90.0|Parent has authenticated project inventory; selected staging not yet attested. [VERIFIED:CLI; parent inventory] |
| Stripe CLI |Yes|1.40.2|Official docs now advertise docs CLI1.43.3+; existing version does not prove provider test accounts/access. Existing SDK is fallback, exact API/test profiles still gate. [VERIFIED:CLI; CITED:Stripe currentAPI pages] |
| Local psql / Deno CLIs |Not found|No PATH entry|Use owned container psql; Edge deploy/runtime proof remains managed acceptance, not Node typecheck. [VERIFIED:command probes; Phase01verification] |
| Candidate managed Supabase |Found, not selected|exotiq-migration-staging ACTIVE_HEALTHY, parent read-only inventory|Confirm reuse ownership or select separate resource; do not mutate existing migration work. [VERIFIED:testing/2026-10-08/staging-resource-candidates.json] |
| Both Stripe test legs / identity sandbox / managed OAuth / email sink / isolated jobs & gateway |Not attested|Account/version/scopes/secrets not established|Blocked hosted writes until selected attested resources and budget/access; no live fallback. [VERIFIED:CONTEXT.md; guard; operations assessment] |
| Actual dots/other agent account |Unverified for this pilot|Product/version/workspace/features/user identity pending|Manual browser rehearsal after account access and staging gate; no invented interoperability result. [VERIFIED:CONTEXT.md; primary dots docs] |

## Validation Architecture

### Today's new test findings carried into this phase

The root's fresh frontend run passed673 tests with20 explicit skips. Initial TypeScript failure came from8 empty generated node_modules/@types directories with a trailing ' 2'; removing only those empty isolated dependency directories restored typecheck, without changing source/config/package/lock. Treat this as hermetic dependency/worktree preflight evidence, not a changed application behavior. [VERIFIED:testing/2026-10-08/frontend-full.log; frontend-typecheck.log; frontend-typecheck-remedied.log; dependency-empty-directory-remedy.json]

Fresh API testing exposed a simulated-reservation fixture clock race: independently reading Date.now for the original booking deadline and reservation could cross a second under load. A deterministic advancing-clock RED check returned410 instead of200; the fixture correction derives reservation expiry from the unchanged booking deadline and targeted7-case GREEN passed. This is a test-fixture correction, not a provider/payment implementation fix or an overnight-expiry claim. Require controlled clocks and immutable deadline anchoring in future tests. The subsequently completed root-owned logs show321 API unit tests,36 contract checks and12 actual local browser cases passed; MCP default50/typecheck also passed with5 explicit SQL skips. The12-browser run still uses synthetic provider/API boundaries, and none of these results establishes a managed-provider confirmed pilot. [VERIFIED:checkout-clock-red.log; checkout-clock-green.log; api-unit-final.log; api-contract-final.log; frontend-browser-final.log; mcp-results.json; RECOMMENDATION]

### Existing frameworks and separation

F uses Vitest and Playwright1.63.0; F/playwright.agent-handoff.config.ts exercises actual local Next/browser with synthetic identity/API boundaries and disables sensitive trace/screenshot/video. B has unit/contract/staging/pilot suite selection through Vitest and no dedicated pilot browser config; MCP has its own pinned4.1.11 runner and optional manifest-gated SQL composition. Every layer must report its own environment, pass/skip/blocked counts and boundary. [VERIFIED:package.json files; configs; run-tests.mjs;01verification]

| Stratum | Quick command / meaningful gate | Limit |
|---|---|---|
| Offline backend authority |B: npm run test:agent:unit; npm run test:agent:contract|No real provider/deployed DB proof. [VERIFIED:B/package.json] |
| MCP protocol |B/packages/renter-mcp: npm test; npm run typecheck|Default five SQL skips are explicit unexecuted tests. [VERIFIED:package;01verification] |
| Frontend SEO/host policy |F: npx vitest run domain/booking/seo.test.ts plus proposed discovery tests|Current SEO tests only inspect functions; require actual rendered route checks. [VERIFIED:seo.test.ts] |
| Real selected SQL |Existing explicitly owner-guarded lab with fresh manifest/windows|Partial schema only, cannot promote to full staging acceptance. [VERIFIED:01verification] |
| Actual local Next browser |F: npx playwright test --config=playwright.agent-handoff.config.ts|Synthetic provider/API, not same run as SQL composition. [VERIFIED:config;01verification] |
| Hosted synthetic pilot |Proposed B: node scripts/agent-booking/run-pilot.mjs --project=synthetic|Guard must execute before launch/import/network; full actual OAuth+PostgREST+Stripe+identity+operator proof. [RECOMMENDATION] |
| Real named agent |Human-invoked documented prompt and scoped account|Manual-only; product rollout/login and human approvals prevent fake deterministic automation. [RECOMMENDATION] |

### Phase requirements → test map

Proposed new files below are Wave0 gaps unless indicated existing. Plan actual registration in fixed runners; naming a file is not coverage. [RECOMMENDATION; VERIFIED:source inventory]

| Req | Behavior | Layer / files | Automated command or gate |
|---|---|---|---|
| STAGE-02 |Production/incorrect provider/account/issuer/job/manifest rejection BEFORE network |B/tests/agent-booking/environment.test.ts existing + new stage-attestation.test.ts; managed-schema.test.ts|npm run test:agent:unit; guarded staging with effective ACL/RLS/GUC/function/trigger/constraint snapshots |
| PAYREC-02 |Known expired-unpaid safe release, paid/partial/UNKNOWN retention, stale lease/webhook race, old-key denial, duplicate refund|B/tests/agent-booking/payment-reconciliation-unit.test.ts + payment-reconciliation.test.ts|Quick unit<30s; real concurrent SQL and sandbox provider acceptance separate |
| PILOT-02 |Owned customer→quote→consent→operator/identity/payment→confirmed for two profiles and required markets/cohort|B/tests/agent-booking/pilot.spec.ts + playwright.agent.config.ts missing|Guarded Playwright pilot; no fixture-claimed confirmation |
| DISC-02 |Host mode/env/redirect/canonical, XML/text content type, eligible sitemap URLs200, noindex/privacy and private token exclusion|F/domain/booking/discovery.test.ts + tests/agent/discovery-browser.spec.ts|Quick Vitest; new fixed discovery Playwright config + read-only deployed audit |
| TENANT-02 |Opt-in/data provenance/demo/stage/private visibility and slug redirect consistency|F/domain/booking/discovery.test.ts + source RPC visibility acceptance|Vitest plus managed SQL/API source eligibility; no hidden demo writes |
| SCHEMA-02 |Valid escaped SSR graph/stable IDs, no wrong rental totals/InStock/actions/reservations|F/domain/booking/structuredData.test.ts + discovery-browser.spec.ts|Vitest/Playwright plus schema validator and current rich-result-specific manual eligibility |
| DOCS-02 |Complete canonical OpenAPI/schema/tool projection, links only to actual approved public hosts/capabilities, no secrets|B/tests/agent-booking/docs.test.ts existing + F/discovery artifacts tests|Existing contract suite + live GET audit |
| AGENT-02 |Exact real client browser/OAuth/MCP behavior, cold vs guided outcomes|B/docs/external-booking/agent-pilot.md and redacted per-client evidence|Manual only, because actual account/permissions/human identity+payment takeover required |
| OPS-02 |Global/operator pause forbids new writes, preserves owned replay/status/completion, queue fairness/alerts/clearance audit|Existing flags/release-gates/runtime controls + new reconciliation/rollback hosted checks|Unit + selected SQL + guarded hosted rollback |
| EVOL-02 |Canonical source hash/content/public guide drift, protocol/dependency attribution and feedback|B/tests/agent-booking/capabilities.test.ts existing + new discovery provenance checks|Contract/check generator; maintenance ownership review |

### Full managed acceptance evidence

Capture pg_proc identities/definitions/defaults/security-definer search_path/lock+statement budgets, actual grants and default privileges, table RLS/policies/constraints/indexes/triggers including DELETE/cascade/writer paths, applied migrations and PostgREST reload/GUC hoisting. Compare audited source to deployed exact functions; review every dynamic writer/classification gap. Test anon/authenticated/service-role and cross-tenant access through real PostgREST/gateway, actual timeout/cancellation/pool behavior, signed event handlers/current identity/fee destination, isolated scheduler ordering and owned continuity. Source fingerprint and a checked attestation boolean cannot substitute for this evidence. [VERIFIED:01verification; OPERATIONS-REVIEW; operations assessment; RECOMMENDATION]

### Sampling and Wave0 gaps

Per task run only the meaningful affected unit/contract tests; per integration wave run changed backend/frontend/MCP suites and owned SQL where authority changes. Full hosted gate requires unskipped confirmed journeys and all critical adverse cases; a missing-account refusal is a correct safety test and a blocked pilot, never a passed pilot. Use no arbitrary test retries to hide whole-transaction contention handling. [RECOMMENDATION; VERIFIED:current guards and Phase01evidence]

- Missing guarded Playwright pilot driver/config/fixture orchestration and honest hosted suites. [VERIFIED:01verification]
- New source-authoritative payment-resolution evidence/transition and race tests; broad fake provider fixtures alone insufficient. [VERIFIED:090730; operations assessment]
- New real SSR discovery/JSON-LD/sitemap route tests and private noindex/no-store header tests. [VERIFIED:currentseo.test.ts; publicaudit]
- Provider-managed account/issuer original-client exchange and full schema acceptance fixtures, gate evidence validation and approved manual agent form. [VERIFIED:01verification; oauth compatibility]
- Proposed caps, operational alert response targets, cohort volume/duration and evidence retention are reviewable configuration; no invented compliance/performance target is locked. [RECOMMENDATION]

## Security Domain

ASVS5.0.0 is the current official stable version. Its categories differ from the old template's V2 Authentication/V3 Session/V4 Access/V5 Validation/V6 Crypto mapping; use explicitly versioned5.0 references below and keep earlier Phase01 numbering labeled historical. This is a control inventory, not ASVS certification. [CITED:https://owasp.org/projects/asvs; VERIFIED:officialv5.0.0 GitHub5.0/en directory]

| ASVS5 category | Applies | Standard control |
|---|---|---|
| V1 Encoding/Sanitization, V2 Validation/Business Logic |Yes|Escape SSR JSON-LD, typed canonical DTOs, exact immutable money/window/terms and transactional state |
| V3 Web Frontend, V4 API/Web Service |Yes|Origin/CSRF/no-store/no-referrer/noindex; body/deadline/budget limits and signed internal gateway |
| V6 Authentication, V7 Session Management |Yes|Managed issuer + customer-private proof/cookies, next-request introspection and fresh renewal |
| V8 Authorization, V9 Self-contained Tokens, V10 OAuth/OIDC |Yes|Exact resource/audience/original client/operator/customer/grant; metadata discovery and no token passthrough |
| V11 Cryptography, V12 Secure Communication |Yes|JOSE/standard HMAC/WebCrypto, pinnedHTTPS TLS/egress and test-vs-live account binding |
| V13 Configuration, V14 Data Protection |Yes|Attested staging/private secrets and no production fallback; public DTO projection and no private artifacts |
| V15 Secure Coding/Architecture, V16 Logging/Error Handling |Yes|Trusted worker/SQL boundary, lease fencing, redacted events and truthful UNKNOWN outcomes |

Category existence verified from officialASVSv5.0 listing; controls are recommendations grounded in inspected API/BFF/source safety. [VERIFIED:ASVSlisting;01security; RECOMMENDATION]

| Threat | STRIDE | Required mitigation / evidence |
|---|---|---|
| Tenant description injects instructions or closes JSON-LD script |Tampering/Elevation|Sanitized source DTO/escaped'<', human consent remains server-enforced, adversarial schema/browser test |
| Staging agent follows production redirects or provider live account |Elevation/Information disclosure|Allowlisted exact manifests/resource modes, redirect boundaries and no test credential fallback |
| Forged/wrong-audience/wrong-client customer delegation |Spoofing/Elevation|Existing JOSE/introspection/resource exchange/customer grants plus managed original-client acceptance |
| Delayed payment/stale worker clears a paid car |Tampering/Repudiation|Current provider truth, atomic lease/settlement checks, reservation-history preservation and concurrent SQL proof |
| Large key set/slow metadata/body exhausts process |Denial of service|Bounded customFetch/keys/sharedcache, distributed ingress limiter and total read budgets |
| Tokens/receipts/ID/payment fields in sitemap/schema/logs |Information disclosure|Public projection denylist, auth/no-store/private noindex, redacted evidence and trace handling |
| Search exposure marketed as universal or ranked-first support |Repudiation|Versioned client matrix, cold/guided test denominators and truthful support limitations |

[RECOMMENDATION; VERIFIED:01security; operations assessment; CONTEXT.md]

## Assumptions Log

No training-only factual claims are used. Proposed architectures/filenames are explicitly recommendations, not existing capabilities. Operational choices still needing a human decision are tracked as external inputs below rather than guessed. [VERIFIED:research source/proposal labels]

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| — |No [ASSUMED] factual claim retained|All|Unknown product/account/client/resource availability remains explicitly unverified |

## Open Questions (RESOLVED)

Each [RESOLVED] entry resolves the research choice or defines the mandatory procedure for a genuine external input. It does not assert that resources, credentials, staffing, deployment or client acceptance already exist. Referenced PLAN tasks are executable future work, not implemented capability. [VERIFIED:02-06/10/11/12/15/16/18-PLAN.md]

1. **[RESOLVED] Selected staging resource, budget and owners — gated external selection.** Plan02-10 task1 requires exact Supabase organization/project or authorized distinct creation, spending ceiling, Stripe platform sandbox and its connected test destination, Identity/managed OAuth clients, owned TLS/email/jobs/gateway and human operator/payment owner plus backup before plans02-11/12 execute resource operations. The healthy exotiq-migration-staging candidate remains reserved until owner confirmation and disposability review; an ACTIVE_HEALTHY label does not grant reuse. Pending input is handled through this named human-decision checkpoint while independent local plans continue. Labels and secure existing sign-in suffice; credentials never belong in chat. [VERIFIED:02-10-PLAN.md;02-11-PLAN.md;02-12-PLAN.md;testing/2026-10-08/staging-resource-candidates.json]

2. **[RESOLVED] Pilot eligibility representation — new isolated synthetic demo counterpart and source-eligible market fixtures.** Plan02-11 task2 chooses a distinct staging demo tenant slug/ID and newly created synthetic user/customer/vehicle/location IDs, with reviewed manifest ownership and exact synthetic markers. It also supplies source-eligible Miami/Tampa fixtures so inherited market×client acceptance remains intact. Preserve production demo/market/opt-in predicates; no broadened Scottsdale claim, production demo admission or fake public inventory. Plan02-12 applies the complete reviewed schema and exact synthetic manifest only to the attested stage. This is the concrete fixture strategy, not an unresolved choice between production eligibility overrides. [VERIFIED:02-11-PLAN.md task2;02-12-PLAN.md tasks1–3;02-CONTEXT.md]

3. **[RESOLVED] Public host strategy — explicit marketplace and booking ownership, gated deployment.** Plan02-06 task1 selects exotiq.rent for marketplace identity, book.exotiq.rent for eligible real tenant/detail pages and a distinct noindex staging TLS origin. Shared typed policy binds exact configured origins, dataset mode and public eligibility; the production root must not automatically lead to the demo. Actual hosting-owner access, reviewed redirects/DNS/build configuration and any production deployment remain external operational checkpoints; plan02-18 reviews a concrete limited readiness result and requires separately scoped subsequent launch authorization. Today's read-only audit remains the evidence of current behavior, not proof these planned changes are deployed. [VERIFIED:02-06-PLAN.md;02-18-PLAN.md;DISCOVERY-TEST-RESULTS-2026-10-08.md;testing/2026-10-08/public-discovery-evidence.json]

4. **[RESOLVED] Real Dot/client identity and capability — explicit selection, documentation and human test gates.** Plan02-10 collects the exact Dot/dots or alternate product URL/version/workspace; plan02-15 task2 records vendor-primary documentation and a client matrix for separate cold discovery, guided staging URL and authenticated MCP/OAuth. Plan02-16 requires the human to invoke the selected genuine agent only after actual hosted gates, record observed approvals/identity/payment/state evidence, and use another human-selected compatible client if the chosen Dot cannot support the journey. Official OpenAI dots is a documented candidate, not an assumed match to the user's account. Muse/Hermes/OpenClaw/Instinct/Hark and all Exotiq-specific client support stay unverified until those gates collect actual evidence. Cold search misses and unsupported capabilities remain outcomes, not fabricated passes. [VERIFIED:02-10-PLAN.md;02-15-PLAN.md task2;02-16-PLAN.md; CITED:https://learn.chatgpt.com/docs/dots]

5. **[RESOLVED] Payment profile and operational authority — card-only recovery with trusted evidence and human staffing.** Plan02-04 implements the existing reviewed card-only Stripe profile, exact account/mode/immutable attempt binding, provider retrieve/eligible expire/retrieve, independent required-leg truth, bounded worker leases and fenced SQL finalization. Ambiguous, partial, processing or unproven legacy attempts retain occupancy; neither a manual assertion nor an arbitrary SQL/refund override authorizes release. Genuine delayed-method/refund capabilities require their own trusted provider evidence and accepted policy, not a generic card success substitution. Human operator/payment owner and backup are mandatory inputs in02-10, staffed runbook/metrics/resume proof in02-15 and final readiness review in02-18. Actual owner identities and provider capabilities remain pending external facts under those named gates. [VERIFIED:02-04-PLAN.md;02-10-PLAN.md;02-15-PLAN.md task1;02-18-PLAN.md;OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md]

6. **[RESOLVED] Today's consolidated evidence — final reports and source snapshot exist.** DISCOVERY-TEST-RESULTS-2026-10-08.md and TEST-SNAPSHOT-2026-10-08.json record321 API unit passes,36 contract passes,50 MCP passes with5 explicit SQL skips,673 frontend passes with20 explicit skips,12 actual local Next/Chromium passes with synthetic API/provider boundaries, all three typechecks/canonical-consumer checks and21 bounded read-only public GET probes. Backend snapshot is ecdbb7228fe29424a6f4c13bc779e12639311511; frontend remains3411a4e49901441553e23772a829d4386067144b. The reports retain the fixture-clock RED/GREEN correction and removal of8 verified-empty generated dependency directories, with unchanged original checkout snapshots. These are current safe local/public results; no hosted confirmed booking, real named-agent trial or fresh full managed SQL/provider test ran today. Plans carry the findings forward without rewriting Phase01 acceptance as complete. [VERIFIED:DISCOVERY-TEST-RESULTS-2026-10-08.md;TEST-SNAPSHOT-2026-10-08.json;02-06/10/11/12/15/16/18-PLAN.md baseline provenance]

## Sources

### Primary — HIGH confidence

- Local 02-CONTEXT.md/config/Phase01VERIFICATION+SECURITY, OPERATIONS-REVIEW and OPERATIONS-PILOT-ASSESSMENT-2026-10-08.md; exact source paths and current audit artifacts listed above. [VERIFIED:read duringresearch]
- https://developers.openai.com/api/docs/bots — separate search/training/user-directed fetching.
- https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler — Anthropic crawler classes.
- https://developers.google.com/search/docs/appearance/ai-features — conventional SEO; no special AI-file/schema requirement.
- https://developers.google.com/search/docs/crawling-indexing/robots/intro and /consolidate-duplicate-urls — robots/private indexing/canonical boundaries.
- https://www.rfc-editor.org/rfc/rfc9309.html and https://www.sitemaps.org/protocol.html — standard crawl/sitemap semantics.
- https://llmstxt.org/ — v2 proposal modified2026-08-10.
- https://agents.md/ — coding-agent repository convention.
- https://schema.org/AutoRental, /RentalCarReservation, /Product, /Offer, /UnitPriceSpecification — rental business/actual reservation/lease offer semantics.
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet and /sd-policies — conditional eligibility and visible-truth requirement.
- https://nextjs.org/docs/app/guides/json-ld — escaped SSR JSON-LD pattern.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization and https://www.rfc-editor.org/rfc/rfc9728.html — OAuth resource discovery/current CIMD/DCR/profile.
- https://modelcontextprotocol.io/registry/about — preview public server.json registry and namespace authority.
- https://learn.chatgpt.com/docs/dots, /dots/computers-and-apps, /dots/controls — real dots browser and human control boundaries.
- https://learn.chatgpt.com/docs/extend/mcp — actual Codex OAuth/client-registration behavior; do not infer dots parity.
- https://learn.chatgpt.com/docs/webmcp — proposed WebMCP/site tools and current availability limits.
- https://code.claude.com/docs/en/mcp and https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp — distinct Claude products/connectors.
- https://docs.stripe.com/api/checkout/sessions/expire, /retrieve, https://docs.stripe.com/api/payment_intents/object, /api/idempotent_requests, /webhooks, /connect/authentication — terminal evidence, account-binding, event and retry boundaries.
- https://docs.stripe.com/sandboxes and /identity/verification-sessions — isolation/Connect topology limits and session reuse/verified-state/private client-secret boundaries.
- http://purl.org/goodrelations/v1#LeaseOut — verified official GoodRelations BusinessFunction URI, not an assumed Schema.org enum.
- https://supabase.com/docs/guides/deployment/branching and /database-migrations — isolated resources/migrations and merge deployment effects.
- https://github.com/panva/jose/blob/v6.2.3/docs/jwks/remote/variables/customFetch.md and /functions/createRemoteJWKSet.md — exact pinned transport/cache extension.
- https://owasp.org/projects/asvs and https://api.github.com/repos/OWASP/ASVS/contents/5.0/en?ref=v5.0.0 — stable version and actual category numbering.
- npm registry npm view version/time on2026-10-08 — current versions and exact pin publication timestamps.

All external URLs above were opened or verified directly in this session; Context7 is not exposed in this tool inventory, so primary documentation/maintainer sources were used. Search discovery was followed by direct primary-source verification; no SEO agency/blog/community claims are relied on. [VERIFIED:tool inventory;research calls]

### Secondary / tertiary

None required. Product identities/client support not verified by primary sources remain open, not converted into facts. [VERIFIED:research scope]

## Metadata

| Area | Confidence | Rationale |
|---|---|---|
| Existing stack |HIGH|Exact package/source plus current npm versions/timestamps |
| Public discovery findings |HIGH for sampledGETs|Dated21-probe evidence; actual crawler indexing/CDN admin configuration unverified |
| Recommended architecture |HIGH for invariants;MEDIUM for exact new allocations|Existing source/primary protocols; execution/host strategy still needs acceptance |
| Payment reconciliation |HIGH for safety rationale;MEDIUM for provider closure|Current protective SQL/Stripe docs; new clearance not implemented or proved |
| Named-agent interoperability |LOW until actual run|Only general primary product capabilities checked; Exotiq original-client end-to-end remains unperformed |

**Research date:**2026-10-08. **Recheck:**Before provider/registry publication or execution; registry/protocol/client facts within7days. Stable crawl/vocabulary guidance within30days. These intervals are maintenance recommendations, not guaranteed validity periods. [RECOMMENDATION]
