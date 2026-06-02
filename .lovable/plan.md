# Fleet Filters Overhaul

## Problem
The Fleet → Filters popover (`src/components/fleet/FleetFilters.tsx`) clips its content — Ops Status options below "Pending Inspection" are cut off, the `ScrollArea` is wrapped but the popover itself has no bounded height so it just overflows the viewport instead of scrolling. The filter set is also thin: only Booking Status, Show-retired, and Ops Status — missing things customers actually filter by (location, make, year, price, ownership).

## Goals
1. Fix the scroll so every section is reachable.
2. Expand filters to match what fleet operators actually slice by.
3. Tighten the UI: clear sections, sticky header/footer with Clear + Apply, active-count badges per section, mobile-friendly.

## New filter set
Sectioned, collapsible groups inside the popover:

| Section | Control | Source |
|---|---|---|
| Booking Status | chip multi-select | `vehicles.status` (existing) |
| Ops Status | chip multi-select | `vehicles.ops_status` (existing) |
| Location / Market | multi-select | distinct `vehicles.location` (Miami, Scottsdale, …) |
| Make | multi-select (searchable) | distinct `vehicles.make` |
| Model Year | range slider | min/max of `vehicles.year` |
| Daily Rate | range slider ($) | min/max of `vehicles.current_rate` |
| Mileage | range slider | min/max of `vehicles.mileage` |
| Ownership | chips: Owned / Partner / Consignment | `vehicles.ownership_type` |
| Has photos | toggle | `image_url` present |
| Needs attention | toggle | `ops_status in (pending_inspection, dirty, damage_reported)` |
| Show retired | toggle (existing) | `status='retired'` |

All new filter state lives in `FleetFiltersState`; filtering logic added to the `useMemo` in `FleetPageEnhanced.tsx`.

## UI changes (`FleetFilters.tsx`)

```text
┌─ Popover (w-96, max-h-[80vh], flex-col) ───────┐
│  Sticky header: "Filters"   [Clear all]        │
├────────────────────────────────────────────────┤
│  ScrollArea (flex-1, min-h-0)                  │
│   ├─ Booking Status   • chips                  │
│   ├─ Ops Status       • chips                  │
│   ├─ Location         • chips                  │
│   ├─ Make             • searchable list        │
│   ├─ Year             • dual slider            │
│   ├─ Daily Rate       • dual slider            │
│   ├─ Mileage          • dual slider            │
│   ├─ Ownership        • chips                  │
│   └─ Quick toggles    • switches               │
├────────────────────────────────────────────────┤
│  Sticky footer: count summary  [Apply]         │
└────────────────────────────────────────────────┘
```

Key fixes:
- `PopoverContent` becomes `w-96 p-0 max-h-[80vh] flex flex-col` so the inner `ScrollArea` actually has a bounded parent → real scrolling.
- `ScrollArea` gets `flex-1 min-h-0` (the current cause of the cutoff — it had no height constraint).
- Replace heavy bordered checkbox cards with compact toggle chips for status sections to reduce vertical bulk.
- Each section header shows a small `(n)` badge when active.
- Sticky footer with live "Showing X of Y vehicles" + Clear + Apply (closes popover).
- Mobile (`<md`): popover renders as a bottom Sheet (reuse pattern from `MarginMobileFilterSheet`) with the same content.

## Technical notes
- `FleetFiltersState` extends to: `locations: string[]`, `makes: string[]`, `yearRange: [number, number] | null`, `rateRange`, `mileageRange`, `ownership: string[]`, `hasPhotos: boolean`, `needsAttention: boolean`.
- Distinct lists (locations, makes) + slider bounds are derived in `FleetPageEnhanced.tsx` via `useMemo` over `vehicles` and passed into `<FleetFilters />` as props (`facets`).
- Filter application appended to existing `filteredVehicles` `useMemo`.
- Active count helper updated; URL/localStorage persistence out of scope for this pass.
- Uses existing shadcn primitives only: `Popover`, `Sheet`, `ScrollArea`, `Slider`, `Switch`, `Badge`, `Command` (for searchable Make list), `Separator`. No new deps.

## Out of scope
- Saved filter presets (can be a follow-up).
- Server-side filtering / pagination.
- Changes to sort dropdown or view-mode toggle.
- Backend / RLS / schema changes.

## Files touched
- `src/components/fleet/FleetFilters.tsx` — rewrite layout, add new sections, fix scroll, add mobile Sheet variant.
- `src/components/fleet/FleetPageEnhanced.tsx` — extend `FleetFiltersState` defaults, compute facets, apply new filter predicates.
