# Plan / Spec Stress-Test Report

**Auditor role:** architect-reviewer (read-only; codebase is ground truth, the plan docs are under test).
**Date:** 2026-06-10
**Repo:** `/home/user/exotiq-spark-mvp-flow`
**Scope:** ~138 root `*.md` + `docs/` + `.lovable/plan.md` stress-tested against `src/`, `supabase/migrations/` (120 files), `supabase/functions/` (57), and the 2026-05-30 Lovable Cloud inventory.

## Method & evidence baseline

- Verified DDL by reading the actual migration SQL, not by trusting doc prose.
- Cross-checked the production reality against `docs/inventory/2026-05-30-lovable-cloud/REPORT.md` (an evidence-based read-only snapshot of the live DB: 68 tables, 115 applied migrations, 242 policies, linter/security findings).
- Ran the test suite: **64 tests pass across 8 files** (`npx vitest run`), including `src/lib/security/__tests__/rlsMigration.test.ts` and `edgeFunctionConfig.test.ts` which assert the final security state.
- Tag legend: **IMPLEMENTED** / **PARTIAL** / **CONTRADICTED** / **ABANDONED**; TODOs: **DONE** / **STILL-OPEN** / **OBSOLETE**.

---

# Part (a) — Plans / Specs / TODOs

## MARGIN_MODULE_IMPLEMENTATION_PLAN.md — IMPLEMENTED (and exceeded)

Depth-priority document. This is the **strongest plan-to-code match in the repo**. The plan's central decision — "Extend/use `vehicle_expenses`, do NOT create the brief's `expense_records`" — was honored in code.

| Plan claim | Code reality | Tag |
|---|---|---|
| `vehicle_partners`, `partner_payouts` tables, vehicle ownership cols | All created in `20260525225448_*.sql` | IMPLEMENTED |
| Use `vehicle_expenses` w/ `source_module`, `source_record_id`, nullable `vehicle_id`, location_id, expanded `expense_type` enum, unique(source_module,source_record_id) | Exactly as specced (lines 46-70 of that migration) | IMPLEMENTED |
| Team-based + super_admin RLS (not user-only) on expense table | `is_team_member_of_record` + role + `is_super_admin` policies present | IMPLEMENTED |
| `booking_source` on bookings | Present and consumed by `revenue_by_source` view + `useMarginData.ts` | IMPLEMENTED |
| `premium_amount`/`billing_frequency` on `documents`; insurance expense trigger | `20260528175429_*.sql` `fn_log_insurance_expense` | IMPLEMENTED |
| `actual_cost` on `maintenance_schedules`; maintenance expense trigger | `20260529032907_*.sql` | IMPLEMENTED |
| Expense write triggers (damage / insurance / maintenance / work order) | `fn_log_damage_expense`, `fn_log_maintenance_expense`, `fn_log_work_order_expense` | IMPLEMENTED |
| Per-vehicle P&L view | `fn_vehicle_pnl()` + `VehiclePnLTable.tsx` | IMPLEMENTED |
| Margin UI shell + sidebar nav + `?module=margin` route | Present; `featureFlags.margin = true`, gated to Manager+ | IMPLEMENTED |

**Deviations (minor / acceptable):**
- Plan referenced a `MarginModule` component + folder; the code ships **`MarginEnhanced.tsx`** with a `src/components/margin/` folder (24 components). Naming drift only.
- Margin scope **exceeds** Phase 1: ships a Review tab (AI receipt parse + approval thresholds via `parse-expense-receipt`), Deposits ledger, Recurring expense templates (`generate-recurring-expenses` + daily cron), payout state machine (`fn_transition_payout`), partner statements. These map to the brief's Phase 2/3 ambitions, delivered early.
- Plan's "Migration 4: `booking_location_revenue` view" — NOT built as named; location P&L is derived client-side in `useMarginData.ts` via a vehicle→location map. Functionally covered, structurally divergent. **PARTIAL.**
- Promised companion docs `MARGIN_MODULE_REVIEW.md` and `MARGIN_REVENUE_SOURCE.md` (referenced as mandatory pre-work / new doc) **do not exist** in the repo. Dangling references.

