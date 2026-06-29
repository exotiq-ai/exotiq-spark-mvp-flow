# Save FleetCopilot Number-Truth Audit Plan as Markdown

**Scope:** Write-only. Create one Markdown file at `docs/rari/FLEETCOPILOT_NUMBER_TRUTH_AUDIT.md` containing the full v2 audit + Phase 1/2 fix plan. No code changes, no edits to dashboard components, no edits to the digest edge function. Nothing ships until you approve a follow-up plan.

## File to create

`docs/rari/FLEETCOPILOT_NUMBER_TRUTH_AUDIT.md`

## Contents (in order)

1. **TL;DR** — what's real, what's fabricated, what we'd change, in 6 bullets.
2. **Audit findings**
   - Real numbers (keep): MotorIQEnhanced revenue/utilization/rates, CoreEnhanced fleet/booking/insights, WeeklyDigestCard aggregates, DailyBriefCard deterministic compute.
   - Fabricated (fix), with file:line citations:
     - `Core.tsx`: `% Tasks Automated`, `Time Saved Daily = vehicles × 0.5h`.
     - `MotorIQ.tsx`: `utilizationRate = bookings.length × 10`, fake margin, `suggestedIncrease = rate × (0.1 + i×0.05)`, `impact = ×4`, `confidence = 95 − i×8`.
     - `CoreEnhanced.tsx`: "24/7 Monitoring" chip masquerading as a KPI.
     - `MotorIQEnhanced.tsx`: hard-coded `Lotus Evija` filter; `monthly opportunity = (suggested − current) × 30` ignores utilization.
     - `weekly-intelligence-digest/index.ts`: hard-coded `'miami'`; utilization snapshot mislabeled as weekly; revenue summed on `created_at` not rental window; `vehiclesRecommended = demandSurge > 15 ? min(fleet,3) : 0`; AI prompt doesn't forbid invented figures.
3. **Phase 1 — Truth fixes (no schema changes)**
   - Pre-flight grep to confirm `<Core />` and `<MotorIQ />` are unused.
   - Delete `Core.tsx` and `MotorIQ.tsx`.
   - `CoreEnhanced`: replace "24/7 Monitoring" with "Last sync · 2m ago" or plain "Live" badge.
   - `MotorIQEnhanced`: drop Lotus filter; rename to "Projected monthly upside" = `(suggested − current) × 30 × (utilization/100)`; tooltip explains assumption; show "Max upside at 100% utilization" as secondary line.
   - `weekly-intelligence-digest`: resolve tenant city from `locations` (skip events if missing); match MotorIQ utilization formula; overlap-weighted weekly revenue; real `vehiclesRecommended` count; tighten LLM prompt + regex-reject $/% tokens not in payload; add `data_sources` and `coverage` to `summary_json`.
   - `WeeklyDigestCard`: render `coverage` footer.
   - Verification: Playwright KPI snapshot + Vitest pure-function tests for the new math.
   - Acceptance gates: no `× constant` impact, no Miami fallback, utilization parity within ±1% across DailyBrief / MotorIQEnhanced / PlatformPulseStrip / digest.
4. **Phase 2 — Honest AI recommendations (opt-in)**
   - New `MotorIQRecommendations.tsx` driven by real pricing pipeline (no canned rows).
   - New `shared/fleetMetrics.ts` exporting `computeUtilization`, `computeWeeklyRevenue`, `computeProjectedUpside`; refactor 4 call sites; copy-to-edge-fn at build time.
   - Vitest parity suite across all 4 surfaces.
   - KPI provenance table in `audit/observability.md` + `scripts/audit/check-kpi-provenance.mjs` CI lint for magic-constant patterns.
   - Log digest inputs/outputs to `ai_transfer_log` (`digest_inputs`).
   - New `<KpiSource />` info-popover primitive on every KPI tile.
   - "Methodology" expand on digest dialog.
5. **Out of scope** — `suggested_rate` model itself, Stripe/billing/LTV, new tables, RLS, visual redesign.
6. **Risks & reversibility** — legacy deletions reversible via git; first post-change digest gets a "Methodology updated" note; shared metrics duplicated to edge fn via build script.
7. **Sequencing diagram** (ASCII) — Phase 1 single PR, Phase 2 single PR.
8. **Technical notes** — exact files touched per phase (delete 2, edit 4 in Phase 1; add 4, refactor 4 in Phase 2). No DB migrations, no RLS, no new secrets.

## What this turn does NOT do

- No edits to `Core.tsx`, `MotorIQ.tsx`, `CoreEnhanced.tsx`, `MotorIQEnhanced.tsx`, `WeeklyDigestCard.tsx`, or `weekly-intelligence-digest/index.ts`.
- No deletions, no archive moves, no DB migrations, no edge function deploys.
- One new Markdown file. That's it.
