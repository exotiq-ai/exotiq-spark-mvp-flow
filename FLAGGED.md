# FLAGGED — items needing Gregory's decision

Each item: context · recommendation · estimated effort. Ordered by severity. Detailed evidence lives in `audit/*.md`. Nothing here was changed in code; these either exceed the "~15-minute human review" bar, touch production/external contracts, involve money/business policy, or need a runtime this environment didn't have.

Environment caveat (applies throughout): this audit ran with **no local database** — the network policy blocked the Supabase/Postgres image CDN and Docker Hub, so `supabase start` was impossible. All RLS, schema, and edge-function findings are **static analysis** (migrations + `src/integrations/supabase/types.ts` + source), confidence stated per item. The hosted Supabase instance (production, Lovable-managed) was never contacted.

---

## CRITICAL — security (highest priority)

### F-SEC-1 · `elevenlabs-tools` — unauthenticated cross-tenant data access
`supabase/functions/elevenlabs-tools/index.ts:527-672`. Runs with the service-role key and resolves the caller's identity through a non-blocking fallback chain: verified token → `user_id` from the request body → `DEMO_USER_ID` → a hardcoded demo UUID, and it explicitly refuses to return 401, auto-joining the chosen user to "any team." An unauthenticated attacker can read other tenants' fleet, revenue, and customer PII.
- **Why flagged not fixed:** this endpoint is called server-to-server by ElevenLabs (no Supabase JWT), so it can't simply require a user JWT like the frontend functions. The correct fix changes an external integration contract and can't be runtime-tested here.
- **Recommended fix (precise):** (1) require a shared secret on every call — `const secret = req.headers.get('x-elevenlabs-secret'); if (secret !== Deno.env.get('ELEVENLABS_TOOL_SECRET')) return 401` — fail closed if the env var is unset; (2) resolve the end-user **only** from the authenticated ElevenLabs conversation context, never from an unauthenticated request-body `user_id`; (3) delete the `DEMO_USER_ID` / hardcoded-UUID / "any team" fallbacks. Configure `ELEVENLABS_TOOL_SECRET` in both Supabase function secrets and the ElevenLabs tool config before deploy.
- **Effort:** ~2–3h incl. ElevenLabs tool-config coordination + a staging test of the voice agent.

