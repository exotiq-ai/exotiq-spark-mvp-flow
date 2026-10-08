# 01-10 MCP preparation notes — partial acceptance

Owner branch: `codex/agent-booking-adapter`, worktree `work/exotiq-agent-build/adapter-worktree`. This is an adjunct for the root executor's review, not a second completed-plan SUMMARY. Root retains STATE, ROADMAP, provenance and final acceptance ownership.

The actual official SDK transport is wired to six thin API tools, a concrete JWT/JWKS + fresh discovery/introspection + RFC8693 exchange boundary, bounded fixed egress, and a compiled loopback runtime. Canonical API JSON schemas and `validateContract` are imported directly; the package does not maintain a pricing/state/authorization database. Original MCP consumer `client_id` must survive API delegation. No MCP bearer passes through to the API.

## Changes and task commits

| Commit | Work |
| --- | --- |
| `24b2b618` | Exact pinned package, scoped test/build configuration and signed OAuth RED tests |
| `c5ce3c9c` | Real resource/signature/introspection/exchange verification; original-client binding; local pre-network abuse budget |
| `37b433fe` | Official client HTTP protocol RED tests |
| `7f044cf6` | Six actual tools, canonical input/output validation, server-side consent read, safe API failure projection |
| `bc891601` | Runtime/configuration/remote bounds RED tests |
| `09dadfd3` | Actual compiled entry, fixed public-origin loopback adapter, bounded ingress and fail-closed config |
| `818cfa60`, `a030d270` | Metadata-substitution RED/GREEN plus JWT type/audience/expiry/client/scope denials |
| `3f6df506` | Source cents/terms/UNKNOWN forwarding, untrusted prompt strings and API prefix/error-link boundaries |
| `2734a0fe` | Actual SDK legacy and pinned modern negotiation assertions |
| `4f18659b`, `a560a3dc` | Owned ref recovery RED/GREEN, authenticated authorized rendezvous and one original-operation retry |
| `032b1f26` | Compatibility/runtime/release-gate documentation and narrowed prototype/same-renewal checks |
| `4cad67a9` | Official OAuth helper S256, state/resource/client/redirect and RFC9207 denial for both fixture profiles |
| `c5f3d835`, `5efa6ff2`, `3236034e` | Rejected remote stream cleanup RED/GREEN, standard JWKS media type, actual disconnected HTTP response cancellation |
| `81809238`, `54e2b5e6` | Independent review reproductions: consequential status hints, unsafe private result URLs, actual inbound cancellation failing to stop egress/next write |
| `dfb2b38c`, `2f5f1799`, `d9a93935` | Cancellation propagated through Node/auth/JWKS/API; correct status effects; exact configured private URL policy and documentation |
| `d53652f5`, `7e48adcb` | Cancellation isolation between principals, allowed handoff/API-prefix links, poisoned quote URL denial through official SDK |
| `88e64883`, `0a75f21d` | Canonical punctuation in stable retry keys RED/GREEN; no normalization |
| `b919db84`, `6b10ded1` | Scoped identity rendezvous RED/GREEN through status, independently verified exchanged-token capability |
| `5b48b3fe` | Actual SDK identity grant/capability scenarios, safe owned links and operating documentation |
| `249addb3`, `63197875`, `0306a1dc` | Plan15 preparation: customer-owned account continuation RED/GREEN, fixed UUID/ref query policy, both actual SDK profiles with absent/granted agent scopes |

Upstream main was merged twice, including shared WebCrypto BufferSource correction and09 request/status/ref-renewal contracts (`6839b785` lineage). No shared backend contract/auth/route was edited by this owner. Package owns its separate installed dependency directory; no install ran through a readonly source dependency symlink. npm11 installation was required for the npm10 Arborist peer-resolution bug; no peer bypass or force audit fix was used.

## Actual verification

