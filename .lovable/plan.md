# Dashboard Pixel-Density Pass — Today & Week

_Audit + redesign plan. No code ships until approved._

## Diagnosis (what's costing pixels)

**Today view (`DailyBriefCard`)**
- Header eats ~80px on "Good morning, Name." + uppercase company/date line + a pill toggle. Three rows of chrome before any number.
- `HeroKpiRail` is a fifth row of large numerals on top of the actual KPI tiles in `CoreEnhanced` — duplication across surfaces.
- Narrative paragraph is a full 68ch block; first sentence already carries the meaning, the muted tail is mostly filler.
- Punch list uses a section label (`Needs you · 3`), then a `Heads up` sub-label, then 60px tall critical rows with pulsing dots and pill backgrounds. A 3-item list takes ~280px.
- "All clear" empty state is a 4-line block where one line would do.
- `AIBadge`, gradient backgrounds, and decorative `card-premium` shadows on nearly every surface compete for attention.

**Week view (`WeeklyDigestCard`)**
- Card header (icon-in-rounded-square + title + "New" badge + subtitle + chevron) takes ~64px before any data.
- KPI quad uses 4 columns of label-icon + label + big number + delta — but each tile repeats `text-xs text-muted-foreground` + 12px icon, all decoration, no scale or sparkline.
- "Top Action" gets its own bordered green panel below the grid for a single sentence.
- Sources footer is a 10px line buried after the action panel — provenance hidden where it can't be glanced.
- The dialog re-renders the same 4 KPIs in colored panels (success/primary/accent/warning) — pure decoration, no new info.
- Outlook section shows events as full-width rows with `Sparkles` icon + name + date + impact badge — 56px per event.

**Cross-cutting**
- Five different accent colors per card (primary/accent/success/warning/destructive) with gradient washes — every tile shouts.
- Icons everywhere (24 unique lucide imports in the digest alone) — most are decorative, not informational.

## Principles for the pass

1. **One headline per screen.** Greeting and KPI rail share the top band; everything else is supporting.
2. **Numbers over chrome.** Tabular numerals, hairline dividers, no card backgrounds where a row will do.
3. **One accent color.** Reserve color for state (critical/positive change), not for category labels.
4. **Icons earn their pixels.** Drop decorative icons; keep only state indicators (trend arrow, status dot) and affordances (chevron on clickable rows).
5. **Provenance always visible, never loud.** Sources line stays, but as a single hairline strip under the headline, not a footnote.

## Today view — proposed changes

1. **Compress the header band** into a single row: `Good morning, Jordan. — Mon, Jun 29 · Exotiq Miami` rendered as one line at 18px with tracking, mode toggle inline. Saves ~50px.
2. **Replace `HeroKpiRail`** with a 4-up inline KPI strip directly under the header — same numerals, no card, hairline divider above and below. Drop revenueToday if it duplicates `CoreEnhanced`; otherwise keep all four. Each KPI: large tabular number, micro-label, optional delta chip. No icons.
3. **Narrative**: keep first sentence at body weight, drop the muted tail entirely (it's restating counts already in the rail). One-sentence read max.
4. **Punch list**:
   - Remove the `Needs you · N` section heading and the `Heads up` sub-heading. The tiered visual treatment already encodes priority.
   - Critical rows: drop the pulsing dot animation; use a 3px left border in destructive + foreground text. Compact to 44px min-height.
   - Heads-up rows: remove the bordered divider strip; render as plain rows with a `·` separator before the detail text. 36px min-height.
   - "View all" link moves inline at the end of the list rather than the top-right corner.
5. **All-clear**: collapse to a single line `All clear — nothing needs you right now.` inline with a `CheckCircle2`.
6. **Pull `WeeklyDigestCard` into the Today view as a single hairline strip** at the bottom: `Week in review: $42.1K rev · 18 bookings · 64% util → tap for full digest`. Removes the need to switch modes for a glance.

## Week view — proposed changes

1. **Mode toggle becomes redundant** if Today already shows the week strip; demote `mode==='week'` to a full-page detail of the digest only (drop the BriefHeader duplication).
2. **Digest card collapsed state**: drop the icon-in-square + subtitle + chevron header. Replace with a single row: `Week of Jun 23 — Jun 29 · Generated 2h ago · Regenerate`. The card itself is the affordance.
3. **KPI quad** becomes a 4-column inline strip (same pattern as Today): tabular numerals, micro-label, delta chip. Drop the per-tile icons. Add a 60px sparkline above each number showing the 8-week trend — this is the one place a chart earns its pixels.
4. **Top Action** moves to a single foreground line directly below the KPI strip — no green panel, no `Zap` icon. Treat it like a pull-quote: italic, foreground color, left-aligned, max 2 lines.
5. **Sources strip** moves from footer to a hairline row directly under the action line: `bookings · vehicles · pricing · Miami` in 11px muted. Always visible at glance.
6. **Dialog (full digest)**:
   - Drop the colored quad re-render — show the same 4 KPIs but expanded with the sparkline and a methodology popover (already planned in Phase 2).
   - Outlook events: collapse to a 2-column dense list — `Date · Event name` left, `impact` right as a single letter pill (H/M/L). 28px per row instead of 56.
   - Remove the second "Top Action" panel; the action already lives on the card.
   - Add a `Methodology` accordion at the bottom (Phase 2 hook).

## Cross-cutting cleanup

- Standardize on **one accent color** (primary) plus `success` / `destructive` for state. Retire `accent` and `warning` washes inside dashboard cards.
- Remove `card-premium` gradient washes on `DailyBriefCard` and `WeeklyDigestCard`; use plain `border-border/60` + `bg-card`. Reserve gradient treatment for the landing/hero contexts.
- Adopt `tabular-nums` globally on KPI numerals so columns align across rows and surfaces.
- Audit lucide imports per file; drop any icon not serving state or affordance. Target: digest from 14 icons → 4 (`ChevronRight`, `RefreshCw`, `TrendingUp/Down`).

## Verification

- Before/after Playwright screenshots of `/dashboard` in Today and Week modes at 1280×1800 and 390×844.
- Pixel-count check: header band <56px, each punch-list row ≤48px critical / ≤36px heads-up, digest collapsed card ≤220px total.
- Vitest snapshot on `DailyBriefCard` props rendering (no logic changes — pure presentation).
- Manual: confirm Today's week strip and full week view show identical numbers (parity guarded by shared lib once Phase 2 lands).

## Out of scope

- Data layer changes, new metrics, sparkline data source wiring (uses existing `weekly_digests` history if present; otherwise sparklines hidden until Phase 2 backfills).
- KPI provenance popovers — that's the Phase 2 plan already drafted; this redesign leaves the hook points in place.
- `CoreEnhanced` / `MotorIQEnhanced` tile redesign — separate pass.

## Sequencing

```text
1. Header band + KPI strip (Today)
2. Punch list compaction
3. Narrative trim + all-clear collapse
4. Week strip insert at bottom of Today
5. WeeklyDigestCard collapsed-state redesign
6. Dialog content compaction + sparkline placeholder
7. Cross-cutting: drop card-premium washes, tabular-nums, icon cull
8. Playwright before/after + pixel-budget check
```

## Technical notes

**Touches**: `src/components/dashboard/DailyBriefCard.tsx`, `WeeklyDigestCard.tsx`, `widgets/HeroKpiRail.tsx` (likely deleted or inlined), `src/index.css` (tabular-nums utility if not present). No hook or data changes; no edge function changes; no schema work.