Supporting tests pass: `payoutTransitions.test.ts` (9), `partnerStatement.test.ts` (4), `margin/matchCascade.test.ts` (9), `margin/recurring.test.ts` (5).

## Exotiq_Margin_Module_Brief_v2.docx.md — PARTIAL / intentionally superseded

The brief is the product source; the implementation plan deliberately overrode several of its action items. Material claims:

| Brief action item | Reality | Tag |
|---|---|---|
| "Create the **`expense_records`** table" (Action 25) | Implemented as **`vehicle_expenses`** instead, per the plan's explicit decision. Table name + several field names differ (`expense_type` vs `category`, `expense_date` vs `date`, no `recurrence_interval`). | CONTRADICTED (by design) |
| `vehicle_partners` schema with `org_id`, `visibility_settings` JSONB, `stripe_account_id` | Built with **`team_id`** (not org_id), **no `visibility_settings`**, `stripe_connect_account_id`. | PARTIAL |
| `partner_payouts` with `gross_revenue/platform_fee/partner_share/operator_share`, status {pending,paid,overdue} | Built with richer fields (`gross_rental_base`, `net_to_partner`, `operator_adjustments`) and status {pending,scheduled,paid,voided} — **no `overdue`**. | PARTIAL |
| Vehicle cols: ownership_type {owned,partner_managed,leased}, partner_id, split_type, split_value, payout_method, **acquisition_cost, monthly_payment, depreciation_method** | ownership_type is **{owned,partnered}** (no `leased`); Phase-3 cost cols (acquisition_cost/monthly_payment/depreciation_method) and `payout_method` on the vehicle row are **absent**. | PARTIAL / Phase-3 deferred |
| "Stripe Connect as Single Source of Truth … Margin never queries a separate payments table" | **CONTRADICTED.** Margin reads Supabase `bookings` + `payments` + `vehicle_expenses` directly (`useMarginData.ts`). Stripe is not the revenue authority. The plan explicitly chose this (Option A) — so it's a doc-vs-doc contradiction the plan resolved, but the brief text still asserts the opposite. | CONTRADICTED |
| Visibility-scoped Vehicle Partner Dashboard | No `visibility_settings`, no partner login/dashboard. Explicitly Phase-3, schema-now/UI-later — but the schema half (`visibility_settings`) was also skipped. | ABANDONED-for-now |
| QBO/Xero, Gemini-event forecasting, cash-flow projections, what-if, Sankey "cash flow river", heatmap | Not present. Phase 2/3 vision. | STILL-OPEN |

Net: the operative Phase-1 financial engine exists and is solid; the brief's specific schema vocabulary and "Stripe as authority" mandate were knowingly not followed.

## LAUNCH_READINESS_TODO.md — mostly DONE but doc left STALE (checkboxes never updated)

Dated 2026-01-19. The work largely got done; the doc still shows P0 items as "⏳ Pending."

| Item | Doc status | Code reality | Tag |
|---|---|---|---|
| 1.1 Auth on `voice-to-text` | Pending | DONE — `getUser` + 401 present | DONE |
| 1.2 Auth on `text-to-speech` | Pending | DONE — same pattern | DONE |
| 1.3 `user_presence` RLS fix | Pending | DONE — `20260119155027_*.sql` drops "Anyone can view", adds team-scoped policy | DONE |
| 1.4 Leaked-password protection | Pending | Auth-console setting; not verifiable from repo | UNVERIFIABLE |
| Phase 2 logger + console cleanup | Complete | `src/lib/logger.ts` exists; matches | DONE |
| Phase 3 Demo setTimeout + debounced refresh | Complete | Plausible, matches description | DONE |
| 4.1 `entity_comments` RLS | Pending | DONE — `20260127061612_*.sql` + later hardening | DONE |
| 5.1 `rari-email-summary` placeholder email | Pending | DONE — Resend integration is wired (not a placeholder) | OBSOLETE |
| 5.3 remove `@ts-nocheck` in `elevenlabs-tools` | Pending | STILL-OPEN — `@ts-nocheck` still at top of file | STILL-OPEN |
| 5.4 tsconfig strictness | Post-launch | STILL-OPEN — `noImplicitAny:false`, `strictNullChecks:false` | STILL-OPEN |

