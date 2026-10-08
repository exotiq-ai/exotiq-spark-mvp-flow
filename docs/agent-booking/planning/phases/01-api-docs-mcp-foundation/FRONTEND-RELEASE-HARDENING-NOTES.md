---
phase: 01-api-docs-mcp-foundation
status: local-release-hardening-verified-integration-pending
completed: 2026-10-07
provider_parity: false
---

# Frontend release hardening notes

Configured public Host validation fixes actual reverse-proxy customer sign-in/consent; patched Next 15, React 19 and narrowly overridden PostCSS pass isolated production build and real browser tests.

This adjunct records assigned hardening and plan 14 return prerequisites. It does not mark any hosted/provider acceptance complete, and does not change shared planning state.

## Public origin boundary

`publicHostedUrl` validates raw Host against the configured HTTPS frontend authority, exact route pathname and explicitly allowed single query selectors. It reconstructs the public URL from configured frontendOrigin, pathname and search. Neither internal `Request.url` origin nor forwarded host/protocol headers grant authority. POST still requires exact public Origin, encrypted current managed session and CSRF. All auth, customer and handoff routes use this shared boundary; callback reconstruction preserves issuer/state/code validation. This fixes real Next internal loopback Request.url behind an HTTPS proxy without trusting caller-controlled forwarded headers.

RED `7d7797b` exercised valid internal URL/public Host, foreign Host/forwarded spoof, unknown/duplicate query and wrong path. GREEN `ed2e0c4` applied the shared policy and added a real local managed OAuth roundtrip: actual encrypted transaction/session cookies, ES256 ID/access JWTs, JWKS, state/nonce/PKCE and exact resource/callback, followed by quote BFF read and explicit consent. Fixtures are test-only, synthetic, loopback and deny other network. Actual upstream identity provider, backend SQL and Stripe remain untested here.

## Dependency decisions and primary evidence

