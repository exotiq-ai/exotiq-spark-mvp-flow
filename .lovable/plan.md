
## Goal
Clean up the Fleet grid cards so vehicle names are readable, the price stands out, and the cards feel premium (Apple/Porsche minimal) instead of cramped. Scoped to `src/components/fleet/FleetVehicleCard.tsx` desktop grid mode only — Ops mode (mobile) and list view stay untouched.

## Problems in current cards
1. Horizontal layout forces the name into a narrow column → truncates to `H...`, `Ic...`, `Ol...`
2. Three stacked badges (Available + Clean & Ready + 3/11) feel heavy
3. "38 minutes ago" timestamp is noise for a fleet overview
4. Status dot on thumbnail + duplicate status badge = redundant
5. Price competes with the truncated name in the same row

## New card structure (grid / non-ops mode)

```text
┌──────────────────────────────┐
│                              │
│      [ vehicle photo ]       │  ← full-width, 16:10, rounded
│  [Available]      [⋯ menu]   │  ← status pill overlay TL, menu overlay TR
│                              │
├──────────────────────────────┤
│ Huracán EVO          $1,200  │  ← name (truncate) + price right
│ 2024 Lamborghini      /day   │  ← muted subtitle
│                              │
│ Clean & Ready  ·  📷 3/11    │  ← single muted meta row
└──────────────────────────────┘
```

### Specific changes
- **Layout flip**: replace the `flex gap-4` row with a vertical card. Thumbnail becomes a full-width 16:10 image at the top with rounded top corners.
- **Status badge moves onto the image** (top-left overlay, frosted/subtle bg). Removes the duplicate status-dot + status-badge stacking.
- **Three-dot menu moves to top-right overlay** on the image (matches Porsche/Apple gallery patterns).
- **Name + price share one row below the image**: name left (full width to truncate, room for ~25 chars now), price right-aligned with `/day` smaller and muted. Year/make/model on the line below in muted text.
- **Single meta row** combines `Clean & Ready` ops state and `📷 3/11` photo count separated by a middot. Drop the standalone "Available" badge here (already shown on image overlay).
- **Remove the "38 minutes ago" line** entirely from the grid card. Keep `last_ops_update` in the data; surface it only inside the vehicle detail dialog.
- **Remove the redundant status dot** on the thumbnail corner (status pill on the image covers it).
- **Active booking / next booking line**: keep but move into the meta row only when present (e.g. `· Next: in 2 days`). Hide when empty so cards don't reserve empty height.
- **Selection checkbox**: when in bulk-select mode, overlay it on the image top-left instead of pushing the layout sideways.
- **Hover**: subtle image zoom (`scale-[1.03]`) inside the rounded frame, card lifts with existing shadow utility. Keep current `motion.div` entrance.

### What stays the same
- All data props, callbacks, permissions, dropdown items
- Ops-mode (mobile, `isOpsMode=true`) layout — untouched
- List view rendering (different component path)
- Retired-vehicle grayscale + opacity treatment
- Rari pricing-suggestion sparkle button (relocated next to price)
- Rate-tier 3h/6h indicators (shown under price, smaller)

## Files touched
- `src/components/fleet/FleetVehicleCard.tsx` — restructure the non-ops JSX branch only

## Out of scope
- Maintenance tab cards
- Photos tab cards
- List/table view
- Any data model or backend changes