**Risk:** the "Completion Log" table at the bottom is empty, so a reader would wrongly conclude P0 security is unaddressed. It is addressed. Doc is dead weight unless reset.

## QA_ROADMAP.md — partially DONE; doc stale on test-coverage

Dated 2026-01-27, "Current State 7.8/10."

| Claim | Reality | Tag |
|---|---|---|
| P0.1 Secure `ai-pricing`, `generate-report`, `ai-demand-forecast`, `predicthq-events` | DONE — all four have manual `getUser`/401 auth in code (config keeps `verify_jwt=false`, manual auth instead) | DONE |
| P0.2 Non-recursive `team_members` RLS helpers | DONE — messaging recursion permanently fixed (see below) | DONE |
| "Test Coverage ❌ 0%" | CONTRADICTED — 8 test files, 64 tests, CI workflow (`.github/workflows/ci.yml`) exist | CONTRADICTED |
| Add `telematicsIntegration:false` flag | DONE — present in `featureFlags.ts` | DONE |
| Sentry / error tracking | STILL-OPEN — no `@sentry/*` dependency | STILL-OPEN |
| `EnhancedGlobalSearch.tsx` exists | TRUE (note: doc elsewhere/IMPL_STATUS calls it `GlobalSearch` which does NOT exist) | DONE |

## TECH_DEBT.md — stale (dated 2025-12-31); several items OBSOLETE

| # | Claim | Reality | Tag |
|---|---|---|---|
| 1 | "0% test coverage" | CONTRADICTED — 64 passing tests + CI | OBSOLETE |
| 2 | Duplicate `DashboardOverview` vs `DashboardOverviewEnhanced` | STILL-OPEN — both files still present | STILL-OPEN |
| 3 | Event-based nav → URL params | Marked resolved; consistent with code | DONE |
| 5 | No Sentry | STILL-OPEN — confirmed absent | STILL-OPEN |
| 7 | Unused `QuickOnboarding.tsx` | `QuickOnboarding.tsx` now **deleted**; `EmptyState.tsx` + `MicroInteractions.tsx` still present (and EmptyState is now actively used) | PARTIAL/DONE |

Summary table at the bottom ("Open 8, In Progress 2") is no longer accurate.

## IMPLEMENTATION_STATUS.md — the most misleading status doc; CONTRADICTED on architecture

This is an early-development report ("85% of scope," "7 hours/day savings"). Phases 1-4 & 7 components mostly exist (CRMSection, BookingCalendar, PaymentTracker, InspectionForm, DamageClaimsSection, etc. all present), so the feature-level claims are broadly true. **But:**

- Security model is described as `auth.uid() = user_id` "User Isolation" on all tables — **CONTRADICTED** by the actual team-scoped multi-tenant model (`team_id` + `is_team_member_of_record`).
- "Phase 5 (automated comms) parked — requires Twilio" / "Phase 6 deferred" — **OBSOLETE**: the app now has Slack notify, Resend email summaries, realtime subscriptions, weekly digests, mention notifications.
- Claims `GlobalSearch.tsx` re-enabled and `useRealtimeSubscriptions.ts` created — **both files do NOT exist** (search is `EnhancedGlobalSearch.tsx`; realtime is wired directly in `FleetContext`). CONTRADICTED.

## SYSTEM_ARCHITECTURE.md — CONTRADICTED (stale single-tenant + "Stripe future" framing)

Module components (MotorIQ/Pulse/Book/Vault/Core, `*Enhanced.tsx`) do exist, so the module map is directionally right. The data/security model is wrong for today's code:

- `Vehicle.user_id` / `Booking.user_id` and "User Isolation: `user_id` foreign key on all records" — **CONTRADICTED**; tables are `team_id`-scoped.
- "Stripe (Future) / Payment processing (Stripe integration ready)" and "Multi-tenant support (organization_id addition)" listed as **Future** — **CONTRADICTED**; Stripe is fully integrated (20+ `stripe-*` edge functions, `stripe-webhook`, `stripe_webhook_events` table) and multi-tenancy already shipped (`teams`, `team_members`).
- No mention of the entire Margin module, super-admin system, or RARI MCP. Doc predates the bulk of the platform.

