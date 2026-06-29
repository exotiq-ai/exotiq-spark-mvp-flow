# FleetCopilot Phase 2 — Honest AI + Guardrails

_Status: draft for review. No code changes until approved. On approval, this is written verbatim to `docs/rari/FLEETCOPILOT_PHASE_2_PLAN.md` and `.lovable/plan.md` is updated to point at it._

## Goal

Phase 1 removed fabricated numbers at their call sites. Phase 2 makes the truth **structural**: one shared metrics library, visible provenance on every KPI, CI lint that fails on heuristic patterns, and observability on the digest. No schema changes, no new secrets, no visual redesign beyond source popovers and a methodology expand.

## Scope (in)

1. Shared metrics library
2. Real recommendations panel (replaces remaining canned content in `MotorIQEnhanced`)
3. Provenance UI primitive (`KpiSource`) + methodology expand in weekly digest
4. CI lint for KPI heuristics
5. Digest observability via existing `ai_transfer_log`
6. Cross-surface parity Vitest suite

## Out of scope

`suggested_rate` pricing model internals; Stripe/billing/LTV; new tables; RLS changes; new secrets; visual redesign beyond source popovers and methodology expand; legacy page work (already done in Phase 1).

## Workstreams

### 1. Shared metrics library

- New `shared/fleetMetrics.ts` exporting:
  - `computeUtilization(vehicles, bookings, asOf)` — average of per-vehicle day-share, matches Phase 1 inline version
  - `computeWeeklyRevenue(bookings, weekStart, weekEnd)` — overlap-weighted, matches Phase 1 inline version
  - `computeProjectedUpside(current, suggested, utilization)` — `(suggested−current)×30×(utilization/100)`, floored at 0
  - `computeMaxUpside(current, suggested)` — 100% utilization variant
