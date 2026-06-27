# Dashboard — Next-Level Visual & Information Design

Frontend-only refinement of `DashboardOverviewEnhanced` + its child widgets. No business logic, no data model changes. All wins come from typography, hierarchy, density, motion, and one new compact widget to fill the empty lower half.

## What's wrong with it today

Looking at the live preview:

1. **Editorial top, abandoned bottom.** Strong "Good evening, Gregory" hero, then a vast empty page below the three small cards. The eye falls off a cliff.
2. **KPI strip is flat text.** `20 OUT · 6 PICKUPS · 4 RETURNS · $37k COLLECTED` reads like a caption, not a dashboard headline. No deltas, no spark, no color signal.
3. **Needs-You list is monotone.** Five rows with identical visual weight; severity dots are tiny and the only differentiator. The $3.18M outstanding deserves a different treatment than "1 open damage claim."
4. **Three bottom cards feel orphaned.** Revenue / Fleet / Next 4 Hours are visually inconsistent (sparkline vs bar vs empty state) and don't tile with the brief above.
5. **No "second screen."** Everything important is above the fold but nothing rewards scrolling — no this-week view, no fleet pulse, no recent activity.
6. **Motion is absent.** Numbers don't count up, the brief doesn't reveal, the severity dots don't pulse.

## The design move

Treat the dashboard as an **editorial command center** — three deliberate bands, each with its own visual register, separated by generous whitespace. Apple Newsroom meets Bloomberg Terminal meets Linear.

```text
┌───────────────────────────────────────────────────────────┐
│ BAND 1 — HERO BRIEF                                       │
│  Greeting · date · live KPI rail (count-up + delta chips) │
│  Narrative paragraph                                      │
│  Needs-You punch list (tiered: critical / warn / fyi)     │
├───────────────────────────────────────────────────────────┤
│ BAND 2 — TODAY AT A GLANCE                                │
│  Revenue · Fleet donut+bar · Next 4 hours timeline        │
│  (unified card chrome, equal heights, shared accent)      │
├───────────────────────────────────────────────────────────┤
│ BAND 3 — PULSE (new, fills the void)                      │
│  Live activity feed + module quick-jump tiles             │
└───────────────────────────────────────────────────────────┘
```

## Concrete refinements

### 1. Hero KPI rail — from caption to instrument
- Replace inline `20 OUT · 6 PICKUPS …` text with a 4-cell rail of large tabular numerals (use existing `useCountUp` hook for entrance).
- Each cell gets: number, label (uppercase 11px tracking), and a delta chip vs yesterday (`+3 ▲` in success / `−2 ▼` in destructive). Delta uses semantic tokens only.
- Subtle vertical divider between cells (1px `border-border/40`), no boxes — keeps the editorial feel.
- `$37k collected` cell gets a 24px sparkline of last-7-day collections behind the number at 20% opacity.

### 2. Narrative paragraph — typographic polish
- Drop to `text-[15px] leading-[1.7] text-muted-foreground max-w-[68ch]` for readability.
- First sentence becomes `text-foreground` (lead), rest stays muted — classic editorial lede treatment.
- Inline numbers (`37%`, `170`, `14%`) get `font-medium text-foreground` so they pop without color.

### 3. Needs-You — tiered punch list
- Split into **Critical** (red dot, larger row, bold first line) and **Heads-up** (amber/blue dot, compact row). Currently everything is one flat list.
- Critical rows get a left accent bar (`border-l-2 border-destructive/60`) and a one-line "fix it" CTA on hover (e.g., "Send dunning batch →" for balance-due).
- Resolved items animate out with a checkmark sweep instead of just disappearing.
- Row hover: subtle `bg-muted/40` + chevron slides right 2px. Already exists, but tighten the timing to 150ms ease-out.

