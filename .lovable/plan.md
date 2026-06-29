# FleetCopilot Number-Truth Audit & Fix Plan (v2)

_No code ships until this plan is approved. The audit doc lives at `docs/rari/FLEETCOPILOT_NUMBER_TRUTH_AUDIT.md` for reference._

## TL;DR

- Enhanced surfaces (`MotorIQEnhanced`, `CoreEnhanced`, `WeeklyDigestCard`, `DailyBriefCard`) compute headline numbers from real data — keep.
- Legacy `Core.tsx` and `MotorIQ.tsx` still ship with fabricated KPIs — delete.
- `MotorIQEnhanced` has a hard-coded Lotus filter and a "monthly opportunity" formula that ignores utilization — fix.
- `weekly-intelligence-digest` edge fn hard-codes Miami, mis-sums revenue by `created_at`, fakes `vehiclesRecommended`, and lets the LLM invent figures — fix.
- Phase 1 = truth fixes, no schema changes. Phase 2 = shared metrics lib, provenance UI, CI guardrails.

## Audit findings (fabricated → fix)

- **`Core.tsx`**: `% Tasks Automated = activeBookings/totalVehicles×100`, `Time Saved = vehicles×0.5h`, "24/7 Monitoring" as a KPI tile.
- **`MotorIQ.tsx`**: `utilization = bookings.length×10`, fake margin, `suggestedIncrease = rate×(0.1+i×0.05)`, `impact = ×4`, `confidence = 95−i×8`.
- **`CoreEnhanced.tsx`**: "24/7 Monitoring" chip styled as a KPI.
- **`MotorIQEnhanced.tsx`**: hard-coded Lotus Evija exclusion; `monthly opportunity = (suggested−current)×30` assumes 100% utilization.
- **`weekly-intelligence-digest/index.ts`**: hard-coded `city='miami'`; today-snapshot utilization labeled weekly; revenue summed on `created_at`; `vehiclesRecommended = demandSurge>15 ? min(fleet,3) : 0`; prompt doesn't forbid invented `$`/`%` tokens.

## Phase 1 — Truth fixes (no schema changes)

1. Pre-flight grep confirms `<Core/>` and `<MotorIQ/>` are unused; delete both files and orphan routes.
2. `CoreEnhanced`: replace "24/7 Monitoring" chip with `Last sync · 2m ago` or a plain `Live` badge.
3. `MotorIQEnhanced`: drop Lotus filter; rename to **Projected monthly upside** = `(suggested−current)×30×(utilization/100)`; tooltip explains assumption; secondary line shows `Max upside at 100% utilization`.
4. `weekly-intelligence-digest`:
   - Resolve city from tenant's primary `locations.city`; if null, omit events section (no Miami fallback).
   - Match `MotorIQEnhanced` utilization formula (inline copy with `// keep in sync` comment in Phase 1).
   - Weekly revenue = overlap-weighted sum across `[weekStart, weekEnd)` using `start_date`/`end_date`.
   - `vehiclesRecommended` = real count from `pricing_recommendations` where `suggested>current` in week.
   - Prompt: explicit "Do not invent dollar or percent figures"; post-gen regex rejects `$\d`/`\d%` tokens not in payload.
   - Extend `summary_json` with `data_sources` and `coverage` (week range, counts, `city_resolved`).
5. `WeeklyDigestCard`: render footer `Sources: bookings · vehicles · pricing · {city or "no city set"}`.
6. Verification: Playwright KPI snapshot of `/dashboard` before/after; Vitest for overlap-weighted revenue and projected-upside.
7. Acceptance: no `× constant` impact formulas; no Miami fallback; utilization parity within ±1% across `DailyBriefCard`, `MotorIQEnhanced`, `PlatformPulseStrip`, digest.

## Phase 2 — Honest AI + guardrails (opt-in)

1. New `shared/fleetMetrics.ts` with `computeUtilization`, `computeWeeklyRevenue` (overlap-weighted), `computeProjectedUpside`; Vite `@shared/` alias; `scripts/sync-shared-to-edge.mjs` copies into `supabase/functions/_shared/` so Deno can import.
2. Refactor the 4 call sites to import from the shared lib.
3. New `MotorIQRecommendations.tsx` driven by `pricing_recommendations` rows — no canned rationale; confidence rendered only if pipeline emits it.
4. New `KpiSource.tsx` info-popover primitive on every KPI tile (source table/column/formula); "Methodology" expand inside weekly digest dialog.
5. New `scripts/audit/check-kpi-provenance.mjs` CI lint failing on patterns like `Math.round(*0.5)`, `×10` capped at 100, `×30` next to `$`, `confidence = N -`. Wired into test script.
6. Log digest inputs/outputs (counts, city, prompt hash, payload hash, model output) to existing `ai_transfer_log`.
7. Vitest parity suite asserting all 4 surfaces return identical utilization, revenue, upside on a fixture dataset.

## Out of scope

`suggested_rate` model itself; Stripe/billing/LTV; new tables; RLS changes; new secrets; visual redesign beyond source popovers and methodology expand.

## Risks & reversibility

- Legacy deletions reversible via git history.
- First post-change digest adds a one-line `Methodology updated` note.
- Shared-metrics duplication into edge fn is the main regression risk; the parity test in §7 catches stale copies.

## Sequencing

```text
Phase 1 PR
  ├─ pre-flight grep
  ├─ delete Core.tsx, MotorIQ.tsx
  ├─ edit CoreEnhanced, MotorIQEnhanced
  ├─ edit weekly-intelligence-digest + WeeklyDigestCard
  └─ Vitest + Playwright gates
        │  (merge, observe one weekly digest cycle)
        ▼
Phase 2 PR
  ├─ add shared/fleetMetrics.ts + sync script
  ├─ refactor 4 call sites
  ├─ add MotorIQRecommendations, KpiSource, methodology expand
  ├─ ai_transfer_log writes
  └─ CI lint + parity test
```

## Technical notes

- **Phase 1 touches**: delete `src/pages/Core.tsx`, `src/pages/MotorIQ.tsx`; edit `src/components/dashboard/CoreEnhanced.tsx`, `MotorIQEnhanced.tsx`, `WeeklyDigestCard.tsx`, `supabase/functions/weekly-intelligence-digest/index.ts`; route cleanup per grep.
- **Phase 2 touches**: add `shared/fleetMetrics.ts`, `supabase/functions/_shared/fleetMetrics.ts` (synced), `MotorIQRecommendations.tsx`, `KpiSource.tsx`, `scripts/sync-shared-to-edge.mjs`, `scripts/audit/check-kpi-provenance.mjs`; refactor the 4 call sites.
- No DB migrations, no RLS changes, no new secrets. Edge function redeploys on save. `ai_transfer_log` uses existing columns.
