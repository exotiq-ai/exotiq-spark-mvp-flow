# IMPROVEMENTS — app.exotiq.ai audit

## Executive summary
Exotiq is a ~115k-LOC Lovable-generated React/Vite/TS + Supabase operator SaaS (fleet bookings, Stripe billing + holds, margin module, voice agent "Rari"). It arrived with **zero CI, 64 ad-hoc tests, a 2.65 MB single-chunk bundle that every page downloaded, an unprevented double-booking path, three contradictory definitions of the platform fee, and several service-role edge functions that trusted caller-supplied identity.** This audit added a CI gate + smoke harness (64→**194** tests) and shipped **6 reviewable PRs** that close the double-booking client gap, harden three open edge functions, cut the critical-path bundle ~84%, fix 11 UI/accessibility defects, and patch a critical dependency RCE — all green in CI, nothing pushed to `main`, production never touched. The three most important items now needing **Gregory's decision** (in `FLAGGED.md`): (1) the two **CRITICAL** server-to-server functions `elevenlabs-tools` / `rari-mcp-server` (identity-from-body over service role — flagged, not built, because hardening changes an external integration contract that can't be tested here); (2) a **DB-level** double-booking constraint (the only authoritative fix for the race); (3) the **platform-fee** inconsistency (Stripe charges 20% while the margin engine uses a configurable 10%).

> Environment caveat: no local database was available (the network policy blocked the Supabase/Postgres image CDN and Docker Hub), so `supabase start` was impossible. RLS, edge-function, and load findings are static-analysis-based with confidence stated per finding; the hosted Supabase instance (production, Lovable-managed) was never contacted. Edge-function code fixes are logic-reviewed + call-site-verified but **not runtime-verified**.

## Baseline → now
| | Before (main) | After (PRs) |
|---|---|---|
| CI | none | GitHub Actions: lint (informational) + typecheck + tests + build on every PR |
| Tests | 64 (ad hoc) | **194** (bugs branch) / 178 (uiux) — smoke harness for booking conflicts, fee/payout math, auth, routing |
| Main JS chunk | 2,647 KB / 766 KB gz, loaded on every route | entry **3 KB**; vendors 53+63 KB gz with the shell; charts (104 KB gz) + xlsx (143 KB gz) lazy |
| Critical dep advisories | 1 (vitest RCE) | **0** |
| Double-booking | no guard anywhere | client submit guard (PR #13); DB constraint flagged |
| Open paid/IDOR edge fns | 3 unauthenticated | hardened to require verified JWT (PR #12) |

## Changes by category (one PR per category, all stacked on PR #1, base `main`)

### PR #1 — Test harness + CI · `audit/test-harness` @ af5f381 → [PR #11](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/11) · CI ✅
- `.github/workflows/ci.yml`: lint (non-blocking until the 737-error `no-explicit-any` backlog is paid down), typecheck, full test suite, build — on every PR/push to main.
- `test`/`test:watch`/`typecheck` scripts.
- Smoke harness +111 tests (64→175): `conflictDetection.test.ts` (45), `pricingUtils.edges.test.ts` (29), `partnerStatement.edges.test.ts` (18), `auth.smoke.test.tsx` (13), `routing.smoke.test.tsx` (6). Behavior-pinning tests labeled `[current behavior]`; two documented real bugs later fixed.
- jsdom 20→25 (20 is incompatible with react-dom 18.3 controlled inputs; test-only).

### Security · `audit/security` @ 961d624 → [PR #12](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/12) · CI ✅
- `demo-login`: removed hardcoded `demo123456` fallback → fail closed (503) without `DEMO_PASSWORD`.
- `generate-hero-image`: require verified JWT (was fully open: paid Gemini generation + service-role storage writes).
- `rari-email-summary`: require JWT + enforce conversation ownership (closes IDOR that emailed any transcript to any recipient).
- The two CRITICALs (`elevenlabs-tools`, `rari-mcp-server`) flagged with a precise proposal, not built (external integration contract, untestable here).

### Bugs · `audit/bugs` @ 948fad0 → [PR #13](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/13) · CI ✅ — 175→**194** tests
- **BUG-1 (CRIT)** double-booking: `NewBookingDialog.handleSubmit` now rejects overlapping bookings via the new `hasBlockingOverlap()` half-open predicate. DB-level constraint flagged.
- **BUG-4 (MED)** ICS export emits UTC (`Z`) instead of floating local time — no more cross-timezone shift.
- **BUG-7 (LOW)** `calculateBookingTotal` clamps negative discounts to 0 (was inflating the total).

### Performance · `audit/performance` @ 81ba529 → [PR #14](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/14) · CI ✅
- Route-level `React.lazy` + `Suspense` (P1); dynamic-import `xlsx` (P2); `manualChunks` vendor split (P6).
- Critical-path JS 766 KB gz → ~60–115 KB gz; charts + xlsx now load only where used.

### UI/UX Lane-1 · `audit/uiux` @ a34ae8e → [PR #15](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/15) · CI ✅ — 175→**178** tests
- 11 FIX-DIRECT items: dead `/features` route→anchor, wrong post-onboarding navigate, stub PWA icon→valid SVG, aria-labels on bell + chat (desktop & mobile), `tabIndex` 1→0, phantom keyboard shortcuts removed, dead `href="#"` links neutralized, real meta description, fixed default og-image, **confirm-password + match validation** on signup (+3 tests).
- Lane-2 visual changes → `LOVABLE-PROMPTS.md` (11 prompts). Lane-3 → `FLAGGED.md`.

### Dependencies · `audit/dependencies` @ 801557f → [PR #16](https://github.com/exotiq-ai/exotiq-spark-mvp-flow/pull/16) · CI ✅
- vitest ^3.2.4→^3.2.6: resolves the **CRITICAL** dev-server RCE (critical 1→0).
- Moved 6 test-only packages to `devDependencies`.
- Blanket `npm audit fix` declined (117-pkg churn, 0 advisories resolved — needs majors); remainder flagged.

## Analysis artifacts (this branch, `/audit/`)
`security.md`, `observability.md`, `bugs.md`, `performance.md`, `refactors.md`, `features.md`, `code-quality.md`, `dependencies.md`, `uiux.md`, `plan-stress-tests.md`, `TRIAGE.md`, `CHECKPOINT.md`. Companion deliverables at repo root: `FLAGGED.md`, `LOVABLE-PROMPTS.md`.

## Phases not fully run (honest status)
- **Phase 5 (load/concurrency):** no DB/server available → no live load test. The double-booking race was addressed at the client layer (PR #13) and the authoritative DB constraint is flagged; concurrency reasoning is in `bugs.md`/`FLAGGED.md`. Live k6/autocannon runs remain TODO once a dev DB is reachable.
- **Small features / refactors / code-quality auto-fixables:** lower triage priority; not implemented this session. Refactor candidates (pre-screened) are in `refactors.md`; the eslint auto-fixables and `any`-backlog remain in `code-quality.md`. CI keeps lint informational so this is visible without blocking.
