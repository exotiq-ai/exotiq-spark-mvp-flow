

# Calendar Visual Polish -- From 7/10 to 9+/10

## Current Issues (From Screenshots)

1. **No grid lines between days** -- numbers float in blank space; you can't visually parse the calendar grid until you hover a cell. Traditional calendars have subtle borders separating each day box.
2. **Hover scale (1.03x) causes overlap** -- when a cell scales up, it bleeds into adjacent cells, breaking alignment.
3. **Hover card (BookingPreviewCard) creates visual conflict** -- the large popover obscures neighboring cells. In dark mode, the contrast is especially poor because the card background blends with the dark cell backgrounds.
4. **Transparent/invisible cell borders** -- `border-transparent` on empty days means the grid structure is invisible. Only hovering reveals the cell boundary.
5. **`rounded-xl` on cells** -- overly rounded corners eat into the grid's visual cohesion. Traditional calendars use sharp or subtly rounded corners.

## Design Changes

### 1. Add Persistent Grid Lines (The Big Fix)

Replace the current `gap-0.5 sm:gap-1` grid spacing + `border-transparent` with a proper bordered grid:

- Set `gap-0` on the grid (no spacing between cells)
- Add `border border-border/40` to every cell so lines are always visible
- Use `border-collapse`-style effect by making shared borders (right/bottom border on each cell)
- Result: a clean, traditional calendar grid that's always readable

### 2. Remove Hover Scale Effect

Delete the `whileHover={{ scale: 1.03 }}` and `whileTap={{ scale: 0.97 }}` from day cells. These cause overlap and visual jitter. Replace with a subtle background highlight on hover:

- Empty days: `hover:bg-muted/30` (light) / `hover:bg-muted/20` (dark)
- Days with bookings: `hover:bg-primary/8`
- This provides clear hover feedback without breaking the grid layout

### 3. Fix Hover Card Contrast

The `HoverCardContent` for booking previews needs:
- Explicit `bg-popover` background (not transparent)
- A stronger `shadow-lg` for separation from the grid
- `border border-border` to define edges in both themes
- Increase `z-50` to ensure it layers above all cells

### 4. Reduce Border Radius on Cells

Change from `rounded-xl` (12px) to `rounded-none` or `rounded-sm` (2px) for the grid cells. This creates the traditional calendar box look. Only the outer card container keeps its rounded corners.

### 5. Improve Selected State

Keep the filled primary background for selected day, but add a subtle inset shadow to make it feel "pressed" rather than "floating":
- `ring-2 ring-primary ring-inset` instead of `shadow-md`

### 6. Soften the Today Indicator

The current filled circle for today is good, but make the non-selected today cell have a subtle bottom border accent instead of competing with the selected state:
- Today (not selected): thin 2px bottom border in primary color + slightly bold number
- Today (selected): full primary background (as is)

## Technical Details

### File Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookingCalendar.tsx` | Grid lines, remove scale hover, fix border-radius, improve selected/today states, fix hover card styling |

### Grid Structure Change (lines 493-510)

Replace:
```
className="grid grid-cols-7 gap-0.5 sm:gap-1"
```
With:
```
className="grid grid-cols-7 border-t border-l border-border/40"
```

Each cell gets:
```
className="border-r border-b border-border/40"
```

This creates the classic calendar grid with shared borders.

### Cell Styling Change (lines 531-547)

Remove:
```
whileHover={{ scale: 1.03 }}
whileTap={{ scale: 0.97 }}
rounded-xl border cursor-pointer
```

Replace with:
```
rounded-none sm:rounded-sm border-r border-b border-border/40 cursor-pointer
hover:bg-muted/40 transition-colors
```

For selected cells, add `ring-2 ring-inset ring-primary` instead of `shadow-md`.

### Density Classes Update (lines 524-529)

Remove border-based density indicators (they conflict with grid borders). Instead use only background colors:
```
if (bookingsCount === 0) return 'hover:bg-muted/30';
if (bookingsCount >= 5) return 'bg-success/10 hover:bg-success/15';
if (bookingsCount >= 3) return 'bg-warning/8 hover:bg-warning/12';
return 'bg-primary/5 hover:bg-primary/8';
```

### Hover Card Fix (lines 619-626)

Add explicit styling to HoverCardContent:
```
className="p-4 z-50 bg-popover border border-border shadow-lg"
```

### What This Achieves

- Grid lines always visible -- instantly readable calendar structure
- No cell overlap on hover -- clean, stable interactions
- Hover cards stand out clearly in both light and dark themes
- Traditional calendar aesthetic that users recognize
- Keeps all existing functionality: click for details, booking pills, conflict indicators, mobile bottom sheet, swipe navigation, keyboard nav, ICS export

### Target Rating: 9+/10

The calendar will look and feel like Apple Calendar / Google Calendar with always-visible grid structure, clean hover states, and rich interactive detail panels.
