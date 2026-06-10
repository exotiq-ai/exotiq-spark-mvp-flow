# TRIAGE — Consolidated, prioritized

Priority order (spec §Phase 3): security > data-integrity > functional bugs > performance > UI/UX > dependencies > small features > refactors > code quality.

Environment reality: **no local DB** (CDN/registry blocked), so edge-function and RLS changes cannot be runtime-tested here — they're verified by static reasoning + call-site inspection, and CI covers the frontend/unit layer. Stripe stays test mode. Schema changes = migration files only, never applied.

---

## FIX NOW (this session) — by category branch

### audit/security
- **SEC-1 (CRIT)** `elevenlabs-tools` — service-role + identity-from-body fallback chain, never 401s. Harden: require verified JWT, drop body/demo fallbacks for data reads. *Verify frontend passes JWT via `functions.invoke`.*
- **SEC-2 (CRIT)** `rari-mcp-server` — opt-in auth, spoofable `x-user-id`, "first user" fallback. Harden identity; require secret/JWT.
- **SEC-3 (HIGH)** `generate-hero-image` — fully open, paid Gemini + service-role writes. Require auth.
- **SEC-4 (HIGH)** `rari-email-summary` — open IDOR + arbitrary-recipient email. Require auth + ownership check + recipient = caller.
- **SEC-5 (MED)** `demo-login` — hardcoded fallback password `demo123456`. Remove fallback; require `DEMO_PASSWORD`.
- Note: edge-function fixes land on audit/security but are flagged as **not runtime-verified** (no Supabase here); each is a contained auth-gate addition with call-site confirmation.

### audit/bugs (data-integrity first)
- **BUG-1 (CRIT)** Double-booking unprevented. This session: (a) enforce `checkBookingConflicts` at submit in `NewBookingDialog.handleSubmit` + test; (b) **FLAG** the DB exclusion constraint/trigger (migration on core booking table — Lovable territory).
- **BUG-2 (HIGH)** Platform fee hardcoded 20% in Stripe vs configurable 10% in margin engine. Centralize fee constant/util + test; reconcile the gate list. (Real Stripe `application_fee` change → coordinate; see FLAGGED.)
- **BUG-3 (HIGH, data)** Historical inverted split — **FLAG** (touches already-paid rows; needs finance decision).
- **BUG-4 (MED)** ICS floating-time TZ shift — fix + test.
- **BUG-6 (MED)** Webhook TOCTOU + 64-bit hash UUID → SHA-1 v5 UUID (R7) + idempotency note.
- **BUG-7 (LOW)** Negative-discount inflation — clamp + test.
- BUG-5 (MED, presence channel) and BUG-8 (margin %) → bugs branch if budget; else flag.

### audit/performance
- **P1** Route-level code-splitting (lazy + Suspense in App.tsx) — biggest win on 2.65MB chunk.
- **P2/P3** Dynamic-import `xlsx`; lazy-load `framer-motion`-heavy routes where easy.
- **P6** `manualChunks` for vendor split. Verify build + suite green.

### audit/uiux (Lane 1 FIX-DIRECT only)
- FD-01 dead `/features` route; FD-03 stub logo / missing favicon+og-image; FD-02 wrong post-onboarding navigate; FD-11 confirm-password; FD-06 `tabIndex={1}`→0; FD-04/05 aria-labels; FD-07 phantom keyboard shortcuts; FD-09/10 meta description + og-image; FD-08 `href="#"` dead links.
- Lane 2 → LOVABLE-PROMPTS.md. Lane 3 → FLAGGED.md.

### audit/dependencies
- `npm audit fix` (patch/minor only) — vitest→3.2.6+ (the critical), router/rollup/etc.; suite must stay green.
- Move vitest/@testing-library/jsdom/@types to devDependencies; `react-is`→18.3.1.
- xlsx CVE (no patch) → mitigation note in FLAGGED (or dynamic-import isolation via P2).

### audit/code-quality (last)
- `eslint --fix` auto-fixables (12) only; the 737-`any` backlog stays informational.

---

## FLAG FOR GREGORY (FLAGGED.md)
- DB-level double-booking prevention (exclusion constraint/trigger migration).
- BUG-3 inverted-split remediation of paid rows.
- Real Stripe `application_fee_amount` fee correction (finance sign-off).
- Edge-function auth hardening **deployment** (Lovable/Supabase deploy + secret config: MCP_SECRET_TOKEN, DEMO_PASSWORD, APP_URL/FRONTEND_URL).
- No error tracking (Sentry) — observability HIGH.
- `logger.ts` no-op in production.
- Dual toast systems (use-toast + sonner) consolidation.
- Doc cleanup: ~100 stale root markdown files (archive list in plan-stress-tests.md).
- Major dependency bumps (React 19, Vite 6, etc.).

## WON'T FIX (this session, with reason)
- 711 `no-explicit-any` lint errors — bulk type refactor, out of scope, informational in CI.
- 357 console.* → logger migration — large, judgment-heavy.
- Structural refactors R3/R6/R9 — flagged.
