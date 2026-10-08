---
phase: 01-api-docs-mcp-foundation
plan: 14
subtask: frontend-task-2-prerequisite-preparation
status: canonical-frontend-local-verified-backend-provider-integration-pending
provider_parity: false
completed: 2026-10-07
---

# Plan 14 frontend prerequisite notes

Real Next server-rendered customer review and explicit CSRF-bound provider continuation, verified through isolated Chromium with encrypted sessions and signed resource/bridge JWTs.

This adjunct does **not** mark plan 14 complete. Canonical14 frontend consumption is implemented. Actual backend09/14 integration and provider acceptance remain required; no hosted/provider staging exists and none was called.

## Implementation

- `/agent/handoff/{43-character-base64url-nonce}` verifies the managed customer session on the server, then reads an authenticated backend review without creating provider sessions. Anonymous/invalid sessions get only an owned sign-in link; failed customer ownership/expiry/review gets no Continue control.
- `GET /api/agent/handoff/{nonce}` and explicit JSON `POST` bridge only to backend `/v1/customer-handoffs/{nonce}/review` or `/resolve`. The actual encrypted session/resource JWT is verified before forwarding. POST accepts exactly `{csrf,action:'continue'}`, validates Origin/CSRF, strips CSRF, and signs the precise backend method/path/body/token/customer proof. No legacy confirmation token, service key or browser bearer is used.
- Strict HTTPS destinations are limited to `checkout.stripe.com` for checkout and `verify.stripe.com` for identity. Userinfo, fragments, non-443 ports, credential/token query names, extra DTO fields and URLs containing the handoff nonce are denied. Upstream errors become generic safe errors. Bounded bodies, 5-second upstream abort, 10-second client abort, expiry rechecks, mutation lock and stale route/response guards prevent stuck loading or stale links.
- Continue resolves the customer session, then a native `Open Stripe securely` anchor carries `rel=noreferrer noopener` and `referrerPolicy=no-referrer`. This avoids an async popup and preserves an explicit customer gesture. There is no automatic provider open on GET.
- Parent-owned agent layout already suppresses indexing, inherited marketing previews and referrers; reserved analytics routing excludes `agent`. This implementation adds no nonce/PII logs, localStorage or analytics. Hosting/platform access-log redaction still needs its deployment gate; the local Next harness redacts long opaque strings from process output.
- Managed sign-in return-path policy now also accepts only the exact owned 43-character handoff path, with tests for query/path bypass.

## Canonical interface and pending backend/provider integration

Parent explicitly approved additive authenticated GET review before POST resolution:

`CustomerHandoffReviewResult`: `{api_version:'v1',source_checked_at,ref,operator_name,vehicle_name,action:'identity'|'checkout',status:actual_backend_status,expires_at}`.

`CustomerHandoffResolveResult`: `{api_version:'v1',source_checked_at,action,provider_url,expires_at}`; browser-only, never agent output.

`domain/booking/customerHandoff.ts` now consumes generated canonical backend validators; provisional schemas and their custom validator were removed in `8ad50b9`. Canonical review/resolve/input and customer-status schemas come from integrated backend contract SHA256 `895a3f0664b570eb15ba0022bde15d7fc9bcb2640ebd8ac3605a7bb4f9570ca9`, verified by the generation checker. The backend must independently check current owner/grant/state/expiry and serialize/idempotently reuse provider creation; the BFF deliberately does not assert these checks on its own. Identity delegation is now an explicit customer selection. Actual backend/runtime and Stripe URL/fragments/provider-response parity still require separate integration/test accounts.

## Verification evidence

