# FleetCopilot Number-Truth Audit & Fix Plan (v2)

_Status: draft for review. No code has been changed. Nothing ships until a follow-up plan is approved._

---

## 1. TL;DR

- The **Enhanced** surfaces (`MotorIQEnhanced`, `CoreEnhanced`, `WeeklyDigestCard`, `DailyBriefCard`) compute their headline numbers from real bookings/vehicles/locations data.
- The **legacy** surfaces (`Core.tsx`, `MotorIQ.tsx`) still ship and contain fabricated KPIs (made-up utilization, margin, "tasks automated", "time saved", confidence scores).
- `MotorIQEnhanced` has two honest-looking-but-wrong details: a hard-coded `Lotus Evija` filter and a `monthly opportunity` formula that ignores utilization.
- The `weekly-intelligence-digest` edge function has a hard-coded `'miami'` city fallback, sums revenue on `created_at` instead of the rental window, and uses a heuristic for `vehiclesRecommended`. Its prompt does not forbid the LLM from inventing figures.
- Phase 1 removes fabrications without schema changes. Phase 2 adds a shared metrics library, provenance UI, and CI guardrails so this can't regress.
- Out of scope (both phases): the `suggested_rate` pricing model itself, Stripe/billing/LTV math, new tables, RLS changes, and any visual redesign beyond source popovers and a methodology expand.

---

## 2. Audit Findings

### 2.1 Real numbers — keep as-is

| Surface | Numbers | Source |
|---|---|---|
| `MotorIQEnhanced.tsx` | weekly revenue, per-vehicle utilization, current/suggested daily rate | `bookings`, `vehicles`, `pricing_recommendations` |
| `CoreEnhanced.tsx` | fleet count, active bookings, insight counts | `vehicles`, `bookings`, `ai_insights` |
| `WeeklyDigestCard.tsx` | rendered totals (revenue, utilization, demand surge) | `summary_json` from edge function |
| `DailyBriefCard.tsx` | today's bookings, returns, available units | deterministic client compute |

### 2.2 Fabricated numbers — fix

**`src/pages/Core.tsx`**
- `% Tasks Automated = activeBookings / totalVehicles × 100` — unrelated to automation.
- `Time Saved Daily = totalVehicles × 0.5h` — invented multiplier.
- "24/7 AI Monitoring" rendered as a numeric tile.

**`src/pages/MotorIQ.tsx`**
- `utilizationRate = vehicleBookings.length × 10` (capped at 100) — not utilization.
- `margin`, `marginTrend` derived from the fake utilization.
- `suggestedIncrease = currentRate × (0.10 + index × 0.05)` — no underlying model.
- `potentialImpact = suggestedIncrease × 4` — assumes 4 bookings/week.
- `confidence = 95 − index × 8` — pure decoration.

**`src/components/dashboard/CoreEnhanced.tsx`**
- "24/7 Monitoring" chip styled like a KPI.

**`src/components/dashboard/MotorIQEnhanced.tsx`**
- Hard-coded `Lotus Evija` exclusion from recommendations.
- `monthly opportunity = (suggested − current) × 30` — assumes 100% utilization, no caveat.

**`supabase/functions/weekly-intelligence-digest/index.ts`**
- Hard-coded `city = 'miami'` for the events lookup.
- Utilization labeled "weekly" but computed as a today-snapshot.
- Revenue summed by `created_at` (booking creation), not by overlap with the rental window inside the week.
- `vehiclesRecommended = demandSurge > 15 ? min(fleet, 3) : 0` — heuristic, not a real count.
- LLM prompt does not forbid invented dollar/percent figures.

---

## 3. Phase 1 — Truth Fixes (no schema changes)

### 3.1 Pre-flight
- `rg "from .*pages/Core['\"]|<Core ?/>|from .*pages/MotorIQ['\"]|<MotorIQ ?/>" src` to confirm `Enhanced` variants are the only live ones.

### 3.2 Deletions
- Remove `src/pages/Core.tsx`.
- Remove `src/pages/MotorIQ.tsx`.
- Drop any orphan routes/imports surfaced by the grep.

### 3.3 Edits

**`CoreEnhanced.tsx`** — replace the "24/7 Monitoring" chip with one of:
- `Last sync · 2m ago` (computed from the most recent insight/booking update), or
- plain `Live` status badge.

**`MotorIQEnhanced.tsx`**
- Drop the Lotus Evija filter; recommendations apply to every vehicle with a `pricing_recommendation`.
- Rename "Monthly opportunity" → **"Projected monthly upside"**.
- New formula: `(suggested − current) × 30 × (utilization / 100)`.
- Tooltip text: _"Assumes the next 30 days hold this week's utilization. Max upside shown as a secondary line."_
- Secondary line: `Max upside at 100% utilization · $X`.