- `next` and `eslint-config-next` exactly **15.5.27**: official [15.5.27 release](https://github.com/vercel/next.js/releases/tag/v15.5.27) includes fixes beyond the initial proposed 15.5.24. Official [AVIF image decoder advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) fixes the affected old framework branch at 15.5.24. Registry metadata was checked before installation; no forced audit remediation.
- Official [support policy](https://nextjs.org/support-policy) currently lists 15 as Maintenance LTS and 14 as unsupported. Its stated two-year maintenance window from 15's October 21, 2024 release implies a near-term support deadline; **recheck framework support/advisories before hosting, and plan supported-major maintenance**. This patch candidate is not permanent support assurance.
- React and React DOM exactly **19.0.8**, matching major-19 type packages, per official [Next 15 App Router upgrade requirements](https://nextjs.org/docs/app/guides/upgrading/version-15). Server params/searchParams/cookies now await promises; client owned pages use React `use`. Relevant direct component fixtures and asynchronous OpenGraph assertions were adapted without dropping their behavior checks.
- Next 15.5.27 still declares exact PostCSS 8.4.31. Direct PostCSS **8.5.29** plus scoped `overrides.next.postcss = "$postcss"` ensures actual Next resolution uses the patched parser. Official [PostCSS source-map advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) fixes the vulnerable read behavior at 8.5.23; [8.5.29 release](https://github.com/postcss/postcss/releases/tag/8.5.29) is the verified current patch. Actual `createRequire(next/package.json)` resolution is tested.
- PostHog direct version remains 1.433.10. Its compatible DOMPurify lock entry moves to **3.4.16** per official [advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-6688-9rhm-gjv2) and [release](https://github.com/cure53/DOMPurify/releases/tag/3.4.16).
- `outputFileTracingRoot: __dirname` prevents Next 15 from inferring a home-directory lockfile as tracing root. Removed obsolete swcMinify option; added required ES2017 target. One existing privacy navigation uses Next Link to satisfy the matching framework lint rule. No compiler/lint checks were disabled.

Meaningful source-map RED is **de9f1a2**: old actual Next PostCSS read an owned fake external map's marker into `PreviousMap.text`. Earlier `a8b761e` only checked a generated empty composed map and was insufficient RED evidence; the corrected test checks both input-map and output-map data using real mappings. No real private files were read. GREEN **e4281b1** passed after reproducible `npm ci`; `npm ls` confirms actual Next PostCSS 8.5.29, DOMPurify 3.4.16 and deduplicated React 19.0.8. The package manager recreated only this worktree's owned dependencies; no originals or global configuration changed.

## Audit results and remaining tooling issues

At verification time, original saved audit had 21 findings including one critical. Candidate **production audit reports 0 findings**. Full candidate audit still reports **15 development-tool findings: 11 high, 4 moderate, 0 critical**. Exact ignored artifacts are `output/playwright/dependency-audit-production.json` and `dependency-audit-candidate.json` in the assigned worktree.

Remaining affected package paths: Vitest/@vitest/mocker, baseline-browser-mapping, brace-expansion/braces, browserslist, chokidar/fast-glob/micromatch/picomatch, js-yaml, postcss-selector-parser/Tailwind and ESLint's transitive Next plugin chain. These affect tooling/build input; production audit exclusion does not make them harmless. They require an explicitly reviewed maintenance follow-up. Parent declined broad forced audit remediation in this task. No claim of an entirely clean dependency tree is made.

## Fixed provider return prerequisite

RED **b777cef**, GREEN **d5356f2** implement `/agent/account/{operator_uuid}?booking_ref={safe_ref}&action=identity|checkout`. Exactly two scalar selectors are accepted; ref is 1..80 safe unreserved characters. Extra fields, duplicate arrays, wrong actions, traversal, fragments and token query additions fail closed. Managed login transaction preserves only that exact canonical destination. Ordinary empty-query account onboarding remains explicit.

Actual account return UI is separate from account linking, displays a generic return receipt and explicitly says return navigation does not confirm payment or identity verification. No provider URL is persisted and no new session is created by returning. After fresh customer sign-in it displays the public request reference; missing/expired sign-in preserves the validated return query. Actual customer-owned status read awaits the backend canonical `CustomerRentalStatusResult` and real `/v1/customers/rental-requests/{ref}` implementation independently authorized from withdrawn agent access. This generic interim page is not proof of payment completion; parent tracks integration.

## Verification

- `npm ci --ignore-scripts --no-audit --no-fund`: passed; actual dependency tree valid.
- `npx vitest run` selected framework/hosted runtime/auth/proxy/handoff/consent/recovery files: **81 passed** after framework upgrade; provider-return/hosted-auth/recovery rerun: **44 passed**.
- `NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock npm run build`: **passed**, including framework lint/type checking and 21 static pages. Mock profile uses no live Supabase/OIDC/Stripe URLs. Existing image/font warnings and old caniuse data remain documented baseline warnings.
- Full `npx tsc --noEmit`: passed after upgrade and again after provider-return implementation.
- Real Chromium/Next browser run: **6 passed** after root merge and provider-return changes. Includes actual synthetic managed OAuth callback and consent behind HTTPS proxy; anonymous/current/tampered cookie; wrong customer/expiry; read without mutation; CSRF/extra-field denial; retry provider-session reuse; identity vs checkout URL; native navigation without Referer; safe provider return through actual login and polluted-query rejection. No trace/video/screenshots or real provider traffic.
- Merged root approved baseline changes `8c8b7f5` cleanly in **65b8e07**. Full Next15 suite at that boundary: **554 passed, 20 skipped, 8 failed** in five files. Remaining failures were explicit dependency/source-digest fences and React19 server image preload/srcset byte differences in old storefront goldens. Parent owns reviewed amendments; planted visual-change controls must remain. No goldens were blindly replaced and no tests disabled. Log: `output/playwright/next15-full-suite.log`.

## Commits and limits

`7d7797b` public origin RED; `ed2e0c4` Host fix/real OAuth browser; `a8b761e` initial source-map test; `de9f1a2` corrected source-map RED; `e4281b1` patched framework/dependencies and minimum compatibility; `65b8e07` root approved baseline merge; `b777cef` fixed-return RED; `d5356f2` fixed-return UI/login GREEN.

Plan 14 canonical handoff schema generation, explicit identity action-scope disclosure, current customer-owned return status and actual backend integration remain separate required work. No hosted/provider acceptance, deployment, live account access or original-source write occurred.

## Self-Check: PASSED

Owned implementation/tests and listed commits verified present; worktree clean at d5356f2. Actual build/type/browser results inspected. Parent owns remaining fences and overall acceptance.

## Assigned React19 historical-markup compatibility follow-up

Exact storefront diff proved unchanged image URLs/srcSet widths/order, one new hero preload, reordered form/input attributes and a **real removal of `fetchpriority=high`** by Next15. Parent explicitly authorized restoring `fetchPriority="high"` on the existing priority storefront hero before normalizing comparisons. The priority loss was not hidden.

RED **e4d49b2** ran the new comparator as pass-through and produced two behavioral failures (equivalent serialization and actual Next image). GREEN **4e28969** restores the hero hint and adds comparison-only normalization under tests/protect. It accepts only a leading image preload whose exact escaped srcSet/sizes match a still high-priority image. Extra, mismatched or duplicated preload fields stay visible. It sorts form/input/img attributes without changing values and folds only fetchPriority casing; unrelated tags, scripts/templates/textareas/comments, malformed and duplicate attributes remain unchanged.

Twenty normalization tests include planted class, changed URL/width/descriptor/candidate order, removed/lowered priority, input value and form destination; all still compare unequal. Historical class-edit comparator control remains. Original recorded goldens, provenance digests and recording gate remain untouched.

`npx vitest run tests/protect`: **39 passed, 2 skipped** (intentional recorder skips), seven files. Full TypeScript passed. Parent retains ownership of package/frozen-source amendment review and full-suite acceptance. Added review sourcepin `app/[operatorSlug]/page.tsx` SHA256 `5a1673d8ba7fc0849a3441a073859eeccc959b7a6b9a160cf1515a56c3b2079e`.