### F-SEC-2 · `rari-mcp-server` — opt-in auth + spoofable identity + "first user" fallback
`supabase/functions/rari-mcp-server/index.ts:589-651`. Auth is open when `MCP_SECRET_TOKEN` is unset; accepts the user id from an `x-user-id` header / `?userId=` param; falls back to "the first user in the DB" — all over the service role.
- **Why flagged not fixed:** same as F-SEC-1 — server-to-server contract, untestable here.
- **Recommended fix:** require `MCP_SECRET_TOKEN` (fail closed if unset); remove the `x-user-id`/`?userId=` trust and the "first user" fallback; bind identity to whatever the MCP client is authenticated as. Configure `MCP_SECRET_TOKEN` before deploy (it's also referenced by other "MCP breakthrough" docs but is currently unconfigured — see F-DOC-1).
- **Effort:** ~2–3h incl. MCP client coordination.

---

## HIGH — data integrity & money

### F-BUG-1-DB · No database-level guard against double-booking
No Postgres exclusion constraint or overlap trigger exists in any of the 120 migrations; booking inserts (`FleetContext.createBooking`) write blindly. The audit added **client-side** enforcement at submit (PR `audit/bugs`) as defense-in-depth, but two concurrent requests can still create overlapping bookings (a kill-shot for a rental marketplace).
- **Why flagged:** a constraint/trigger on the core `bookings` table is a schema change on a money-bearing table — Lovable territory, needs careful rollout against existing data (which may already contain overlaps).
- **Recommended fix:** add a `btree_gist` exclusion constraint, e.g. `EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_date, end_date) WITH &&) WHERE (status IN ('pending','confirmed'))`. First audit existing data for current overlaps (the constraint creation will fail if any exist). Deliver as a migration via Lovable; do not apply to production directly.
- **Effort:** ~2h incl. pre-flight overlap audit + handling the half-open vs closed range decision (match the app's `start < bEnd && end > bStart` semantics → use `'[)'` bounds).

### F-BUG-2 · Platform fee is defined three incompatible ways
`stripe-create-hold:70` and `create-payment-checkout:110` hardcode **20%** of the payment/hold amount; the margin DB trigger uses the team's configurable `platform_fee_percent` (**default 10%**) of the rental base. They also gate on `marketplace` only, vs the trigger's `drive_exotiq,marketplace`.
- **Why flagged:** which number is correct is a **business/finance decision**, and the Stripe side changes real `application_fee_amount` (real money). Not something to "fix" blind.
- **Recommended fix:** decide the canonical fee policy, then centralize it (one source of truth consumed by both Stripe functions and the margin trigger — see refactor R2). Reconcile the booking-type gate. Add table-driven tests for the chosen math.
- **Effort:** ~3–4h after the policy decision; finance sign-off required.

### F-BUG-3 · Historical migration shipped an inverted partner/operator split
`20260525225536:117` wrote the split as `100 − x` where `20260528180850:46` uses `x`. Payout rows written in that window are wrong; current code only sets `reconcile_flag` rather than recomputing paid rows.
- **Why flagged:** touches **already-paid** money rows — remediation is a finance/ops decision, not a code change.
- **Recommended fix:** query rows written in the affected window, compute the delta, and decide per-row whether to correct, credit, or write off. Provide a read-only reconciliation report first.
- **Effort:** ~2h for the report; remediation depends on row count + finance policy.

---

## HIGH — observability

### F-OBS-1 · No error tracking anywhere
No Sentry/Datadog/equivalent in `package.json` or `src/`. Production failures — including the payment inconsistencies below — are invisible.
- **Recommendation:** add Sentry (free tier is fine; no licensing/paid-tier risk for low volume). Wire it into `src/lib/logger.ts` and the edge functions' catch blocks. **New dependency — needs your approval per the dependency policy.**
- **Effort:** ~2–3h.

### F-OBS-2 · `logger.ts` is a no-op in production
`src/lib/logger.ts` — `devError` drops errors entirely in prod builds, so anything funneled through it is a silent-failure path. Pairs with F-OBS-1 (once Sentry exists, route `devError`/`devWarn` to it in prod instead of dropping).
- **Effort:** ~1h (folds into F-OBS-1).

### F-OBS-3 · Stripe ↔ DB drift on silent write failures
`stripe-create-hold:117` returns 200 even if the `payments` insert errors → real money held with no DB record to release/capture, no log. `stripe-webhook` marks events processed even when the DB write fails → permanent drift, Stripe won't retry.
- **Why flagged:** edge-function changes can't be runtime-tested here, and the webhook idempotency rework borders on the >15-min review bar.
- **Recommended fix:** check the insert `error` and return non-2xx (so Stripe retries the webhook); on the hold path, if the DB write fails, release the hold or surface a hard error rather than returning success. Add structured logging (depends on F-OBS-1).
- **Effort:** ~2–3h.

---

## MEDIUM — bugs not fixed this session (verifiable but deferred or environment-bound)

- **F-BUG-6 · Stripe webhook idempotency TOCTOU + 64-bit hash UUID** (`stripe-webhook:34-52,457`). Check-then-insert race; the fee idempotency UUID is a 64-bit hash (collision-prone). Fix = unique constraint + `ON CONFLICT DO NOTHING`, and a real SHA-1 v5 UUID (refactor R7). Edge function — not runtime-verifiable here. Effort ~2h.
- **F-BUG-5 · `usePresence` static channel name** (`usePresence.ts:106-124`) — `'presence-changes'` collides across mounts. Fixable in-app but realtime behavior is easy to regress without a live backend to test against. Effort ~1h. (Refactor R5 pairs with it.)
- **F-BUG-8 · Margin "Operator Net" mixes fee-inclusive gross with fee-net payout base** (`MarginOverview.tsx:19-28`) — gas/delivery fees pollute Margin %. Needs a definition decision (what "Operator Net" should mean) before changing. Effort ~2h.

---

## STRUCTURAL — flag-only refactors (from `audit/refactors.md`)

- **R3 · De-duplicate partner-payout share math across 3 SQL functions** — would prevent the next BUG-3-style inversion, but spans 3 DB functions (schema/Lovable territory). Effort ~3h.
- **R6 · Unify Realtime channel naming/cleanup into one helper** — spans 3 hooks + realtime semantics; >15-min review. Effort ~2–3h.
- **R9 · Wire up (or delete) `checkBookingConflicts`** — the audit wired the lightweight overlap check into the submit guard; using the full `checkBookingConflicts` (buffer + maintenance) is a behavior change (new warnings/blocks) needing product input. Effort ~2h.

---

## UI/UX — structural (Lane 3, from `audit/uiux.md`)

- **F-UI-1 · Dual toast systems** — both `use-toast` (shadcn) and `sonner` are mounted in `App.tsx`; ~79 files use one, ~30+ the other, so two toast queues can appear at once. Pick one (Sonner recommended) and migrate. Multi-file; dedicated Lovable session. Effort ~3–4h.
- **F-UI-2 · Mobile "Help & Support" and "Profile" items have no handlers** (`MobileMoreMenu.tsx:72-74`) — they navigate to unregistered `/dashboard/help` and `/dashboard/profile`, silently falling back to the overview. Decide: build those pages, point Profile at the existing Settings→Account tab, or remove the items. Effort ~1–3h depending on choice.

---

## DEPENDENCIES & HOUSEKEEPING

- **F-DEP-1 · `xlsx@0.18.5` has unpatched prototype-pollution + ReDoS CVEs** (no fixed version exists). It is genuinely used (import/export). Mitigation: restrict to trusted uploads, or isolate parsing; consider migrating to `exceljs`. Flag-only (no safe upgrade). The `audit/dependencies` PR dynamic-imports it to at least keep it out of the main bundle.
- **F-DEP-2 · Major version bumps** held back, each flag-only with risk: React 18→19, Vite 5→6, `@supabase/supabase-js` (many minors behind), `date-fns` 3→4, `recharts` 3 (already current), `zod` 3→4. Recommend tackling React 19 + Vite 6 in a dedicated branch with a full regression pass. Effort ~1 day.
- **F-DEP-3 · Lockfile sprawl** — `bun.lock`, `bun.lockb`, AND `package-lock.json` are all committed; npm is authoritative. Recommend deleting the two bun lockfiles to avoid drift. (Mechanical; left out of the audit PRs to avoid surprising a bun-based workflow if one exists — confirm first.)

---

## DOCS — stale/contradicting (from `audit/plan-stress-tests.md`)

- **F-DOC-1 · "MCP breakthrough COMPLETE" docs overstate readiness** — `MCP_SECRET_TOKEN`, `APP_URL`, `FRONTEND_URL` are referenced by edge functions but unconfigured. Ties to F-SEC-2.
- **F-DOC-2 · `RLS_AUDIT_REPORT_JAN_2_2026.md` is stale/wrong-project** — its tables (investor_contacts, instagram_posts, survey_submissions…) don't exist in this schema. Two RLS "fix" summaries cite a migration (`20260102_fix_role_based_policies_comprehensive.sql` + `get_current_app_role()`) that was never applied and is archived. `MESSAGING_RLS_RECURSION_ANALYSIS.md` still recommends disabling RLS though it's permanently fixed.
- **F-DOC-3 · `SYSTEM_ARCHITECTURE.md` / `IMPLEMENTATION_STATUS.md` describe a single-tenant `user_id` model and "Stripe future"** — the opposite of today's team-scoped, fully-Stripe reality; `IMPLEMENTATION_STATUS.md` references files that don't exist. `TECH_DEBT.md` / `QA_ROADMAP.md` still claim "0% test coverage" (now 175 tests).
- **F-DOC-4 · `.lovable/plan.md` WhatsApp Bridge is 100% unbuilt** — no flag, edge function, lib, or table. Either build or remove the promise.
- **Recommendation:** archive ~100 stale root markdown files into `docs/archive/` (full keep/archive/consolidate list in `audit/plan-stress-tests.md`). Recommendation only — nothing was moved.

---

## SCHEMA DRIFT (unverified)
Because Lovable applies schema changes to the hosted instance via MCP, the repo's 120 migrations may not match the live schema. With no DB access, the audit could not run `supabase db pull` to reconcile. Recommend pulling the live schema in a Lovable/Supabase session and diffing against `supabase/migrations/` + `src/integrations/supabase/types.ts`. Suspected-drift specifics are in `audit/plan-stress-tests.md`.
