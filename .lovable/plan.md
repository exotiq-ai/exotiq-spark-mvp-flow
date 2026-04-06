

# Calendar Status Filters

## Operator Journey Analysis

The calendar serves three daily workflows:
1. **Approval queue** — "What needs my attention?" → Pending bookings
2. **Operations planning** — "What's happening today/this week?" → Confirmed + active bookings
3. **Conflict resolution** — "Are there double-bookings?" → Conflict days

Filters should map directly to these workflows, not just mirror database statuses.

## Design

A row of toggle chips below the search bar, matching the existing `ToggleGroup` style. Multi-select enabled — clicking multiple chips combines them (union). Each chip shows a live count badge.

```text
[🟡 Pending (3)] [🟢 Confirmed (12)] [🔴 Conflicts (1)] [📥 Returns Soon (4)]
```

### Filter definitions

| Chip | Logic | Why |
|------|-------|-----|
| Pending | `status === 'pending'` | #1 action trigger — approve/reject |
| Confirmed | `status === 'confirmed' \|\| status === 'active'` | What's locked in |
| Conflicts | Days where same vehicle has overlapping bookings | Already computed in `monthStats` |
| Returns Soon | `end_date` is today or tomorrow | Prep for inspections, cleaning, re-listing |

"Returns Soon" is a time-based filter, not a status — it highlights bookings ending within 48 hours regardless of status. This is the operator's "get ready" signal.

### Behavior

- **No chips selected** = show all bookings (current default)
- **One or more selected** = show only matching bookings; non-matching are hidden from the grid
- Chips are **additive** (union): Pending + Conflicts shows both
- Counts update live as you change vehicle filter or date range
- "Conflicts" chip highlights conflict days on the month grid with a subtle red ring (already partially implemented via `hasConflicts()`)

## File Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookingCalendar.tsx` | Add `statusFilters` state (Set), filter chip row below search, extend `filteredBookings` memo to apply status/time filters, add "Returns Soon" time check |

## What this does NOT include

- No new components or files — everything fits in the existing calendar
- No database changes
- No changes to booking statuses or lifecycle
- Completed/cancelled bookings are intentionally excluded from filter chips (low calendar value)

