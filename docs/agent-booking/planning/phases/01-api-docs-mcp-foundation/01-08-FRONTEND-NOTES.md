---
phase: 01-api-docs-mcp-foundation
plan: "08"
subsystem: hosted-customer-frontend
tasks: [1, 3]
tags: [customer-consent, recovery, generated-contracts, csrf, react]
requires:
  - plan: 01-03
    provides: verified issuer-subject customer links and scoped grants
  - plan: 01-04
    provides: exact quote snapshots
  - plan: 01-08-server
    provides: root-owned managed OIDC/BFF and backend-owned consent/recovery endpoints
provides:
  - actual customer quote review and explicit authorization page
  - actual expired/revoked grant recovery, current-grant revocation and explicit account-linking pages
  - pinned generated canonical schema/validator and drift check
affects: [01-10, 01-11, 01-14, 01-15]
key-decisions:
  - Customer JS receives a CSRF value and safe profile, never bearer tokens or consent receipts.
  - Names and prices are validated canonical backend response data rather than partial frontend casts.
  - Revocation targets the new active grant after renewal, otherwise the prior grant; neither cancels the booking.
  - Operator account linking requires verified signed provider email and an explicit customer click.
  - Agent customer pages are excluded from analytics and search/preview metadata.
duration: 17min
completed: 2026-10-07
implementation-status: complete-local-frontend
operational-status: partial
---

# Phase 1 Plan 08: Frontend consent and recovery adjunct Summary

Mounted customer pages now display complete canonical rental terms, record explicit quote-bound authorization, recover only existing status/payment scope after fresh sign-in, and link operator customer records using verified provider identity.

## Scope and provenance

This adjunct covers assigned **tasks 1 and 3** plus the explicitly approved operator account-linking page. Root combines this with task 2 backend consent/recovery and root-managed OIDC/server BFF results in the main 01-08 summary. Shared STATE/ROADMAP/REQUIREMENTS remain root-owned.

All implementation and tests ran in `<LOCAL_BUILD_ROOT>/frontend-consent-worktree`, branch `codex/agent-booking-consent`, starting at `aa51dde4` with integrated 16/13. Root-owned server commits interleave on the same branch by explicit disjoint file ownership. The executor never changed root crypto, BFF or API routes. Original frontend/backend remain read-only. No credentials, live API calls, deployment, push or global modification occurred. Tests use synthetic session/provider boundaries and mocked fetch; an unowned URL throws.

## Executor commits

| Task | Commit | Result |
| --- | --- | --- |
| 1 RED | `89ccc3d` | Actual consent page tests failed to resolve the not-yet-built page/contract modules. |
| 1 GREEN | `83b5089` | Eight mounted consent/validator cases passed; canonical quote review and explicit CSRF-bound action implemented. |
| 3 RED | `1e758c9` | Actual recovery/account tests failed to resolve not-yet-built routes. |
| 3 GREEN | `9958bd5` | Existing-booking scope recovery, explicit new delegation, revoke and verified-email account-link pages implemented. |
| Privacy/cancellation | `00ef1e5` | Customer metadata, loading timeout evidence, account callback freshness and generated-contract drift check. |
| Final integration | `e8dfeda` | Canonical current-grant revoke reference, stale-route/terms checks, refreshed upstream generated validation. |

Root's independent server commits (`a1b155b`, `5597406`, `7a1d1f3`, `5027102`) are not executor task commits and are reported separately by root.

## Delivered behavior

- `/agent/consent/{quoteId}` first checks the managed server session, then reads only the owned quote via same-origin BFF. It shows operator/vehicle names, agent client, exact offset timestamps and timezone, expiry/no-hold disclosure, all itemized charges, daily pricing and percentages, separate operator/Exotiq charge schedule, separate deposit, pickup/cancellation/mileage/protection disclosures, and pending operator approval/customer-hosted payment language.
- **Authorize rental request** posts only CSRF plus the exact terms hash and `rental_requests:create` action. Receipt retrieval stays server-to-server. Missing, malformed, wrong-ID, expired, changed or UNKNOWN-shaped authority cannot authorize. Error responses clear the trusted review and require review again; private server errors are not rendered.
- `/agent/authorization/{renewalId}` shows the existing booking/request status, dates/timezone, agent and exact limited scopes, hold/payment deadlines and review expiry. Expired browser identity requires fresh sign-in before reading private recovery data. Recovery posts fresh CSRF-bound review then explicit scope completion; it does not create a rental or extend a hold.
- Revoked prior access remains revoked and renders a distinct **Authorize new agent access** control. Active access is revoked through the canonical `grant_id_to_revoke`, including a newly created grant after renewal; no token/receipt reaches browser JS. Revocation says the booking is not cancelled.
- `/agent/account/{operatorId}` displays the provider profile email as read-only identity context and collects display name/phone. It creates no record on mount. **Link my customer account** is an explicit authorization; frontend sends only operator/contact fields, consent and CSRF. Missing or unverified provider email disables linking. Root BFF derives email ownership exclusively from signed profile proof, independently of this UI. New-account identity-verification caution is disclosed.
- All consequential handlers use synchronous locks and current route/state/expiry checks. Generation guards discard late responses after route replacement. Existing displayed dates/status/deadlines/scopes must match the server's fresh review before renewal completion.
- `app/agent/layout.tsx` forces dynamic customer pages, noindex/nofollow/noarchive/nocache metadata, no-referrer, and clears inherited OpenGraph/Twitter previews. Analytics policy reserves the entire `agent` route prefix; these pages emit no analytics events, store no receipts/tokens and use no local/sessionStorage.
- Same-origin customer fetches are uncached, forbid redirects and abort after ten seconds. A hung session request releases loading and reveals no quote. Root BFF separately bounds upstream operations and protects cookie/session/origin/CSRF identity.