- RED: boundary suite failed on missing `customerHandoffServer`; actual mounted component suite failed on missing landing module. Commits `dfbcc59` and `3329a16` preserve this evidence.
- GREEN: boundary 18 cases + actual mounted UI 6 cases + hosted OAuth 17 cases = **41 passed**, including unsafe destinations, expired/current sessions, stale response races and hung-client abort. `npx vitest run domain/booking/customerHandoff.test.ts domain/booking/customerHandoffUI.test.ts domain/booking/hostedAuth.test.ts`.
- Combined customer/analytics regression run: **12 files / 172 tests passed** before the final two added nonce-leak/timeout cases; those two passed in the final 41-case affected rerun. `npx vitest run domain/booking/customerHandoff.test.ts domain/booking/customerHandoffUI.test.ts domain/booking/hostedAuth.test.ts domain/booking/hostedProxy.test.ts domain/booking/externalConsent.test.ts domain/booking/externalGrantRecovery.test.ts components/analytics`.
- Full source `npx tsc --noEmit`: passed after all initial implementation and browser fixture additions; repeated with final two boundary/UI cases, passed.
- Real Chromium + real Next SSR/route **4 passed**, final run 8.1 seconds. `PLAYWRIGHT_BROWSERS_PATH='<build-work-root>/browser-cache' npx playwright test --config playwright.agent-handoff.config.ts`. Cases cover missing/valid cookie, SSR review without provider mutation, native provider navigation with absent Referer, wrong customer, expired link, tampered cookie, CSRF/extra-field rejection, retry reuse and separate identity destination.
- Browser transport uses only owned loopback TLS servers, an ephemeral real ES256 key/JWKS, actual source AES-GCM cookies and actual HMAC signed proof validation. It seeds synthetic managed sessions directly; it does **not** exercise a real managed provider login, backend SQL, real revocation, Stripe, delivery or hosting. Browser requests outside the fixture/explicit intercepted synthetic destination are aborted; Next server fetch outside the two fixed synthetic backend/issuer hosts is refused. No production endpoints are configured.
- Playwright 1.63.0 is an exact isolated dev dependency. Chromium/FFmpeg were installed only under the owned build browser-cache. No global install/config change. Runtime certs/artifacts are ignored under `output/playwright`; trace/video/screenshots disabled.
- Existing Vitest configuration excludes only the newly separately-run `tests/agent/*-browser.spec.ts` from Vitest. This preserves explicit browser coverage rather than trying to execute Playwright using Vitest.

## Discovery requiring parent hosting integration

Real Next 14 builds `Request.url` from the internal configured server hostname/port behind the local HTTPS proxy (confirmed in local `next-server.js`), so equality with the public `frontendOrigin` rejected valid customer POSTs. The owned handoff route validates exact configured public Host instead, rejects query additions and requires the exact Origin/CSRF for POST. Four real browser tests prove this behavior. Parent was notified that existing root auth/customer routes need the same hosting reconciliation or an explicit trusted-host deployment contract. No root-owned route was modified here.

## Commits

- `dfbcc59`: RED boundary tests and local Playwright dependency.
- `3329a16`: RED mounted review/continuation/race tests.
- `2964d71`: authenticated SSR review, strict customer bridge, safe continuation, owned sign-in path, final boundary/UI cases.
- `9257a86`: actual Next/Chromium loopback fixture, network isolation and browser runner.
- `1ae490e`, separate authorized 08 warning follow-up: stable generation ref captured for three existing hosted page cleanups; 25 existing mounted tests and ESLint on all six touched/added page/route files passed. No generation semantics weakened.

## Self-Check: PASSED

Required implementation/test/config files and four 14 commits verified. No shared STATE/ROADMAP changes. Parent owns full plan 14 summary and integration acceptance. Original application source checkouts and live systems remain untouched.

## Subsequent assigned release hardening and safe provider return

See [FRONTEND-RELEASE-HARDENING-NOTES.md](FRONTEND-RELEASE-HARDENING-NOTES.md) for exact primary advisory sources, patched dependency decisions, corrected source-map RED, public Host policy across root auth/customer routes, actual synthetic OAuth/browser evidence and residual development-tool findings. Later assigned work supersedes the earlier limitation that root auth/customer routes had not been modified: shared configured-Host enforcement is now implemented and verified through actual local OAuth + consent.

Browser run after the first Next15/React19 upgrade and root baseline merge was **6 passed**. Subsequent canonical integration now has **7 passing browser cases**, including encrypted managed-session creation through actual synthetic OAuth/PKCE, explicit chosen quote-consent scopes, fixed provider return login and actual customer-status BFF routes. Provider return explicitly avoids inferring payment/identity success and now reads the customer-owned status endpoint. Actual backend status authorization/SQL and provider integration remain separate acceptance gates. `provider_parity: false` remains accurate.

