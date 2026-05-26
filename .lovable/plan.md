# Fleet — Better Row Layout

## Problem
Right now switching to the list view just stacks the redesigned grid cards full-width (tall image + info below). It feels like one giant card per vehicle instead of a scannable row. Customers want the row view back, but cleaner.

## Goal
A dense, scannable horizontal row — closer to an Airtable / Linear / Apple Finder list item. One vehicle per line, all key info readable at a glance, no wasted vertical space, consistent with the new grid card's visual language.

## Proposed Row Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☐  [img]  Vehicle Name              Available · Clean & Ready   $1,200/day   ⋯              │
│           2024 Porsche 911 GT3      📷 9/11 · Next: in 2 days   3h $300 6h $600              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Column structure (left → right)
1. **Checkbox** (only when bulk-select active) — fixed 32px
2. **Thumbnail** — 80×56 (16:10), rounded-md, click → details
3. **Name + sub** — flex-1, min-w-0
   - Line 1: `name` (semibold, truncate) + small status pill inline
   - Line 2: `year make model` muted, smaller
4. **Meta column** — hidden on `<lg`, shown on `lg+`
   - Ops status with icon (color-coded)
   - Photo count `📷 9/11` (color-coded as in grid)
   - Active booking customer OR next booking countdown
   - License plate
   - All separated by middots, single line, truncate
5. **Price column** — right-aligned, fixed width
   - `$1,200/day` (bold)
   - `3h $300 · 6h $600` muted below (if present)
   - Rari sparkle button inline if suggestion exists
6. **Actions** — three-dot dropdown (same items as grid)
7. **Chevron** — subtle right chevron on hover, opens details

### Behaviors
- Entire row clickable → opens details (except checkbox / dropdown / sparkle zones — stopPropagation)
- Hover: `bg-muted/40`, chevron fades in, no scale/lift (rows shouldn't bounce)
- Selected: `bg-primary/5 border-l-2 border-l-primary`
- Retired: `opacity-50 grayscale`, no hover affordance
- Task badge: small red pill next to name (`3 tasks`)
- Status pill uses the same `statusDisplay` styling as grid (Available / Booked / Maintenance / With Renter / Retired)
- Height: ~72px per row, comfortable but dense

### Responsive
- `<md` (mobile): meta column hides, price stacks under name. But mobile already uses ops mode card, so this mostly matters for tablets.
- `md`–`lg`: meta column shows abbreviated (drop license plate)
- `lg+`: full meta column

### Container
- Change list-mode wrapper from `grid grid-cols-1 gap-4` to a `divide-y border rounded-lg overflow-hidden bg-card` list. No gaps between rows, single bordered container — feels like a proper table/list, not a stack of cards.

## Files to touch
- `src/components/fleet/FleetVehicleCard.tsx` — add a third render branch: when a new `viewMode === 'list'` prop is passed (and not ops mode), render the row layout instead of the grid card. Keep all data props, callbacks, permissions identical.
- `src/components/fleet/FleetPageEnhanced.tsx`:
  - Pass `viewMode={viewMode}` to `FleetVehicleCard`
  - Swap list-mode container classes to `divide-y border rounded-lg overflow-hidden bg-card` (no `gap-4` in list mode)

## Out of scope
- Grid card (already redesigned)
- Ops mode mobile card
- Maintenance/Photos tabs
- Sorting/column headers (could be a follow-up if customers want sortable columns)
- Data model, RLS, backend