On 2026-10-07: `npm --prefix packages/renter-mcp test` — **43 tests in5 files passed**; `run typecheck` and `run build` passed. An exact lockfile `npm --prefix packages/renter-mcp ci --no-audit --no-fund` also passed under npm10.9.8/Node22.22.3 with no lockfile change; npm11 was only needed for the initial install. `npm start` after build without configuration exited1 with fixed `MCP configuration unavailable.` and opened no listener. Full scoped `npm audit --json` and production-only audit report **zero vulnerabilities** after compatible Vitest4.1.11 patch; primary advisory is linked in the compatibility document.

The protocol suite invokes actual `Client`/`StreamableHTTPClientTransport`2.3.1 over a real loopback HTTP listener. Profile A explicitly uses SDK legacy mode. Profile B pins2026-07-28 and asserts modern era/version. They negotiate tools/list and tool calls with real local signed JWTs, JWKS, fresh metadata/introspection and exchanged API-resource tokens. API payloads in these tests are synthetic fixtures; tests do not claim live Supabase or hosted-provider execution.

Covered denials: wrong resource/forged JWT/type/expiry/multiple audiences/unregistered client/unknown scope; fresh revocation/introspection identity substitution/API exchange client rebinding; mutable provider endpoint substitution before credentials; pre-network local limiter; hostile Host/Origin/batch/query bearer; oversize/nonJSON/stalled remote response; unsafe account Link; caller receipt/consent/hint arguments; malformed API output. Operator prompt-like strings remain data and upstream error instructions are suppressed. Source quote cents, deposit, terms, nohold and UNKNOWN state remain unchanged. Waiting consent returns one fixed customer URL and makes no rental-request write. Receipt/grant IDs never appear in tool inputs/outputs.

Official OAuth helpers additionally verify S256 challenges, state, redirect/client/resource parameters and wrong/missing issuer callbacks for two client registrations. They do not establish provider authorization-code redemption or customer browser completion. No authorized receipt has been injected to simulate an MCP customer journey.

## Independent review corrections

All three concrete findings from `MCP-PREPARATION-REVIEW.md` were reproduced before fixing. Official tools/list now reports status `readOnlyHint:false` and `idempotentHint:false`, because an expired or revoked grant can create a customer authorization renewal. Two actual tool calls assert those renewal POSTs and hosted waiting results.

Premature inbound HTTP disconnect now aborts a request-scoped controller carried through SDK callbacks, JWKS resolution, metadata, introspection, exchange, consent and API calls; the bounded transport composes it with its own deadline and checks before every new call. Tests stall actual upstream HTTP bodies during metadata and consent, close the client socket, observe upstream closure within500ms and assert no subsequent credential/request POST. A negative after-consent cutoff asserts zero writes; another test proves one caller's cancelled key fetch does not cancel a different subject/client. Already committed backend work remains authoritative and uses same-key replay; cancellation does not imply rollback.

Every private customer URL is checked against the configured origin and exact consent/authorization/account/43-character handoff route. All queries/fragments are rejected independent of percent encoding. Status/action links bind the configured API prefix and current ref. Wrong origins/routes/refs, encoded secret keys, optional links and poisoned quote consent pointers are denied; exact hosted handoff and API-prefix links remain accepted. Actual08 renewal route is `/agent/authorization/{renewal_id}`; earlier synthetic fixture naming was corrected. Root also corrected the shared generic URL contract's encoded-key denylist; adapter privacy does not depend on that regex.

The root shared encoded-query denylist correction and14 canonical handoff checkpoint were integrated from main (`918195f9` lineage). The six-tool status flow now conditionally creates an identity review nonce only for an exact owned action link, `verify_identity`, and the independently verified API token's `identity:handoff` scope. Original MCP scopes alone cannot authorize it after exchange removes that capability. Actual SDK HTTP fixtures cover absent scope, allowed scope, exchanged scope removal and API grant403; the latter preserves status without inventing a customer landing. All cases leave approval/provider calls absent. Wrong identity review origin/path/query is denied. Nonce creation does not mark identity cleared; actual14 backend/provider acceptance remains separate.