## Canonical contract handoff

`domain/booking/externalContracts.generated.ts` is generated from the canonical backend schema/validation section, pinned to full backend source SHA256:

`28ddb0bd09fb2f225959e80ee744ff72c9e55b4dce69ceec4f96cab330e298b6`

Source at verification: `../plan-08-worktree/supabase/functions/_shared/external-booking/contracts.ts`, backend commit `f0983fb3` confirmed clean by its owner. Runtime uses canonical `QuoteReviewResult`, nested `QuoteResult` cross-field invariants, `CustomerConsentResult`, `GrantRenewalReviewResult` and `CustomerOperatorLinkResult`. Quote arithmetic, complete disclosures, payment schedule and timestamps are validated, not merely typed.

Generator intentionally excludes server-only cursor signing/OpenAPI generation and deterministically replaces `0n` with equivalent `BigInt(0)` for the frontend's existing TypeScript target. No project target was changed. Run from frontend worktree:

`node scripts/generate-external-contracts.mjs <reviewed-backend-contracts.ts>`

`node scripts/generate-external-contracts.mjs <reviewed-backend-contracts.ts> --check`

The check actually rejected drift when backend nested quote validation changed during integration, then passed after regeneration. Root plan 11 should own canonical regeneration after backend/schema/OpenAPI changes and use the integrated backend path. The SHA pins the entire source, so even later server-only changes require an explicit regeneration/check.

## Verification

Final executor affected command:

`npx vitest run domain/booking/externalConsent.test.ts domain/booking/externalGrantRecovery.test.ts components/analytics`

**8 files passed, 125 tests passed**, including **25 new mounted UI/runtime cases** and the analytics suites. `npx tsc --noEmit --incremental false` **passed** across all source/components. The canonical generator `--check` **passed** at the pinned SHA. An earlier broader command including root `hostedAuth.test.ts` passed 134 tests across 9 files before root's final independent key-separation check; root owns final server verification.

At final handoff, separate root-owned `hostedAuth.test.ts` and `hostedProxy.test.ts` also **passed 24 tests across 2 files**, including root's subsequent key separation and mismatched signed identity response checks; full TypeScript checking passed again with those final source/test changes. Those server changes remain root-owned and are not counted as executor UI implementation.

UI coverage includes exact disclosure/charge rendering, explicit quote/hash/CSRF consent with no receipt, sign-in before quote fetch, malformed/UNKNOWN/wrong quote/incorrect arithmetic denial, captured-handler expiry, cross-owner 404 and changed-terms safe failures, request races, route replacement, metadata privacy and actual fetch abort. Recovery coverage simulates 25-hour and 71-hour elapsed time: old session cannot view private booking, a new synthetic signed-session boundary enables explicit existing-request recovery with original hold/payment deadlines. Additional cases cover revoked/new delegation, elevated scopes, verified-email linking only on click, absent provider email, current-grant revocation and expired captured callbacks. Real pages and real service helpers are mounted; only server/provider/network boundaries are mocked. These tests are React DOM/jsdom evidence, not a real managed-provider browser journey.

## Deviations

1. **Rule 2 — Necessary identity onboarding:** Root explicitly added the account page to assigned ownership. Without verified per-operator customer linking, a new agent customer cannot reach quote consent safely. Linking sends no browser email identity assertion. No auto-registration occurs.
2. **Rule 2 — Generated canonical validator:** Added generated artifact and repeatable generator/check script. Copying the complete backend module initially failed frontend compilation because server cursor types and BigInt literal target differ. The schema/validator section and deterministic literal transform preserve validation while excluding server-only code. No schema or compiler weakening occurred.
3. **Rule 2 — Customer workflow privacy:** Root explicitly requested shared layout privacy metadata; the existing tracking reserved-route list needed `agent` to prevent tenant-style events on short `/agent` paths.
4. **Rule 1 — Current-grant revocation handoff:** Backend first provided only `previous_grant_id`; that cannot revoke the new active grant after renewal. Coordinated canonical `grant_id_to_revoke` and verified actual UI targets new access. No extra bearer authority is exposed.

## Remaining gates

Managed provider configuration/issuer compatibility, real browser fresh-login/PKCE journey, backend route and SQL integration, full staging provider/two-leg payment acceptance, opt-in and rollout provenance remain root gates. User requested isolated local tests because no dedicated hosted staging exists. This adjunct does not claim provider acceptance or complete plan 08 independently of task 2.

First-time agent flow must surface the owned `/agent/account/{operator_id}` handoff before quote creation. Root confirmed API's 401 onboarding Link header and MCP 10 preservation work; generic quote-error UI does not invent an operator ID or arbitrary redirect.

## Known Stubs

None in delivered frontend paths. Provider sign-in remains deliberately unavailable until root's managed OIDC configuration is supplied; no local/mock identity fallback authorizes customer operations. Every customer page calls the actual BFF session and owned API routes, not a placeholder service.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: customer-linking | app/agent/account/[operatorId]/page.tsx | New explicit operator customer association UI; authenticated verified provider identity remains server-owned, fields cannot choose issuer/subject/email ownership. |
| threat_flag: generated-validation | domain/booking/externalContracts.generated.ts | Canonical runtime validation crosses backend/frontend contract boundary; source SHA and drift check enforce regeneration. |

## Self-Check: PASSED

All four route/layout files, three handwritten domain modules, generated artifact/generator and both named test files exist. Six executor commits resolve on the shared isolated branch. Executor files are committed; root-owned concurrent changes were not reverted or staged. Final affected tests, complete type check and canonical drift check passed. Operational acceptance remains partial pending the listed gates.
