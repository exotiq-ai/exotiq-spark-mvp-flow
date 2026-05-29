# Margin — Mobile UI Refinement

Goal: bring Margin to the same calm, premium mobile feel as Bookings / FleetCopilot. Reduce vertical noise, fix wrapping, and make sub-views feel intentional instead of a wall of tabs.

Scope: **mobile (<768px) presentation only**. Desktop layout untouched. No business logic, RPC, or data-shape changes.

---

## 1. Header & filter bar
- Single-line header: `Margin` title + compact `This month ›` chip that opens a bottom sheet.
- Move all filters (date preset, custom range, Locations, Vehicles, Sources, Reset) into a **mobile filter sheet** triggered by a Filters icon button with a count badge. Desktop keeps current inline bar.
- Sticky compact summary strip under the header: `May 1 – May 29 · 14 bookings · $118k gross`.

## 2. KPI overview — hero + swipeable strip
Replace the 8-card 2-up grid with:

```text
┌────────────────────────────┐
│ Operator Net   ▲ 32.5%     │
│ $38,420.00                 │
│ from $118,040 gross        │
│ ─────────────────────────  │
│ Collected $0 · Outstanding │
│ $118,040 · Fees $0         │
└────────────────────────────┘
   ● ○ ○ ○
```

- Hero: Operator Net + Margin %, sparkline trend.
- Swipe / dots reveal: Revenue (Gross+Collected), Costs (Fees+Expenses), Partners (Payouts pending+total).
- Each secondary card tappable → bottom sheet with existing tooltip copy.
- `tabular-nums`, `truncate`, single currency style; drop per-card icon row on mobile.

## 3. Charts
- `RevenueExpenseTrendChart`: full-bleed on mobile, floating title chip.
- `ExpenseBreakdownChart`: slim inline empty-state row instead of tall empty card.
- `RevenueBySourceCard`: stack source/amount on <360px, keep one-line ≥360px.

## 4. Top / Bottom margin vehicles
- Merge into one **segmented card** with `Top | Bottom` toggle (mirrors Bookings segmented control).
- Row: vehicle name (truncate) → right rail margin % bold, gross $ small underneath.

## 5. Sub-tabs — scrollable segmented bar
- Mobile: replace wrapped `TabsList` with a **horizontally scrollable segmented bar** (snap-x, no wrap) matching FleetCopilot.
- Active tab uses existing pill highlight; subtle right-edge fade as overflow indicator.

## 6. Tab content polish
- **VehiclePnLTable**: stacked summary rows (title=vehicle, value=net, expandable to bookings/gross/fees/expenses). CSV export in a sticky tab footer.
- **Expenses / PartnerPayouts / Deposits / Partners**: same row pattern. Primary line = entity, right rail = amount + status badge. Tap → existing drawer/dialog.
- Bulk actions: floating bottom action bar when ≥1 row selected (matches Fleet selection UX).

## 7. Tenant Overhead
Single line: label left, amount right. Descriptive paragraph moves to an `(i)` popover.

## 8. Spacing / typography
- `space-y-6` → `space-y-4` on mobile.
- Card `p-4` → `p-3.5` on mobile.
- `Margin` heading `text-2xl` → `text-xl`.
- All currency `tabular-nums`, no truncation that hides decimals.

---

## Technical notes
- New: `src/components/margin/MarginMobileFilterSheet.tsx` (wraps existing filter controls in a `Sheet`).
- New: `src/components/margin/MarginHeroOverview.tsx` (mobile KPI carousel using existing `useMarginData` aggregators; desktop keeps `MarginOverview`).
- Update: `TopBottomMarginVehicles` with segmented toggle.
- `useIsMobile()` in `MarginEnhanced.tsx` picks mobile vs desktop layout components — no duplicate routing.
- Tabs: conditional `flex overflow-x-auto snap-x` className on mobile.
- All colors via design tokens. Reuse `Card`, `Sheet`, `Badge` patterns. No new dependencies.

## Out of scope
- Desktop layout.
- New metrics, filters, or payout logic.