## Required handoff and remaining acceptance

**Latest actual evidence, superseding the preparation/failure states below:** At adapter revision `38f442c4`, canonical contract SHA256 `7cc0779f647906c58b937e4e0c99bb8c46d7b54231adc5ecfdf0994a1fde5af5`, the explicit guarded local composition command passed **8/8 tests in93.70seconds** (2026-10-07,13:13:57 local run start). All four Miami/Tampa × legacy/modern profiles used production SDK→MCP→API→service-role SQL plus public API hosted-proof onboarding/review/consent. Exact83587cent quote→`pending_documents` request, global-only new quote/new already-consented disjoint request denial, both-flags catalog withdrawal/not_found, identical original-key replay and status/customer-account continuity all passed. No receipt/grant was injected or copied by the customer; no approval/provider/settlement/confirmed result was simulated. Root-supplied `setFixtureGlobalAdmission` separated503 admission denial from404 withdrawal. Four January requests were preserved; successful fresh windows were February1–3 and10–12,2035 at10:00`-05:00`, America/New_York. Reruns require explicitly selected fresh non-overlapping owned synthetic windows; no destructive reset is recommended. Admission restored true in teardown. Afterwards normal package **46 passed /5 opt-in lab cases skipped across6 files**, strict typecheck and compiled build PASS. Evidence documentation commit `c6a4ab2e`; test corrections `83e684c1`, `b51777b6`; genuine persisted clock regression RED `b9f65626` /GREEN `4b7d01ea` integrated with root runtime callback `390686ba`. Managed providers, PostgREST/deployed schema/ingress, actual browser UI completion and fully confirmed paid journeys remain unproven release gates.

Plan12 feasible local composition preparation: commits `877f1805` (RED), `255a7f5a` (signed actual AS GREEN), `9fee36d9` (four opt-in SQL cases) and `a2681096` (honest evidence documentation). Default package run now **45 passed /4 guarded SQL cases skipped across6 files**. No SQL composition run has occurred yet. Importing the actual production API exposed three root-owned typed-array BufferSource errors at API index byteHash/normalizeIngress; root was notified and owns corrections in the final runtime checkpoint. Package-only jose type resolution was added for the imported production modules; no shared API source changed. Do not interpret the earlier43-test typecheck PASS as evidence that this expanded import currently compiles. Once root merges final14/15 and repairs those types, run the four explicit lab cases and record actual results separately from provider/pilot acceptance.

First actual SQL composition attempt after root14/15 checkpoint `14508b28`: package strict typecheck now PASS (root repaired copied-buffer types). Explicit `AGENT_LOCAL_LAB_MANIFEST=.../integration-lab/resources.json npm --prefix packages/renter-mcp test -- tests/local-composition.test.ts` produced2 AS PASS and4 market cases RED at onboarding503 before quote/receipt/request creation. A single-profile diagnostic rerun (`1929fac0`) isolated `check_rate_limit` → sanitized `upstream_unavailable`; root owns the missing lab prerequisite. Readonly source inspection then found latest limiter regression: when count equals limit, no increment occurs but `RETURN current<=limit` remains true. Root was notified to repair the persisted authority. Commit `dde0fc6d` adds a fifth gated SQL assertion requiring actual capacity results `[true,true,false,false]`; normal missing-manifest runs intentionally skip5 lab cases. No provider/approval/settlement has been simulated as confirmation; admission was restored true in teardown.

Plan15 consumer preparation merged root main191f592b. Optional `links.customer_account` is now retained in request/status projections as `/agent/account/{operator_uuid}?ref={same_safe_ref}` even without agent identity or checkout capabilities. This is the sole private URL query exception: one literal ref, exact safe value, configured customer origin/UUID route, no fragment, encoded/extra/duplicate keys or values. Operator ownership comes from the API's owned request authority, since the canonical result itself has no operator_id to rebind locally. Both actual SDK profiles prove absence/granted-scope continuity with no added POST; identity grant403 also retains this account link. Final actual15 API control/14 runtime consumer assertions await the root checkpoint; these synthetic protocol fixtures are preparation, not SQL/provider acceptance.

