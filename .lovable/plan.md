

# Fix Dialog Overflow: Consistent Max-Height and Scrolling Across All Dialogs

## Problem
Several dialogs (notably `CreateVehicleTaskDialog`) have no `max-h` or scroll constraints, causing content to clip below the viewport on standard screens. The screenshot shows the task creation form extending beyond the visible area with no way to scroll.

## Approach
Two-pronged fix: (1) add a safe default `max-h` to the base `DialogContent` component so every dialog gets it automatically, and (2) fix individual dialogs that need internal scroll areas for their content.

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/ui/dialog.tsx` | Add `max-h-[85vh] overflow-y-auto` to the base `DialogContent` class. This gives every dialog a safe viewport constraint by default. Dialogs that already specify their own `max-h` or `flex flex-col` layout will override this naturally. |
| 2 | `src/components/dialogs/CreateVehicleTaskDialog.tsx` | Add `max-h-[85vh] flex flex-col p-0` to DialogContent. Wrap the form body in a `ScrollArea` with `flex-1 min-h-0`. Pin header and footer with `flex-shrink-0`. Reduce `space-y-6` to `space-y-4` for tighter spacing. |
| 3 | `src/components/dialogs/ScheduleMaintenanceDialog.tsx` | Already has `max-h-[90vh] overflow-y-auto` — normalize to `85vh` for consistency. |
| 4 | `src/components/dialogs/AddCustomerDialog.tsx` | Same — normalize `90vh` to `85vh`. |
| 5 | `src/components/dialogs/EditCustomerDialog.tsx` | Same normalization. |
| 6 | `src/components/dialogs/BookingDetailsDialog.tsx` | Missing `max-h` — will inherit from base. No individual change needed. |
| 7 | `src/components/dialogs/SendMessageDialog.tsx` | Missing `max-h` — will inherit from base. No change needed. |
| 8 | `src/components/dialogs/LinkCustomerDialog.tsx` | Missing `max-h` — will inherit from base. No change needed. |

## Key Design Decisions
- **85vh** as the standard max-height — leaves room for browser chrome and mobile address bars
- Base component gets `overflow-y-auto` as a safety net; dialogs with proper `ScrollArea` + `flex` layouts will manage scroll internally
- `CreateVehicleTaskDialog` gets the full structural fix (pinned header/footer + scrollable body) since it's the most content-heavy offender

