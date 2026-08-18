# Fix the Fleet filters dropdown: scrolling and full visibility

The Filters panel on the Fleet page grows taller than the browser window, so the lower sections (Location, Make, Year, price sliders) get cut off and the panel does not scroll. The header and the Done footer are also pushed off-screen on shorter windows.

## What's wrong

The panel is built as: sticky header + scrolling body + sticky footer, with the panel capped at the space Radix reports as available. The scrolling body uses a ScrollArea sized with `flex-1`, and its inner viewport is sized as a percentage of a parent that only has a *max* height, not a fixed height. A percentage height against a max-height-only parent resolves to "auto", so the body never gets a scroll boundary — it just grows and the whole panel overflows the screen.

## The fix

1. Replace the ScrollArea body with a plain scrolling container (`flex-1 min-h-0 overflow-y-auto overscroll-contain`), which scrolls correctly inside a max-height flex column and keeps the native scrollbar visible.
2. Add a hard height cap on the panel as a safety net alongside the Radix available-height value, so the panel can never exceed the window even if the measured value is unavailable at first paint.
3. Keep the header and footer pinned so "Clear all", the vehicle count, and "Done" are always reachable.
4. Ensure the nested Location/Make combobox lists keep their own inner scroll and don't fight the outer scroll (they already cap at a fixed height; verify no scroll trapping).

## Verification

- Fleet page at desktop (1532x988), a short laptop window (~700px tall), tablet, and mobile widths: open Filters and confirm every section down to the price sliders is reachable by scrolling, and the Done footer stays visible.
- Exercise each control after scrolling — quick toggles, booking status, ops status, location, make, year, price — and confirm the vehicle count in the footer updates and the grid filters correctly.
- Confirm scrolling inside the Location/Make dropdowns doesn't scroll the panel behind them.

## Technical notes

Single file: `src/components/fleet/FleetFilters.tsx` (panel body container and the PopoverContent height style). No filter logic, data, or backend changes.
