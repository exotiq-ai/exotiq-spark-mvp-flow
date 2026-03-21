

# Standardize Date/Time Pickers Across All Dialogs

## Current State — 3 Different Patterns

| Dialog | Date Picker | Time Picker |
|--------|------------|-------------|
| **EnhancedBookingDialog** (Edit) | Calendar popover (clean) | Select dropdown with 30-min slots (clean) |
| **NewBookingDialog** | `<input type="datetime-local">` (native browser, ugly) | Combined in datetime-local (no separation) |
| **EditBookingDialog** | Calendar popover (clean) | None — date only, no time |
| **ScheduleMaintenanceDialog** | `<input type="datetime-local">` (native) | Combined in datetime-local |
| **CheckInOutDialog** | `<input type="datetime-local">` (native) | Combined in datetime-local |
| **Customer/Report/Insurance dialogs** | `<input type="date">` (native) | N/A (date-only is fine) |

The EnhancedBookingDialog has the best pattern: Calendar popover for date + Select dropdown for time. The NewBookingDialog (the most-used dialog) has the worst — a raw browser `datetime-local` input.

## Target Pattern

**Date**: Calendar popover (Shadcn) — clean, visual, consistent.
**Time**: Select dropdown with 30-min intervals (06:00–22:00), displayed as "9:00 AM" format. Scrollable, typeable-friendly via Select's built-in keyboard navigation.

## Changes

### 1. Create a shared `TimeSelect` component
Extract the TIME_OPTIONS + Select pattern from EnhancedBookingDialog into `src/components/ui/time-select.tsx`. Reusable everywhere. Props: `value`, `onValueChange`, `label`, `placeholder`.

### 2. Rewrite NewBookingDialog date/time inputs
Replace the two `<input type="datetime-local">` fields with:
- Pickup Date: Calendar popover
- Pickup Time: TimeSelect dropdown
- Return Date: Calendar popover
- Return Time: TimeSelect dropdown

Laid out as a 2x2 grid (Date | Time over Date | Time). Keep the auto-calculate logic for 3hr/6hr tiers — when pickup time changes, auto-set return time.

State changes: split `startDate` (string) and `endDate` (string) into `startDate` (Date), `startTime` (string), `endDate` (Date), `endTime` (string). Combine them on submit.

### 3. Add time pickers to EditBookingDialog
Currently date-only. Add Pickup Time and Return Time selects alongside the existing calendar popovers. Initialize from the booking's existing time. Same 2x2 grid layout.

### 4. Fix ScheduleMaintenanceDialog
Replace `<input type="datetime-local">` with Calendar popover + TimeSelect. Same pattern.

### 5. Fix CheckInOutDialog
Replace `<input type="datetime-local">` for the manual date override with Calendar popover + TimeSelect.

### 6. Leave date-only fields alone
Customer DOB, license expiry, insurance expiry, report date ranges — these are date-only and `<input type="date">` is acceptable. No change needed.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/time-select.tsx` | New shared component — TimeSelect with 30-min intervals |
| `src/components/dialogs/NewBookingDialog.tsx` | Replace `datetime-local` with Calendar + TimeSelect, split state |
| `src/components/dialogs/EditBookingDialog.tsx` | Add TimeSelect alongside existing Calendar popovers |
| `src/components/dialogs/ScheduleMaintenanceDialog.tsx` | Replace `datetime-local` with Calendar + TimeSelect |
| `src/components/dialogs/CheckInOutDialog.tsx` | Replace `datetime-local` with Calendar + TimeSelect |

## Risk
Medium. NewBookingDialog has complex auto-calculation logic for hourly tiers that depends on the combined datetime string. The state split (Date + time string → combined ISO on submit) needs careful wiring to preserve that behavior.

