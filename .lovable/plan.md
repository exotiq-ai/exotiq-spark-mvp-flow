

# Add Conflict Ring to Calendar Day Cells

## What

When the "Conflicts" filter chip is active, add a subtle red ring (`ring-2 ring-destructive/50`) around any day cell that has conflicts. This provides immediate visual scanning — the operator sees exactly which days need attention without clicking.

## Change

**`src/components/dashboard/BookingCalendar.tsx`** — Line 762-768

Current day cell class logic already applies `bg-destructive/5` for conflict days. Add a conditional red ring when `statusFilters.has('conflicts')` is active:

```
// Add to the className expression (line 766 area):
${hasConflict && !isSelected && statusFilters.has('conflicts') ? 'ring-2 ring-inset ring-destructive/50' : ''}
```

This keeps the existing subtle background tint for conflicts at all times, but adds the ring highlight only when the operator has actively toggled the Conflicts filter — drawing the eye without being noisy by default.

## Scope

One line change in one file. No new dependencies, no logic changes.

