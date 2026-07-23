## Revenue chart overhaul — Tiers 1 + 2 + 3

Frontend-only. No schema changes, no backend writes.

### Tier 1 — correctness & trust
1. **Kill the fake compare** in `RevenueLineChart.tsx`. Replace `previousRevenue = activeData[i-1] * 0.92` with a real prior-period series: same range length shifted back, aligned index-by-index on the current x-axis.
2. **Reconcile the two "Total Revenue" numbers.**
   - Header tile in `RevenueLineChart`: rename to **"Range Total"** (reflects active range).
   - Outer widget tile in `RevenueWidget`: rename to **"All-time Revenue"**.
3. **Currency fix.** Replace hardcoded `$` in `RevenueLineChart` header tiles, y-axis, and tooltip with `useMoney()` (matches Orion UK fix already applied elsewhere).
4. **Tooltip / helper copy.** One-line definitions for Booked vs Collected shown on hover of the toggle badges.

### Tier 2 — usefulness
5. **Range switcher**: `7D · 30D · MTD · QTD · YTD`. Client-side slice off the existing data window in `useChartData`; extend the query window to cover YTD.
6. **7-day moving average overlay** (dotted line) computed in `useChartData`. Toggleable via a small "Avg" badge alongside Booked/Collected/Compare.
7. **Weekend shading** on the x-axis via `ReferenceArea` bands so weekend peaks read at a glance.
8. **Empty state** when active range has zero revenue: coaching card ("Revenue appears here once your first booking completes / is paid") instead of a flat zero line.

### Tier 3 — polish
9. **Delta chip in header** driven by the real Tier 1 compare: `▲ 12% vs prior {range}` with success/destructive coloring.
10. **Deep-link**: clicking the range label or a bar/point jumps to Payments filtered to that window (reuses existing Payments route + query params).
11. **Demote duplicate revenue tile** in `HeroKpiRail` — keep the tile but change its subline to "See Revenue Analytics for detail" and remove its own mini-sparkline math, so this widget is the single source of truth.

### Files touched
- `src/components/charts/RevenueLineChart.tsx` — range switcher, MA overlay, weekend bands, real compare, empty state, currency, delta chip, deep-link.
- `src/components/dashboard/widgets/RevenueWidget.tsx` — tile relabel, currency, wire range selection down.
- `src/hooks/useChartData.ts` — add `range` param, prior-period series, 7-day moving average, extend window to YTD.
- `src/components/dashboard/widgets/HeroKpiRail.tsx` — demote revenue tile subline (no math change).

### Out of scope
- No changes to bookings/payments schema or how revenue is recorded.
- No changes to the click-through `RevenueBreakdownDialog` beyond passing the selected day (already works).
- No new backend queries; all recomputation is client-side over already-loaded bookings/payments.

### Verification
- Build passes.
- Playwright screenshot at `/dashboard` at desktop + mobile widths confirming: range switcher renders, MA line visible, weekend bands visible, tiles read "Range Total" and "All-time Revenue", currency respects tenant (spot-check Exotiq = `$`, Orion = `£`).
