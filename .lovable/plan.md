## Problem

The Per-Vehicle P&L table has 9 columns of currency data. On typical laptop widths it overflows horizontally, and because the horizontal scrollbar sits at the bottom of the scroll container, the user has to scroll all the way down before they can scroll right. Vehicle names also wrap onto 2–3 lines, eating vertical space.

## Fix: reclaim horizontal space + make the scrollbar reachable

**1. Tighten the left column (biggest win)**
- Widen the Vehicle column and stop wrapping (`whitespace-nowrap` + `min-w-[180px]`) so "Lamborghini Aventador SVJ" sits on one line.
- Trim outer card/table padding on the P&L card so the table can use the full module width (drop the extra horizontal padding on `CardContent` — it already has `p-0`, but the parent grid adds gutters we can tighten at the Margin page level for the P&L row only).

**2. Compact the columns**
- Shorten headers: "Platform Fees" → "Fees", "Partner Payouts" → "Payouts", "Operator Net" stays but gets a smaller label style. (Fees/Payouts headers are already short — keep.)
- Right-align numeric headers tightly and remove the `ArrowUpDown` icon gap on numeric columns (icon only shows on hover or when active) to save ~16px per column.
- Use `tabular-nums text-sm` and reduce cell horizontal padding from default to `px-2` on numeric cells.
- Abbreviate currency in the table body when values are ≥ $10k (e.g. `$1.04M`, `$149.7k`) via a compact formatter; keep full precision in the CSV export and in the row-detail drill-down.

**3. Make the horizontal scrollbar reachable without scrolling down**
- Move horizontal scrolling to a sticky inner wrapper so the scrollbar is visible at the top of the table viewport, not only at the bottom of a 560px scroll area. Concretely: keep `max-h-[560px] overflow-y-auto` on the outer div, and add `overflow-x-auto` on an inner wrapper that also carries `sticky top-0`-friendly sizing so the user sees the scrollbar without scrolling to the last row.
- Alternative if sticky is fragile: add a thin always-visible horizontal scroll shadow/indicator on the right edge of the table (fade + chevron) so users know content extends right, and enable shift+wheel horizontal scroll.

**4. Freeze the Vehicle column**
- Make the first column `sticky left-0 bg-background` (both header and body cells) so scrolling right never hides which vehicle a row belongs to. This is what makes the horizontal scroll actually usable at narrower widths.

## Out of scope

- No changes to totals math, sorting behavior, CSV contents, or the row-detail drill-down.
- No changes to other Margin cards.

## Files

- `src/components/margin/VehiclePnLTable.tsx` — column widths, sticky first column, compact number formatter for display, header tweaks, padding.
- `src/lib/marginCsv.ts` — add a `formatCurrencyCompact` helper (CSV export keeps `formatCurrency`).

## Acceptance

- At 1280px width, all 9 columns fit without horizontal scroll.
- At <1100px, horizontal scroll works and the Vehicle column stays visible while scrolling right.
- Vehicle names render on one line.
- CSV export values unchanged (full precision).
