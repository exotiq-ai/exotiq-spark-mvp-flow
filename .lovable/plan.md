
## My honest read of Margin today

**What's working:** The content is rich, the numbers are truthful now (post Phase 1), and the tab depth (Per-Vehicle, Expenses, Review, Partners, Payouts, Deposits) is genuinely differentiated.

**What's not:**
1. **Not cohesive with the rest of the platform.** Dashboard and Pulse use a hero KPI rail with delta chips (`HeroKpiRail`, `DeltaChip`, `PulseStrip`). Margin uses a flat 2×4 grid of look-alike cards with no deltas, no sparklines, no hierarchy. It reads like a spreadsheet, not a Porsche/Apple-tier surface.
2. **A new user won't understand it quickly.** Eight KPIs of equal visual weight = no anchor. "Operator Net" and "Margin %" are the answer, but they sit visually equal to "Platform Fees" and "Outstanding." The 77.6% headline number is buried in the 8th tile.
3. **Action items are buried.** There's no "what needs my attention" strip. A user has to scroll to Review / Payouts / Deposits tabs to find: unmatched expenses, pending payouts ($57k!), overdue deposits, unreviewed bookings. These are the *reasons to open Margin* — they belong at the top.
4. **Trust-breakers on screen:** Top 5 by Margin shows five vehicles all at "100.0%" — because most have zero costs recorded. That looks broken. Bottom 5 opens with "-151.4%" with no explanation. Expense Breakdown shows only "Registration $500 · 100%" — an empty-ish card taking prime real estate.
5. **Density issues:** Per-Vehicle P&L has 8 columns of mostly-zero data, no totals footer, no sticky header, no visual weight on the Operator Net column that matters.

## The plan — three tight moves, presentation layer only

### 1. Redesigned hero rail (cohesion with Dashboard/Pulse)

Replace the 8-tile grid with a **3-zone hero** matching `HeroKpiRail` patterns:

```text
┌─────────────────────────────┬──────────────────┬──────────────────┐
│  OPERATOR NET (hero)        │  Margin %        │  Gross Booked    │
│  $200,754   ▲ 12% vs prev   │  77.6%  ▲ 3pp    │  $258,674  49 bk │
│  Jul 1–5 · This month        │  ↑ healthy        │  ▂▃▅▆▇ sparkline │
├─────────────────────────────┴──────────────────┴──────────────────┤
│  Collected $0 · Outstanding $258k · Fees $0 · Expenses $500 · Pending Payouts $57,420 │
│  (secondary strip, single row, muted, tabular-nums)                                    │
└────────────────────────────────────────────────────────────────────┘
```

- Hero uses `Card variant="premium"`, DeltaChip vs previous period, sparkline of daily net.
- Secondary metrics collapse to a single dense strip — same visual language as `PulseStrip`.
- Reuse `DeltaChip` + `useMoney` (already in codebase).

### 2. **"Needs Attention" action strip — above the fold**

New component `MarginActionStrip` placed *directly under filters, above the hero rail*. Auto-computed from existing hooks — no new queries:

```text
⚠  Needs your attention
  ● 3 expenses unmatched to vehicle    → Review tab
  ● $57,420 pending partner payouts    → Payouts tab
  ● 2 deposits held > 7 days past return → Deposits tab
  ● 4 bookings missing final review     → Review tab
```

- Each row is a clickable chip that switches to the relevant tab and pre-filters.
- Hidden entirely when zero items (no false urgency).
- Uses `Alert` + `Badge` primitives already in the design system.

### 3. Fix the trust-breakers + density

- **Top/Bottom Margin card:** when >50% of vehicles tie at 100% (no costs logged), auto-switch label to "Top by Revenue" and show a subtle helper: *"Log expenses to see true margin ranking."* Bottom card gets tooltip explaining negative margin = expenses exceed net revenue.
- **Expense Breakdown:** if only 1 category with data, collapse to a one-line summary instead of a full card. Free up the grid slot for the trend chart to go full width.
- **Per-Vehicle P&L table:**
  - Sticky header row.
  - Totals footer row (Gross / Net / Expenses / Payouts / Operator Net).
  - Zero values rendered as muted `—` instead of `$0.00` (reduces visual noise dramatically).
  - Operator Net column gets `font-semibold` + subtle left border to anchor the eye.
  - Add a tiny margin% column with color coding (green ≥30%, amber 10–30%, red <10%).
- **Header:** tighten subtitle to match Dashboard tone: *"Where the money went this period."*

## Files touched (presentation only, no logic/query changes)

- `src/components/margin/MarginOverview.tsx` — rewrite as hero + secondary strip using `DeltaChip`, `useMoney`, sparkline.
- `src/components/margin/MarginHeroOverview.tsx` — mobile variant, same pattern condensed.
- `src/components/margin/MarginActionStrip.tsx` — **new**, reads from `useMarginData` + `useMarginFilters`.
- `src/components/margin/TopBottomMarginVehicles.tsx` — auto-switch to Revenue mode when ties dominate, add helper text.
- `src/components/margin/ExpenseBreakdownChart.tsx` — collapse empty state.
- `src/components/margin/VehiclePnLTable.tsx` — sticky header, totals footer, muted zeros, emphasized Net col, margin% column.
- `src/components/dashboard/MarginEnhanced.tsx` — insert `<MarginActionStrip />` above hero; reflow grid if Expense Breakdown collapses.

## Out of scope (deferred to a Phase 3 if you want)

- Cash vs Accrual toggle
- AR Aging widget
- Monthly Snapshot job
- Any new backend queries or schema changes

## Acceptance

- Side-by-side with Dashboard, Margin visually reads as the same product.
- A new user, on first load, can answer in <5 seconds: *"Am I making money, and what do I need to do?"*
- Zero placeholder/empty cards on screen when data is sparse.
- Playwright screenshot check confirms hero rail matches Dashboard's `HeroKpiRail` visual weight.