## Canonical14 frontend integration

- RED `1c830b1` caught four real gaps in the provisional handoff validator: Stripe root URL and email/booking_ref/authorization query fields. GREEN `8ad50b9` removed that validator and consumes exact generated canonical schemas. Later canonical HTTPS checks also deny decoded credential/receipt query keys; two further regression cases pass.
- RED `a55dd30`, GREEN `8a5e186`: three unchecked customer choices for status reading, customer-hosted checkout and identity verification. At least one unique allowed action must be selected. Consent POST includes precisely selected `action_scopes`; identity is never automatic. Captured handlers cannot submit old scopes after a change, and no documents/payment are submitted by consent. Renewal renders and restores only the original scope set; an expanded completion response is rejected. Auth confirmed managed customer login may request identity resource capability while the booking delegation independently requires the explicit checked scope.
- RED `37420af`, GREEN `74b1415`: actual GET BFF bridge `/api/agent/customer/customers/rental-requests/{safe_ref}` forwards to `/v1/customers/rental-requests/{safe_ref}` with verified managed session and request-bound proof. It consumes canonical `CustomerRentalStatusResult`, binds response ref to request, rejects extra/private/provider fields, sanitizes upstream errors, and never forwards POST to that read route. Backend separately owns current tenant/customer association independent of withdrawn agent grants.
- Actual account return UI checks exact operator/ref, current sign-in and a 60-second status snapshot; stale/mismatched/UNKNOWN data disappears, errors clear loading, and explicit Refresh performs a new customer-owned read. Late old-ref responses are ignored. It shows current server status/next action/hold and payment deadlines with source-check time. Pending settlement/reconciliation stays pending. Return navigation creates no booking, grant, provider session or onboarding record.
- Generation encountered concurrent parent contract updates, so initial SHA `7511c3...` was refreshed to stable integrated mainB `918195f9` / SHA `895a3f...`; final `--check` passed. No manual schema weakening.

Verification at `74b1415`: six selected files **77 passed**; full TypeScript passed; full suite **628 passed, 20 skipped** across93 files with unchanged timeout settings and `--maxWorkers=2`. An earlier default-worker run concurrent with Chromium had one unrelated5-second legacy EmailCapture timeout; the bounded full run passed twice, including after final canonical refresh. Real Next/Chromium **7 passed**. Exact final-revision production mock build **passed** (`output/playwright/canonical14-build-final.log`), with no new frontend lint warnings. All live providers/network remain excluded.

No frontend stubs remain for the assigned handoff/status/scopes paths: every customer read/mutation targets the agreed actual BFF/backend interface. The isolated browser backend is deliberately synthetic, clearly marked test-only, and is not evidence of real backend/provider acceptance. Parent owns global plan14 summary and release gates.

## Customer-owned continuity follow-up

Parent review found that an immutable status-only agent grant cannot later acquire identity or checkout authority by renewal. Customer completion now uses independent managed customer authority instead of expanding that grant.

- Optional canonical `ScopedLinks.customer_account` provides the configured first-party `/agent/account/{operator_id}?ref={safe_ref}` after durable request creation. Frontend accepts exactly that scalar selector; duplicates, unrelated fields, unsafe refs and polluted OAuth return paths are rejected. The encrypted managed sign-in preserves the exact owned selector. Initial request view says `Your rental request`; the fixed provider-return path still explicitly avoids inferring success.
- A fresh exact operator/ref/status snapshot and unexpired managed session expose an explicit `Create secure identity link` or `Create secure payment link` only for the corresponding backend next action. The BFF POSTs to `/v1/customers/rental-requests/{ref}/identity-handoff` or `/checkout-handoff` with precisely `{action:'continue'}`, actual resource bearer and request-bound customer proof. Browser CSRF is verified and stripped; customer identity/agent/grant selectors are rejected. These customer-owned actions create no booking or agent grant.
- Canonical `IdentityHandoffResult`/`CheckoutHandoffResult` creation response201 is validated before a native first-party nonce link appears. Foreign/provider URLs, query/fragment/userinfo, malformed43-character nonce paths, stale source checks, expired links and private extra fields are rejected. Further review and explicit Continue use the existing provider broker. GET never creates a provider session or customer link.
- Actual mounted tests cover double clicks, expired status, captured handlers after request changes, late link responses after navigation, expiry and unsafe response fields. A browser-discovered pre-hydration continuation race has a meaningful failing SSR test; the server-rendered button is now disabled until the client lifecycle is initialized.
- Canonical generator final source SHA256 is `0af821208b85743c579bc69873d84d2ffa935871d3263ab334663bc31f1a5a3d` after parent integrated optional account links and both documented customer handoff paths. `--check` passes; no hand-authored weakening.