## STRIPE_TODO.md — IMPLEMENTED / accurate

Dated 2026-05-28. Describes the live 3-tier per-vehicle pricing and the edge functions (`create-checkout-session`, `check-subscription`, `switch-subscription`, `customer-portal`) — all four exist. Live Stripe price/product IDs are real config, not verifiable offline but internally consistent. The most accurate "TODO" in the repo (really a status note). DONE.

## .lovable/plan.md (WhatsApp Bridge Phase 1) — ABANDONED / not started

Detailed plan for a `whatsapp-inbound` edge function, `src/lib/whatsapp.ts`, `WhatsAppButton`, `whatsappBridge` feature flag, `customers.whatsapp_phone`, `whatsapp_events` table.

- **None of it exists.** No `whatsappBridge` flag in `featureFlags.ts`, no `whatsapp-*` edge function, no `src/lib/whatsapp.ts`, no WhatsApp migration. The only `whatsapp` string hits are an unrelated integrations settings field. **STILL-OPEN / not begun.** This is the canonical "promise not in code."

## RLS / Messaging fix reports — final state GOOD, but two reports point at a STALE migration

- **MESSAGING_RLS_RECURSION_ANALYSIS.md** (Jan 2, "🟡 IN PROGRESS," recommends temporarily disabling RLS) — **OBSOLETE.** Final state: `is_conversation_member()` is `SECURITY DEFINER … SET search_path = public` (`20260107045115_*.sql`), RLS remains ENABLED on `conversation_members` (no permanent DISABLE anywhere). Recursion was permanently solved. The "in progress / disable RLS" guidance is dangerously outdated if followed today.
- **MESSAGING_FIX_SUCCESS / MESSAGING_FINAL_STATUS** supersede the above — consistent with code.
- **SUPABASE_RLS_FIX_SUMMARY.md** + **SUPABASE_RLS_CROSS_CHECK_SUMMARY.md** (Jan 2): claim "ALL FIXED IN `20260102_fix_role_based_policies_comprehensive.sql`" using a `get_current_app_role()` function. **CONTRADICTED in production:** that migration was **never applied to the live DB** and is now archived under `docs/inventory/.../stale_repo_migrations/` (per the cloud reconciliation). `get_current_app_role` exists in **zero** canonical migrations. The RBAC these docs describe was effectively re-done later via a different mechanism (`has_role` + `is_team_member_of_record` + `is_team_admin`). So the claimed fix shipped under a different design; these two summaries describe a now-dead migration as the source of truth.

## docs/inventory/2026-05-30-lovable-cloud/REPORT.md — HIGH-QUALITY / authoritative (the gold-standard doc)

Evidence-based, reconciled, honest. Documents the real production DB and, importantly, **6 live cross-team RLS escalation findings**. Cross-checking those against migrations:
- `20260530203000_harden_tenant_rls_policies.sql` (same day) directly remediates them: rewrites `is_same_team()` to use team membership, team-scopes `is_team_admin()` on `team_messages`/`conversation_members`/`user_activity_log`, removes broad storage policies on `customer-documents`/`message-attachments`, adds `realtime.messages` handling. Backed by `rlsMigration.test.ts` (passing). **Findings → remediated.** This is real, verifiable security work.
- Open caveat the REPORT flags and that remains true: secrets `APP_URL`, `FRONTEND_URL`, `MCP_SECRET_TOKEN` are referenced by edge-function source but not configured (`rari-mcp-server` reads `MCP_SECRET_TOKEN`). Duplicate `purge-old-notifications` cron jobs. These are genuine, still-open.

## Other (a) plans — quick verdicts