**`supabase/functions/weekly-intelligence-digest/index.ts`**
- Resolve city from the tenant's primary `locations.city`. If null, skip the events lookup and omit the events section from `summary_json` rather than defaulting to Miami.
- Use the same `computeUtilization` formula as `MotorIQEnhanced` (see Phase 2 §4.2 for the shared lib; in Phase 1 it's duplicated inline with a `// keep in sync with MotorIQEnhanced` comment).
- Weekly revenue: overlap-weighted sum across `[weekStart, weekEnd)` using `start_date`/`end_date`.
- `vehiclesRecommended`: real count from `pricing_recommendations` where `suggested_rate > current_rate` within the week.
- Tighten the LLM prompt: explicit `Do not invent dollar or percent figures. Only reference numbers present in the JSON payload below.` plus a post-generation regex check that rejects `$\d` or `\d%` tokens not present in the payload.
- Extend `summary_json` with:
  - `data_sources`: `["bookings", "vehicles", "locations", "pricing_recommendations"]`
  - `coverage`: `{ week_start, week_end, vehicles_counted, bookings_counted, city_resolved }`

**`WeeklyDigestCard.tsx`**
- Render a small footer: `Sources: bookings · vehicles · pricing · {city or "no city set"}`.

### 3.4 Verification gates
- Playwright snapshot of `/dashboard` KPI tiles before/after; diff reviewed.
- Vitest pure-function tests for the new overlap-weighted revenue and projected-upside formulas.
- Acceptance:
  - No `× constant` formulas remain in any visible `+$` or `% impact` figure.
  - Digest never returns event recommendations when city can't be resolved.
  - Utilization parity within ±1% across `DailyBriefCard`, `MotorIQEnhanced`, `PlatformPulseStrip`, and digest on the same dataset.

---

## 4. Phase 2 — Honest AI + Guardrails (opt-in)

### 4.1 Real recommendations panel
- New `src/components/dashboard/MotorIQRecommendations.tsx`.
- Reads `pricing_recommendations` directly — no canned rows, no decorative confidence.
- Shows confidence only if the pipeline emits one; otherwise omits the field.

### 4.2 Shared metrics library
- New `shared/fleetMetrics.ts` exporting:
  - `computeUtilization(vehicles, bookings, asOf)`
  - `computeWeeklyRevenue(bookings, weekStart, weekEnd)` (overlap-weighted)
  - `computeProjectedUpside(current, suggested, utilization)`
- Wired into Vite via `@shared/` alias.
- Synced to the edge function via a small build step (`scripts/sync-shared-to-edge.mjs`) that copies the file into `supabase/functions/_shared/` so Deno can import it without a bundler.
- Refactor four call sites to import from the shared lib.

### 4.3 Provenance UI
- New `src/components/ui/KpiSource.tsx` — info-icon popover showing table/column/formula behind a KPI.
- Applied to every KPI tile in `CoreEnhanced` and `MotorIQEnhanced`.
- "Methodology" expand inside the weekly digest dialog explaining the formulas in plain English.

### 4.4 CI lint
- New `scripts/audit/check-kpi-provenance.mjs` — fails the build on patterns like `Math.round(* 0.5)`, `* 10` capped at 100, `\* 30` next to dollar signs, or `confidence = \d+ -`.
- Wired into the existing test script.

### 4.5 Observability
- Log digest inputs and outputs (bookings count, vehicles count, city, prompt hash, payload hash, model output) to `ai_transfer_log` per generation. Uses the existing table.

### 4.6 Cross-surface parity test
- Vitest suite that constructs a fixture dataset and asserts all four surfaces return identical utilization, revenue, and upside numbers.

---

## 5. Out of Scope

- How `suggested_rate` is computed inside the pricing pipeline.
- Stripe/billing/LTV math.
- New tables, RLS changes, new secrets.
- Visual redesign beyond the source popovers and methodology expand.

---

## 6. Risks & Reversibility

- Legacy page deletions are reversible via git history.
- First post-change digest will look different; add a one-line `Methodology updated` note inside the digest dialog for that week.
- The shared metrics file is duplicated into the edge function via a build script — a stale copy is the main regression risk; the parity test in §4.6 catches it.

---

## 7. Sequencing

```text
Phase 1 PR
  ├── pre-flight grep
  ├── delete legacy pages
  ├── edit CoreEnhanced, MotorIQEnhanced
  ├── edit weekly-intelligence-digest + WeeklyDigestCard
  └── add Vitest + Playwright gates
            │
            ▼  (merge, observe one weekly digest cycle)
Phase 2 PR
  ├── add shared/fleetMetrics.ts + sync script
  ├── refactor 4 call sites
  ├── add MotorIQRecommendations, KpiSource, methodology expand
  ├── add ai_transfer_log writes
  └── add CI lint + parity test
```

---

## 8. Technical Notes

**Phase 1 file touches**
- Delete: `src/pages/Core.tsx`, `src/pages/MotorIQ.tsx`
- Edit: `src/components/dashboard/CoreEnhanced.tsx`, `src/components/dashboard/MotorIQEnhanced.tsx`, `src/components/dashboard/WeeklyDigestCard.tsx`, `supabase/functions/weekly-intelligence-digest/index.ts`
- Routing: whatever the grep surfaces in `src/App.tsx` / route config

**Phase 2 file touches**
- Add: `shared/fleetMetrics.ts`, `supabase/functions/_shared/fleetMetrics.ts` (synced), `src/components/dashboard/MotorIQRecommendations.tsx`, `src/components/ui/KpiSource.tsx`, `scripts/sync-shared-to-edge.mjs`, `scripts/audit/check-kpi-provenance.mjs`
- Refactor: `MotorIQEnhanced.tsx`, `CoreEnhanced.tsx`, `WeeklyDigestCard.tsx`, `weekly-intelligence-digest/index.ts`

**Backend**
- No migrations, no RLS changes, no new secrets.
- Edge function redeploys automatically on save.
- `ai_transfer_log` writes use existing columns.