Commits: `ad2726c` boundary RED; `f4b9f83` bridge GREEN; `39efa07` mounted RED; `972b287` customer controls GREEN; `5fe6b86` browser continuity RED; `85d5cc8` pre-hydration RED; `ee5c321` final lifecycle fix, canonical generation and browser fixture GREEN. All commits and created files were checked; the frontend worktree is clean.

Final verification: **652 passed /20 skipped across94 files** using unchanged test timeouts and `npm test -- --maxWorkers=2`; full `npx tsc --noEmit` passed; **9 actual Next/Chromium tests passed** in19.2seconds; production `NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock npm run build` passed. Build reports only existing font/image/caniuse warnings. Browser fixture includes the actual first-party account link shape and synthetic original status-only delegation, actual managed login/proof/CSRF, and customer actions. It still uses synthetic backend/provider behavior, so database ownership/revocation/replay/provider acceptance must be proven separately by parent integration. No live services, credentials, source originals or global configuration were changed.

## Explicit nonce recovery and provider compatibility follow-up

The independent review's nonce-only recovery gap is now implemented. Canonical409 errors preserve only `grant_expired` and `grant_revoked`; all messages, details and other codes remain sanitized. SSR review passes the safe recovery state, and a later explicit resolve409 enters the same state. Fresh authenticated customers see `Review agent access`; this makes one CSRF/Origin-bound POST to `/api/agent/customer/customer-handoffs/{nonce}/grant-renewals` with precisely `{csrf,action:'continue'}`. Server forwards action-only JSON under current managed bearer and exact signed customer proof. GET never starts a renewal.

Creation must return201 canonical `GrantRenewalResult` in `authorization_required` state, without `grant_id`, with an unexpired exact first-party `/agent/authorization/{returned-renewal-UUID}` URL. Unsafe/mismatched/query/fragment URLs, automatic authorized results and secret fields are refused. A native no-referrer link opens the existing renewal review; only the customer's further explicit consent authorizes original stored client/scopes. Revoked IDs remain revoked. Mutation lock, session/nonce rechecks, timeout abort and generation checks prevent duplicate/stale/late renewal links.

Backend canonical provider format now accepts the narrow documented bounded Checkout `#fidkd` opaque fragment unchanged, while identity fragments, poison fragments, credential/receipt queries and generic first-party fragments remain denied. Frontend uses the generated authoritative validator; no custom provider relaxation. Both unit and actual browser native href/no-referrer checks retain the fragment. This reproduces the documented URL shape in a synthetic fixture, not real Stripe provider acceptance.

Commits: `eb6307d` boundary RED; `71ad60c` safe BFF/renewal validation GREEN; `c281fd5` mounted recovery RED; `94c49e6` explicit controls GREEN; `26ca81c` browser/fragment RED; `ce44f37` final canonical/fixture GREEN. Exact generator SHA256 `7cc0779f647906c58b937e4e0c99bb8c46d7b54231adc5ecfdf0994a1fde5af5`, checker passed.

Final checks at `ce44f37`: **665 passed /20 skipped across94 files**, full TypeScript passed, **12 actual isolated Next/Chromium cases passed** in22.8seconds, production mock build passed with existing warnings only. Browser cases cover expired/revoked SSR entry, no automatic renewal/consent, explicit pending creation, exact original agent/scopes, a separate explicit consent click, later resolve revocation, and all earlier customer continuity cases. Mounted tests add captured expired/old-nonce recovery handlers, late response hiding and10second hung-recovery abort. All worktree files/commits were checked; source worktree clean. Backend/provider/hosting acceptance remains separately gated.
