

# Fix Broken Calendar Layout + Hybrid Time Input

## Root Cause of the Layout Bug

The calendar popover renders behind the dialog form fields because of a **z-index collision**. Both `DialogContent` and `PopoverContent` use `z-50`. When the Popover portals to the body, it sits at the same z-level as the dialog overlay, causing the calendar to appear behind form elements.

Additionally, the `DialogContent` base class has `overflow-y-auto` (line 39 of dialog.tsx), AND the NewBookingDialog adds its own `ScrollArea` — double overflow clipping compounds the rendering issue.

## Changes

### 1. Fix PopoverContent z-index

In `src/components/ui/popover.tsx`, bump PopoverContent from `z-50` to `z-[60]` so it always renders above dialogs. This is the single-line fix that resolves the calendar-behind-fields bug across every dialog.

### 2. Create hybrid TimeInput component

Replace the current `TimeSelect` (dropdown-only) with a new component that supports **both typing and dropdown selection**:

- An `Input` field where users can type "9:00 AM" or "14:30"
- A small clock dropdown button that opens a scrollable list of 30-min intervals
- Fuzzy matching: typing "9" highlights "9:00 AM", typing "930" resolves to "9:30 AM"
- Built with Popover + Input + scrollable list (not a Select, so keyboard typing works naturally)

File: `src/components/ui/time-input.tsx` — new component replacing `TimeSelect`

### 3. Update all dialogs to use new TimeInput

Swap `TimeSelect` → `TimeInput` in:
- `NewBookingDialog.tsx` (pickup + return time)
- `EditBookingDialog.tsx` (pickup + return time)
- `ScheduleMaintenanceDialog.tsx` (scheduled time)
- `CheckInOutDialog.tsx` (manual date override time)

No logic changes needed — same `value`/`onValueChange` props contract.

### 4. Clean up the time-select file

Update `time-select.tsx` to re-export from the new `TimeInput` for backward compat, or replace inline.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/popover.tsx` | Bump z-index from `z-50` to `z-[60]` |
| `src/components/ui/time-input.tsx` | New hybrid type+dropdown time picker |
| `src/components/ui/time-select.tsx` | Replace with re-export or update in-place |
| `src/components/dialogs/NewBookingDialog.tsx` | Use new TimeInput |
| `src/components/dialogs/EditBookingDialog.tsx` | Use new TimeInput |
| `src/components/dialogs/ScheduleMaintenanceDialog.tsx` | Use new TimeInput |
| `src/components/dialogs/CheckInOutDialog.tsx` | Use new TimeInput |

