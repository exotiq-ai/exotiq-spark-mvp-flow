

# Fix: Enable Same-Day Multi-Rental for Hourly Tiers

## The Problem

The "Vehicle reserved for the full calendar day" banner contradicts the core value of hourly tiers — booking the same vehicle multiple times per day. The conflict detection engine already compares full timestamps (not just dates), so the infrastructure supports this. The banner was an unnecessary guardrail.

## What's Missing

There are no time inputs in the booking dialog. When a 3hr/6hr tier is selected, the user picks dates but has no way to specify start/end times. Without times, `start_date` and `end_date` default to midnight, making every same-day booking look like an overlap.

## Changes

### 1. Remove the "full calendar day" banner
In `NewBookingDialog.tsx` (lines 326-333): delete the `Alert` that says "Vehicle reserved for the full calendar day."

### 2. Add time inputs for hourly bookings
When `durationType` is `3hr` or `6hr`, show a start time input (e.g., `<input type="time">`). Auto-calculate end time (start + 3 or 6 hours). For `daily`/`multiday`, no time picker — keep current behavior.

### 3. Combine date + time into stored timestamps
Before submitting, merge the selected date with the selected time:
- `start_date = selectedDate + startTime` (e.g., `2026-03-21T10:00:00`)
- `end_date = selectedDate + endTime` (e.g., `2026-03-21T13:00:00`)

This flows naturally into the existing conflict detection which already does proper datetime overlap checks.

### 4. Replace banner with helpful context
Instead of the blocking message, show: "Select a pickup time. The vehicle will be available for other bookings outside this window." This communicates the benefit rather than a limitation.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dialogs/NewBookingDialog.tsx` | Remove "full day" alert, add time inputs for hourly tiers, merge date+time on submit |

## What Already Works (No Changes Needed)

- `conflictDetection.ts` — already compares full `Date` objects with time
- `pricingUtils.ts` — `calculateRentalDays` handles same-day correctly (returns 1)
- `calculateBookingTotal` — 3hr/6hr use flat rate, no day multiplication
- Database — `start_date`/`end_date` are already timestamp columns

## Risk

Low. The only change is in `NewBookingDialog.tsx`. Conflict detection, pricing, and storage all already support this pattern. The unit tests confirmed same-day double bookings produce correct totals ($200 + $350 = $590 for 3hr morning + 6hr afternoon).