### 4. Today-at-a-glance cards — unify the chrome
- Same card shell, same header pattern (label left / metric right / icon ghosted top-right at 8% opacity).
- Revenue card: sparkline becomes a proper area gradient (`from-primary/20 to-transparent`), add "vs last Sat" delta chip in the header.
- Fleet card: keep the stacked bar but add tiny labels under each segment and make the donut/bar choice consistent with Pulse.
- Next-4-hours card: when empty, replace the dead-feeling "Quiet stretch ahead" with a horizon timeline (4 ticks showing the next 4 hours, even when empty) so the card has visual structure either way.

### 5. New "Pulse" band — kill the empty void below
Add a third band below the three cards (still part of `DashboardOverviewEnhanced`, no nav changes):
- **Left (2/3 width):** Live activity strip — last 6 events (bookings created, check-ins, payments) as a vertical timeline with relative timestamps. Reuses existing `useTeamActivity` data; no new queries.
- **Right (1/3 width):** Quick-jump module tiles — 2×2 grid of Bookings / Fleet / Pulse / MotorIQ as small icon tiles with the current count (`12 today`, `54 vehicles`). Replaces the implicit "scroll down to find more" with explicit affordances.

### 6. Motion — restrained but alive
- Hero numbers: count-up on mount (existing `useCountUp`, 600ms, ease-out).
- Brief paragraph: 200ms fade + 4px rise, staggered after KPIs.
- Needs-You rows: 40ms stagger fade-in.
- Critical-severity dot: very subtle `animate-pulse` (already in CSS) at 2s interval — only on critical, not on warn/fyi.
- No bouncing, no spinning, no gradient flow. Reject the AI-dashboard cliché.

### 7. Typography & spacing pass
- Greeting "Good evening, Gregory." stays at current size but switches to `tracking-tight` and pairs with a single-line subhead `text-xs uppercase tracking-[0.18em] text-muted-foreground/70`.
- `NEEDS YOU 7` header treatment becomes the canonical section label across all three bands.
- Vertical rhythm: bump band separators from current spacing to `mt-10` between bands; tighten within-band to `gap-4` so density stays high inside but bands breathe between.
- All numerals use `tabular-nums` so columns don't jitter on update.

### 8. Density & responsiveness
- Today | This Week pill stays top-right but loses the icons (cleaner).
- On `<md` the KPI rail wraps 2×2 with the same dividers.
- The new Pulse band stacks vertically on `<md`.

## Out of scope (explicitly)

- No sidebar changes, no nav changes, no new routes.
- No new tables, no new edge functions, no new realtime channels (reuse `useTeamActivity`).
- No drag-and-drop layout, no widget marketplace (the dormant `CustomizableDashboard` stays parked).
- No color palette change — pure refinement on existing semantic tokens.
- Mobile-specific polish beyond responsive stacking is a follow-up.

## Files touched

**Edit:**
- `src/components/dashboard/DashboardOverviewEnhanced.tsx` — band structure, motion wiring
- `src/components/dashboard/DailyBriefCard.tsx` — KPI rail, tiered Needs-You, narrative typography
- `src/components/dashboard/widgets/RevenueWidget.tsx` — gradient sparkline + delta chip
- `src/components/dashboard/widgets/FleetStatusWidget.tsx` — unified chrome
- `src/components/dashboard/widgets/ScheduleWidget.tsx` (Next 4 Hours) — horizon timeline empty state
- `src/index.css` — one new utility for the tabular-numerals + tracking pairing if needed

**New (small, focused):**
- `src/components/dashboard/widgets/HeroKpiRail.tsx` — the 4-cell rail with count-up + deltas
- `src/components/dashboard/widgets/LiveActivityStrip.tsx` — Band 3 left side, wraps `useTeamActivity`
- `src/components/dashboard/widgets/QuickJumpTiles.tsx` — Band 3 right side, 2×2 module grid

## Validation

After build, capture a Playwright screenshot of `/dashboard` at 1280×1800 and compare side-by-side with the current capture to confirm: empty void is gone, KPI rail reads as the hero metric, Needs-You has visible tiering, no horizontal overflow, motion fires once on mount.

---

Want me to push on this as-is, or would you rather I generate 2–3 rendered visual directions for the hero band first so you can pick the typographic register before I build?
