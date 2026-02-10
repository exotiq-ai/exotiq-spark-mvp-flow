

# Calendar Design Upgrade -- Premium, Responsive, Polished

## Problems Visible in Screenshots

1. **Calendar cells are tiny and sparse** -- hard to read booking pills at 9px text, especially on smaller desktops
2. **Duplicate export buttons** -- "Export" and "Google" now do the same thing (both download ICS)
3. **Toolbar is cramped** -- month nav, refresh, export, google, filter all on one row; wraps awkwardly on tablets
4. **No "Today" button** -- if you navigate to a different month, no quick way back
5. **Day panel gets clipped** -- the right panel at 45% width can push off-screen on narrower desktops (screenshot shows it overlapping)
6. **Mobile unusable** -- on phones, the 7-column grid with 50px min-height cells leaves no room for booking pills; the day panel stacks below but the calendar itself is already too tall
7. **No month summary** -- you see the grid but no quick stats (total bookings this month, revenue, utilization)
8. **Booking pills truncate aggressively** -- only showing the last word of the vehicle name is not enough context
9. **Day detail panel empty state is generic** -- "This day is wide open!" doesn't add value

## Design Changes

### 1. Redesigned Header and Toolbar

**Current**: Everything on one row, wrapping chaotically.
**New**: Two-tier header layout.

- **Row 1**: Month/Year title (left), "Today" pill button + nav arrows (right)
- **Row 2**: Month summary stats bar (bookings count, revenue, vehicles in use) -- compact chips
- **Toolbar**: Export and Filter move into a clean icon group on the right of Row 1

Remove the separate "Google" button entirely -- it duplicates Export. The toast instruction for Google import stays on the single Export action.

### 2. Improved Calendar Grid Cells

- Increase `min-h` from `50px/70px` to `60px/80px` for better readability
- Show booking pills with **customer first name + vehicle model** instead of just vehicle last word (e.g., "Benji - Spider" not just "Spider")
- Increase pill text from `9px/10px` to `10px/11px`
- Add a subtle booking count badge in the corner of busy days
- Today's date gets a filled circle indicator (like Apple Calendar) instead of just a ring

### 3. Mobile-First Day Detail Panel

**Current**: Side panel on desktop, stacks below on mobile (forcing scroll past the full calendar).
**New**: 
- **Mobile/Tablet (below `lg`)**: Day detail opens as a **bottom sheet** (using Vaul drawer) that slides up, covering 60% of the screen. Calendar stays visible behind the sheet.
- **Desktop**: Keep the side panel split-view but change proportions to 60%/40% for better balance.

### 4. Mobile Calendar Optimizations

- On mobile (`< 640px`), show **single-letter day headers** (S, M, T, W, T, F, S) instead of three-letter
- Compress cell padding for tighter mobile grid
- Booking pills show only a colored dot + count on mobile (no text) -- tap to open the bottom sheet with full details
- Add **swipe gesture** for month navigation (left/right) using framer-motion drag

### 5. Month Summary Bar

A slim stats bar below the header showing:
- Total bookings this month
- Total revenue this month  
- Active vehicles this month
- Conflicts count (if any)

Styled as compact pill/chip badges -- not cards. Matches the `CompactMetricsBar` pattern used on the dashboard.

### 6. Better Empty State

When a day has no bookings, the detail panel shows a more useful message with a "Create Booking" shortcut button that pre-fills the selected date.

### 7. Visual Polish

- Calendar card: remove the heavy `card-premium` shadow on mobile, use a flatter look
- Day cells: softer border-radius (`rounded-xl` instead of `rounded-lg`) for a more modern feel
- Selected day: use a filled primary background with white text (Apple Calendar style) instead of the current border-only treatment
- Booking pills: add a subtle left-border accent (already exists) but increase width to 3px for better visibility
- Day panel booking cards: tighten spacing, improve the vehicle image thumbnail size

## Technical Details

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookingCalendar.tsx` | Complete UI restructure: two-tier header, responsive grid, mobile bottom sheet, swipe navigation, month summary bar, improved pills, "Today" button, remove Google button duplicate |

### Responsive Breakpoints

| Breakpoint | Grid Cell Height | Day Headers | Booking Pills | Day Detail |
|------------|-----------------|-------------|---------------|------------|
| Mobile (<640px) | 56px | S/M/T/W/T/F/S | Colored dot + count | Bottom sheet (Vaul Drawer) |
| Tablet (640-1023px) | 72px | Sun/Mon/Tue... | Abbreviated name | Bottom sheet (Vaul Drawer) |
| Desktop (>=1024px) | 84px | Sun/Mon/Tue... | Full name + customer | Side panel 40% width |

### Month Summary Bar Data

```text
const monthStats = useMemo(() => ({
  totalBookings: filteredBookings.length,
  totalRevenue: filteredBookings.reduce((sum, b) => sum + (b.total_value || 0), 0),
  activeVehicles: new Set(filteredBookings.map(b => b.vehicle_id)).size,
  conflicts: daysInMonth.filter(d => hasConflicts(d)).length,
}), [filteredBookings, daysInMonth]);
```

### Mobile Swipe Navigation

```text
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(_, info) => {
    if (info.offset.x > 100) previousMonth();
    if (info.offset.x < -100) nextMonth();
  }}
>
  {/* calendar grid */}
</motion.div>
```

### Bottom Sheet for Mobile Day Detail

Uses the existing `vaul` (Drawer) dependency -- already installed. On mobile, clicking a day opens the Drawer instead of expanding the side panel:

```text
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";

// On mobile: open drawer
// On desktop: show side panel (existing behavior)
const isMobile = window.innerWidth < 1024;
```

### Removed

- Google Calendar button (duplicate of Export)
- `openGoogleCalendar` import (already removed in last diff)

### Unchanged

- All existing functionality: click-for-details, hover preview cards, keyboard navigation, conflict detection, realtime updates, vehicle color coding, ICS export
- EnhancedBookingDialog integration
- Vehicle image dialog
- Filter by vehicle

