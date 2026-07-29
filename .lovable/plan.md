# Fix Fleet Filters popover — clipping + scroll-through

## Problem
On the Fleet page filter dropdown:
1. Top of the popover is cut off (content above "Booking Status" is unreachable — the "Include retired" toggle is clipped).
2. Scrolling inside the popover scrolls the underlying page instead of the popover body.

Root cause in `src/components/fleet/FleetFilters.tsx` (lines 289–293): `PopoverContent` uses a hardcoded `max-h-[80vh]` with no collision padding and no available-height binding, so Radix can position it taller than the viewport allows. The inner `ScrollArea` also lets wheel/touch events bubble to the page.

## Changes (single file: `src/components/fleet/FleetFilters.tsx`)

1. Replace the fixed `max-h-[80vh]` with Radix's available-height CSS var and add `collisionPadding` so the popover always fits between the trigger and viewport edges:
   - `PopoverContent` className → `w-[min(26rem,calc(100vw-2rem))] p-0 flex flex-col z-[60] overflow-hidden`
   - Add inline `style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}`
   - Add `collisionPadding={16}` and keep `align="start"`, `sideOffset={8}`
2. Prevent scroll bubbling to the page:
   - Add `overscroll-contain` to the `ScrollArea` wrapper and its viewport.
   - Wrap the ScrollArea in a `min-h-0 flex-1` container so flex sizing works with the new max-height.
3. Mobile polish: when viewport width < 480px, the width clamp above already keeps it inside the frame; keep the sticky header/footer untouched.

No logic, no filter-state, no API changes. Presentation only.

## Verification
- Typecheck.
- Open Fleet → Filters at mobile (390px), tablet (768px), desktop widths: header visible, footer visible, body scrolls internally, page behind stays put.
- Confirm with a Playwright screenshot at 390×800 that the top "Include retired" row is reachable and no clipping.