| Doc | Verdict |
|---|---|
| docs/whatsapp/PHASE_1_BRIDGE_PLAN.md | Duplicate of `.lovable/plan.md`; ABANDONED/not-started |
| docs/migration/* (EXPORT_REQUEST, STAGING_RESTORE_RUNBOOK, CUTOVER_GO_NO_GO, etc.) | Live migration-planning artifacts, consistent with REPORT.md; KEEP |
| RARI_ENTERPRISE_EVOLUTION_PLAN / RARI_WIDGET_INTEGRATION_PLAN / RARI_UNIVERSAL_QUERY_SETUP | Partially realized — `rari-universal-query`, `rari-mcp-server`, `rari-enterprise-handlers` edge fns exist; widget + universal query shipped. PARTIAL→IMPLEMENTED for core, aspirational for "enterprise evolution." |
| NEXT_LEVEL_ROADMAP / ROADMAP_TO_9.5 / CLOUD_MIGRATION_ROADMAP / CLOUD_OPTIMIZATION_TODO | Forward-looking roadmaps; mostly STILL-OPEN aspirations, not load-bearing |
| IMPLEMENTATION_PLANS / IMPLEMENTATION_GUIDE / QUICK_ACTION_PLAN / QUICK_FIX_GUIDE / DECISION_MATRIX | Early planning scaffolding; superseded |
| GCAL_TODO / DEMO_TODO / DEMO_DATA_TODO / RARI_TODO | gcal-* and demo-* edge fns exist (GCAL largely DONE); RARI_TODO mostly DONE |

---

# Part (b) — Completion / Status Reports (claims often inflated — verified)

| Doc | Headline claim | Verification | Tag |
|---|---|---|---|
| SUPER_ADMIN_IMPLEMENTATION_COMPLETE.md | "Phase 1 Complete — Production Ready" | `super_admins` table (15 migration refs), `SuperAdminDashboard.tsx`, 6 `super-admin/` components, `is_super_admin()` | IMPLEMENTED (accurate) |
| RARI_IMPLEMENTATION_COMPLETE.md | "ALL FEATURES IMPLEMENTED" (Dec 30) | Core Rari present (widget, edge fns, conversations/messages tables). "ALL" is inflated vs the later enterprise/MCP work, but base claims hold | PARTIAL→IMPLEMENTED |
| MCP_BREAKTHROUGH_JAN_7_2026_COMPLETE.md / MCP_BREAKTHROUGH_OPUS_COMPLETE.md | MCP integration working | `rari-mcp-server/index.ts` exists and references `MCP_SECRET_TOKEN` — **but that secret is NOT configured in prod** (per REPORT). So "complete" but currently mis-configured to actually run | PARTIAL |
| IMPLEMENTATION_COMPLETE.md | "ALL 10 PHASES COMPLETED" (UX polish) | UX components broadly exist; "all 10" is marketing flourish | IMPLEMENTED (loosely) |
| ROLLBACK_AND_REBUILD_COMPLETE.md | "zero breaking changes," all phases done | Consistent with TECH_DEBT #3/#11 resolutions; plausible | IMPLEMENTED |
| BANNER_WHITE_LABEL_COMPLETE.md | Banner glass-morphism + white-label | `dashboard-banners` bucket exists; banner components present | IMPLEMENTED |
| DARK_MODE_COMPLETE.md / COLOR_OPTIMIZATION_COMPLETE.md / NAVIGATION_IMPROVEMENTS_COMPLETE.md | Various UI polish "complete" | Cosmetic; not independently load-bearing. Assume true | IMPLEMENTED (low-stakes) |
| PHASE_1_COMPLETE.md / PHASE_2_COMPLETE.md / PHASE_3_COMPLETE.md | Cleanup / Command-palette nav / Onboarding confetti | Phase 2 (URL-param nav) corroborated by TECH_DEBT #3; others plausible | IMPLEMENTED |
| DEPLOYMENT_SUCCESS.md ("DEPLOYED TO LOCAL DEV") / DEPLOYMENT_SUCCESS_JAN_1_2026 / DEPLOYMENT_READY | "Deployed" | Aspirational/local; REPORT shows real prod at app.exotiq.ai. Title oversells ("local dev" ≠ deployed) | PARTIAL |
| HONEST_STATUS.md | "7.5/10, command palette actions are stubs, onboarding broken" | Self-critical and was accurate at writing; command palette since wired (TECH_DEBT #3). Now stale but honest | OBSOLETE (superseded) |
| REAL_ASSESSMENT.md / REVIEW_COMPLETE.md / REVIEW_SUMMARY.md / HONEST_STATUS | Candid self-reviews | Useful historical context; superseded by current state | OBSOLETE |
| AUDIT_REPORT.md (Nov 9) / COMPREHENSIVE_AUDIT_REPORT_JAN_2026 / AUDIT_COMPLETE_SUMMARY / RLS_AUDIT_REPORT_JAN_2_2026 | Various audits "demo-ready" / RLS findings | Each accurate at its date; all predate and are superseded by the 2026-05-30 REPORT | OBSOLETE |
| MESSAGING_FIX_SUCCESS_JAN_2_2026 / MESSAGING_FINAL_STATUS_JAN_2_2026 / MESSAGING_QUICK_FIX_STATUS / MESSAGING_DEBUG_FIX | Messaging fixed | Final RLS state confirms success | IMPLEMENTED |
| RARI_COMPLETE_SOLUTION_JAN_8_2026 / RARI_MCP_TEST_RESULTS_JAN_7 / RARI_MCP_DEPLOYMENT_TEST_JAN_7 | Rari/MCP solution + test logs | Core true; MCP runtime blocked by missing secret | PARTIAL |
| EXCELLENCE_IMPLEMENTATION / EXCELLENCE_SUMMARY / SYSTEMATIC_POLISH_SUMMARY | Polish complete | Cosmetic; assume true | IMPLEMENTED (low-stakes) |

---

# Part (c) — Setup Guides / Documentation (referenced files & commands)

| Doc | Key references | Exist? | Notes |
|---|---|---|---|
| README.md | Vite/Lovable scaffold | ✓ | Standard |
| docs/margin/MARGIN_USER_GUIDE.md | "Dashboard → Margin," 8 overview cards, Manager+ | ✓ matches `MarginEnhanced.tsx` + role gate | Accurate end-user doc; KEEP |
| docs/margin/INTERNAL_MARGIN_WORKFLOWS.md | Internal workflows | ✓ aligns with payout/expense triggers | KEEP |
| TESTING.md / TESTING_GUIDE.md | Test checklists | partial | Pre-date the real vitest suite; QA_ROADMAP Appendix is more current |
| CURSOR_MCP_SETUP.md / ELEVENLABS_MCP_SETUP.md / ELEVENLABS_TOOL_SETUP_GUIDE.md | MCP/ElevenLabs setup, `MCP_SECRET_TOKEN` | partial | `MCP_SECRET_TOKEN` referenced by `rari-mcp-server` but **not configured** in prod (REPORT §5) |
| RARI_ELEVENLABS_SETTINGS / _SYSTEM_PROMPT | Agent config | n/a | External (ElevenLabs console), not repo-verifiable |
| SUPABASE_QUICK_BRIEF.md / SUPABASE_RLS_*_SUMMARY.md | Migration `20260102_fix_role_based_policies_comprehensive.sql` | ✗ in canonical migrations | File is **archived as stale/never-applied** — see Part (a) RLS section. Misleading as a setup guide |
| DEPLOYMENT_CHECKLIST.md | Pre-launch steps | ✓ generic | Reasonable checklist |
| TROUBLESHOOTING_GUIDE.md / QUICK_START.md / START_HERE*.md | Onboarding for devs | ✓ | START_HERE files overlap heavily |
| WIDGET_QUICK_START.md / README_WIDGET_INTEGRATION.md / WIDGET_DEMO_README.md | Rari widget embed | ✓ widget exists | LAUNCH_READINESS flagged "TODO: UI" comments here (cosmetic) |
| CHECK_MCP_SECRET.md | Verify MCP secret | relevant | Directly relevant to the missing `MCP_SECRET_TOKEN` |
| docs/migration/* runbooks | Staging restore / cutover / artifacts | ✓ consistent with REPORT | KEEP — live cutover docs |

---

# Part (d) — Marketing / Notes (one line each)

- **PRODUCT_OVERVIEW_DEMO.md / VISUAL_SHOWCASE.md / DESIGN_SYSTEM.md** — Marketing/design narrative; not testable claims.
- **VISUAL_CHANGES_GUIDE / VISUAL_IMPROVEMENTS_SUMMARY / VISUAL_IMPROVEMENTS_QUICK_REF / UI_UX_IMPROVEMENTS / NAVIGATION_UX_IMPROVEMENTS** — Cosmetic change logs; low value, redundant.
- **BRAND_ASSETS_ASSESSMENT / BRAND_INTEGRATION_COMPLETE / LOGO_REQUIREMENTS** — Branding notes.
- **DEMAND_FORECAST_SUMMARY / DEMAND_FORECAST_COLOR_OPTIMIZATION** — `ai-demand-forecast` + `predicthq-events` exist; cosmetic notes around them.
- **RARI_* (capabilities, knowledge-base, system-prompt, settings, UI, upgrade, transcript, webhook, universal-*, documentation-index, next-steps, loveable-master-prompt, enterprise-evolution)** — ~30 Rari narrative/prompt files; heavy overlap, a few are live prompts.
- **LOVABLE_* handoffs (HANDOFF, INSPECTION_INTEGRATION, ONBOARDING_CRM_HANDOFF, PHOTO_HUB_HANDOFF), LOVEABLE_TOUR_VIDEO_*** — Session handoff notes; historical.
- **PRIORITY_* / EXPERT_PRODUCT_REVIEW / COMPREHENSIVE_APP_REVIEW / DIAGNOSTIC_REPORT / STATUS_UPDATE / GIT_STATUS / PULL_SUMMARY / CHANGES_SUMMARY / MOBILE_ONBOARDING_FIXES / REALTIME_INTEGRATION / INTEGRATION_STRATEGY / QUICK_WINS** — Point-in-time notes; superseded.
- **CONNECT_RARI_TO_ELEVENLABS_NOW / RARI_MCP_QUICK_FIX_NEEDED / ELEVENLABS_DEBUG_GUIDE / ELEVENLABS_WIDGET_TEST / TEST_CURSOR_INTEGRATION / MCP_* (audit, vs-universal, breakthrough-template)** — Debug/setup scratch notes.
- **DARK_MODE_AUDIT / SUPER_ADMIN_QUICK_START / LAUNCH_READINESS_SUMMARY / IMPLEMENTATION_PROGRESS / IMPLEMENTATION_SUMMARY_JAN_2 / PHASE_1_UX_IMPLEMENTATION / PHASE_5_IMPLEMENTATION / PRIORITY_1_*** — Progress snapshots.

---

# Top 10 Gaps / Risks

1. **`.lovable/plan.md` WhatsApp Bridge is 100% unbuilt** despite a detailed, current-looking plan (flag, edge fns, table, lib all absent). Highest "promise vs code" gap. Anyone treating it as in-flight will be wrong.
2. **Two RLS "fix" summaries point at a never-applied migration.** `SUPABASE_RLS_FIX_SUMMARY.md` / `SUPABASE_RLS_CROSS_CHECK_SUMMARY.md` cite `20260102_fix_role_based_policies_comprehensive.sql` + `get_current_app_role()` as the live RBAC source of truth — that migration is archived as stale and the function exists nowhere in canonical migrations. Real RBAC uses a different mechanism. Following these docs to "verify" security would check for the wrong objects.
3. **MESSAGING_RLS_RECURSION_ANALYSIS.md recommends disabling RLS** and is marked "in progress" — recursion is in fact permanently fixed with `SECURITY DEFINER`. A reader acting on this could disable production RLS unnecessarily.
4. **`MCP_SECRET_TOKEN` (plus `APP_URL`, `FRONTEND_URL`) referenced by edge functions but not configured** (REPORT §5). The "MCP breakthrough COMPLETE" docs overstate readiness — `rari-mcp-server` can't authenticate without the secret. Genuine runtime gap.
5. **No error tracking (Sentry) despite repeated TODOs** (TECH_DEBT #5, QA_ROADMAP 2.5/4.1, LAUNCH_READINESS post-launch). Still absent. Production blind spot.
6. **SYSTEM_ARCHITECTURE.md actively misleads** on the security model (claims `user_id` isolation, "Stripe future," "multi-tenant future") — the opposite of today's team-scoped + full-Stripe reality. Dangerous as the doc named "the complete system architecture for LLM comprehension."
7. **IMPLEMENTATION_STATUS.md asserts files that don't exist** (`GlobalSearch.tsx`, `useRealtimeSubscriptions.ts`) and a single-tenant `user_id` model. High contradiction surface.
8. **Margin brief vs implementation schema divergence is undocumented in the brief** — `expense_records`→`vehicle_expenses`, `org_id`→`team_id`, missing `visibility_settings` and Phase-3 cost columns, status `overdue` absent. The Vehicle Partner Dashboard depends on `visibility_settings` that was never added, so "schema now, UI later" is half-true.
9. **Lingering tech debt the docs say is fixed isn't:** duplicate `DashboardOverview.tsx`/`DashboardOverviewEnhanced.tsx` (TECH_DEBT #2 still open), `@ts-nocheck` in `elevenlabs-tools`, loose tsconfig (`strictNullChecks:false`). Stale "complete" framing hides these.
10. **Massive doc sprawl (138 root mds) with no index and conflicting dates** is itself a risk: ~6 messaging-fix docs, ~30 Rari docs, ~10 "audit/review" docs, multiple "DEPLOYMENT_SUCCESS." A new contributor cannot tell which doc is authoritative; several actively contradict each other and the code.

---

# Doc-Cleanup Recommendations (recommend only — do NOT move/delete)

**Authoritative — keep & treat as source of truth:**
- `docs/inventory/2026-05-30-lovable-cloud/REPORT.md` (+ `raw/`, `stale_repo_migrations/README.md`) — the gold standard.
- `docs/migration/*` runbooks; `docs/margin/MARGIN_USER_GUIDE.md` + `INTERNAL_MARGIN_WORKFLOWS.md`.
- `MARGIN_MODULE_IMPLEMENTATION_PLAN.md`, `STRIPE_TODO.md` — accurate and matched to code.

**Recommend archiving as STALE/SUPERSEDED (historically useful, currently misleading):**
- `SYSTEM_ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md` — contradict the current architecture; either rewrite or stamp "SUPERSEDED — see REPORT.md."
- `SUPABASE_RLS_FIX_SUMMARY.md`, `SUPABASE_RLS_CROSS_CHECK_SUMMARY.md` — reference a never-applied migration; add a banner pointing to `harden_tenant_rls_policies.sql` + the stale-migration README.
- `MESSAGING_RLS_RECURSION_ANALYSIS.md` — mark RESOLVED; its "disable RLS" advice is hazardous.
- `HONEST_STATUS.md`, `REAL_ASSESSMENT.md`, `REVIEW_COMPLETE.md`, `REVIEW_SUMMARY.md`, `STATUS_UPDATE.md`, `DIAGNOSTIC_REPORT.md`, `GIT_STATUS.md`, `PULL_SUMMARY_JAN_7_2026.md` — point-in-time, superseded.
- Dated audits: `AUDIT_REPORT.md` (Nov 9), `COMPREHENSIVE_AUDIT_REPORT_JAN_2026.md`, `AUDIT_COMPLETE_SUMMARY.md`, `RLS_AUDIT_REPORT_JAN_2_2026.md` — all predate REPORT.md.
- `TECH_DEBT.md`, `LAUNCH_READINESS_TODO.md`, `QA_ROADMAP.md` — keep but **reset checkboxes** to reality (most P0/P1 items are DONE); otherwise they read as alarming-but-false.

**Recommend consolidating (dead-weight duplication):**
- Messaging: collapse `MESSAGING_*` (6 files) into one status note.
- Rari: ~30 `RARI_*` / `MCP_*` / `ELEVENLABS_*` files — consolidate into `RARI_DOCUMENTATION_INDEX.md` (which already exists) and retire the scratch/debug ones.
- Deployment: `DEPLOYMENT_SUCCESS*.md` (3) + `DEPLOYMENT_READY.md` — one is mislabeled ("local dev"); merge.
- Visual/UI polish: `VISUAL_*`, `*_COMPLETE.md` cosmetic set (~12) — fold into a single CHANGELOG.
- `START_HERE*.md` (3) + `QUICK_START.md` — overlap heavily; one entrypoint.

**Recommend explicitly labeling as NOT-STARTED (so they aren't mistaken for in-flight):**
- `.lovable/plan.md` and `docs/whatsapp/PHASE_1_BRIDGE_PLAN.md` (WhatsApp bridge — unbuilt).

*No files were moved, modified, or deleted. Remote Supabase was never contacted. This report is the only file written.*