14 final identity/checkout handoff schemas and actual routes must merge before finishing adapter checkout/status integration. Current thin checkout tool calls the API rather than an empty local handler, but downstream14 acceptance is pending. Next verify final current status/checkout shapes, safe hosted URLs, actual API dispatch and both canonical contract suites after that handoff.

Hosted managed identity issuer/client registration, S256/code redemption, original-client-preserving token exchange, independent revocation, actual browser onboarding/consent/recovery, identity sandbox and both Stripe legs remain release gates. User has no hosted staging and authorized isolated local tests. Local signed fixtures prove neither deployed schema/provider parity nor end-to-end payment/identity acceptance. Full01-10 success is not asserted.

The executable runtime requires explicit enable/configuration and gateway profile attestation. A reviewed TLS ingress + distributed limiter is a hard release gate; the profile string cannot prove its deployment. Process-local60/minute and8concurrent-auth limits precede all credential-bearing provider calls; each API request separately uses the backend persisted limiter and normal current-owner/grant authority. Public metadata also needs gateway limits.

## Deviations and known stubs

- Rule2: Added actual auth verification before official handler because SDK passes `authInfo` through without validating a token.
- Rule3: Added package-local Vitest config so tests never load unrelated root frontend dependencies.
- Rule1: Patched vulnerable compatible dev dependency to4.1.11 instead of using unsafe force updates.
- Rule2: Added real startup/configuration, bounded HTTP bridge and pinned metadata validation rather than reporting only dependency-injected factories complete.
- Accepted root design: local concrete limiter plus independently verified distributed gateway release gate; no adapter DB access or always-true limiter.
- Backend structural dependencies14 and provider acceptance remain gates. There are no TODO/placeholder implementations in the package source; unconfigured runtime is an explicit fail-closed gate. Root will own the completed-plan summary after integration review.

## Self-check

All listed source/test/config/doc files exist; task commits are in the branch. Checks above ran against the owner tree after identity integration. Final14 runtime handoff and hosted acceptance are intentionally not recorded as passed.

## Final ingress review correction

Independent security review found an unauthenticated body could stall before auth/rate evaluation. RED `cab52b32` reproduced indefinitely pending stalled/trickle reads, abort and actual Node HTTP. GREEN `b8ed703f` imposes a five-second TOTAL deadline and64KiB cap, races request abort, never awaits hostile cancellation, and routes actual Node ingress through this reader with bounded backpressure. Four regressions prove no AS/API dispatch after timeout/disconnect. At13:28:43 local on2026-10-07, full package **50 passed /5 explicit SQL skips in7 files**, strict typecheck/build passed. This supersedes older offline counts above; it does not rerun or expand the recorded8/8 SQL composition or claim managed-provider acceptance.

Final integrated checkpoint supersedes historical preparation/pending14 comments above: backend`7c3a9932f7d2dee17c2e30e646043af6279a07a8` includes actual14/15 runtime, refreshed provenance and the closed issued-checkout legacy DELETE bypass. Final independent API rerun at13:43:16 local confirms320 unit and36 contract passes. Parent confirms shared strict graph, canonical/complete frontend consumer match, package50/5 skips/typecheck/build and existing app regression/build checks. Final goal review is01-VERIFICATION.md; fifteen local plans delivered, full hosted acceptance zero, pilot driver/config missing, provider-authoritative uncertain hold clearance and managed JWKS resource bounds remain explicit limits. No local fixture service remains running from these package tests; fixture hooks close their own HTTP listeners. This owner created no Docker lab resources and does not stop another owner's lab.