- Vite alias `@shared/` → `./shared`
- `scripts/sync-shared-to-edge.mjs` copies `shared/fleetMetrics.ts` → `supabase/functions/_shared/fleetMetrics.ts` (Deno can't reach outside its function dir without bundler); hashes the file and writes a `// generated from shared/fleetMetrics.ts @ <sha>` header so drift is visible in diffs.
- Wire sync script into `predev`, `prebuild`, and the existing CI test step.

### 2. Refactor call sites

Replace inline math with shared lib imports in:
- `src/components/dashboard/MotorIQEnhanced.tsx`
- `src/components/dashboard/CoreEnhanced.tsx`
- `src/components/dashboard/DailyBriefCard.tsx` (utilization only)
- `supabase/functions/weekly-intelligence-digest/index.ts`

Remove the Phase 1 `// keep in sync` comments. No visual changes.

### 3. Real recommendations panel

- New `src/components/dashboard/MotorIQRecommendations.tsx` driven by `pricing_recommendations` rows.
- No canned rationale; `confidence` rendered only when the pipeline emits one (otherwise omitted, not faked).
- Replaces the current ad-hoc recommendation list inside `MotorIQEnhanced`.
- Empty state: `No recommendations yet — pricing pipeline runs daily.` (no fake rows).

### 4. Provenance UI

- New `src/components/ui/KpiSource.tsx` — small info-icon button + popover. Props: `{ table, column?, formula, sample? }`.
- Applied to every KPI tile in `CoreEnhanced` and `MotorIQEnhanced` (revenue, utilization, fleet count, projected upside, suggested rate, etc.).
- `WeeklyDigestCard` gets a "Methodology" expand inside the existing dialog explaining the four shared formulas in plain English, plus the `data_sources` / `coverage` block already emitted in Phase 1.
- Visual: matches existing shadcn popover styling; no new design tokens.

### 5. CI lint — `scripts/audit/check-kpi-provenance.mjs`

Fails the build when committed code matches any of:
- `Math.round\([^)]*\*\s*0\.5` — "time saved" multipliers
- `\*\s*10\b[^.]*Math\.min\([^,]+,\s*100\)` — fake utilization
- `\*\s*30\b[^;\n]*\$` — `× 30` next to a dollar sign without an accompanying utilization factor
- `confidence\s*=\s*\d+\s*-` — decorative confidence
- `['"]miami['"]` inside `supabase/functions/weekly-intelligence-digest/`
- `Lotus\s*Evija` as a string literal in `src/components/`

Allowlist via `// kpi-lint-ignore-next-line <reason>` comment (reason required). Wired into the existing `npm test` script and `.github/workflows/ci.yml`.

### 6. Digest observability

Write one row to existing `ai_transfer_log` per digest generation:
- `direction`: `outbound`
- `payload_hash` (sha256 of the JSON payload sent to the LLM)
- `prompt_hash` (sha256 of the system+user prompt)
- `model`, `tokens_in`, `tokens_out` (already returned by the gateway)
- `metadata`: `{ bookings_counted, vehicles_counted, city_resolved, week_start, week_end, rejected_for_invented_figures: boolean }`

Uses existing columns only; no migration.

### 7. Cross-surface parity test

- New `src/test/fleetMetricsParity.test.ts` with a fixture dataset (3 vehicles, 8 bookings spanning a week boundary, 2 pricing recommendations).
- Asserts identical utilization / weekly revenue / projected upside across `MotorIQEnhanced`, `CoreEnhanced`, `DailyBriefCard`, and the digest helper.
- Unit tests for each shared function (edge cases: empty input, week-boundary overlap, 0% utilization, suggested < current).

## Verification gates

- `npm test` (Vitest) — shared lib units + parity suite green.
- `scripts/audit/check-kpi-provenance.mjs` — green; intentionally seed one violation in a throwaway branch to confirm it fails.
- Playwright snapshot of `/dashboard` — visual diff limited to the new info-icons; KPI text unchanged.
- Manually trigger `weekly-intelligence-digest`; confirm one new `ai_transfer_log` row with expected metadata.

## Acceptance

- Every KPI tile in `CoreEnhanced` and `MotorIQEnhanced` has a `KpiSource` popover citing table + formula.
- All four surfaces import from `shared/fleetMetrics.ts`; no inline duplication remains.
- `MotorIQRecommendations` renders only real rows; empty state is honest.
- CI lint blocks reintroduction of the Phase 1 patterns.
- Each digest run produces one `ai_transfer_log` row.
- Parity test passes; intentionally breaking one call site's import makes it fail.

## Risks & reversibility

- **Stale edge-fn copy of `fleetMetrics.ts`** — main regression risk. Mitigated by `pre*` hash header + parity test (which imports both copies and compares outputs on the fixture).
- **Lint false positives** — allowlist comment requires a reason; reviewed in PR.
- All changes additive or behind imports; revert by restoring inline math from git.

## Sequencing

```text
Phase 2 PR
  ├─ add shared/fleetMetrics.ts + sync script + Vite alias
  ├─ refactor 4 call sites
  ├─ add MotorIQRecommendations
  ├─ add KpiSource + apply to tiles
  ├─ add methodology expand to WeeklyDigestCard
  ├─ add ai_transfer_log writes in digest
  ├─ add scripts/audit/check-kpi-provenance.mjs + wire to CI
  └─ add fleetMetricsParity.test.ts + per-fn unit tests
```

## Technical notes

- **Adds**: `shared/fleetMetrics.ts`, `supabase/functions/_shared/fleetMetrics.ts` (generated), `src/components/dashboard/MotorIQRecommendations.tsx`, `src/components/ui/KpiSource.tsx`, `scripts/sync-shared-to-edge.mjs`, `scripts/audit/check-kpi-provenance.mjs`, `src/test/fleetMetricsParity.test.ts`, `shared/__tests__/fleetMetrics.test.ts`.
- **Edits**: `MotorIQEnhanced.tsx`, `CoreEnhanced.tsx`, `DailyBriefCard.tsx`, `WeeklyDigestCard.tsx`, `weekly-intelligence-digest/index.ts`, `vite.config.ts` (alias), `package.json` (pre-hooks), `.github/workflows/ci.yml` (lint step).
- **Backend**: no migrations, no RLS changes, no new secrets. Edge function auto-deploys on save. `ai_transfer_log` writes use existing columns.
- **Bundle impact**: `KpiSource` reuses existing shadcn `Popover`; shared lib is pure functions, tree-shakeable.
