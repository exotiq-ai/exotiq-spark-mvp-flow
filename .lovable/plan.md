

# Inventory Availability Audit — Gaps Found

## Critical Findings

After reviewing every file that checks booking status against vehicle availability, here are the inconsistencies:

### Gap 1: `pending` bookings DO block vehicles — but inconsistently

The conflict detection engine (`conflictDetection.ts` line 42) filters out only `cancelled` bookings:
```
b.status !== 'cancelled'
```
This means `pending`, `confirmed`, AND `completed` bookings all block a vehicle. A completed booking from last month still blocks the same dates — that's correct. But the real issue is elsewhere.

**FleetStatusWidget** (line 31) only counts `confirmed` bookings when determining "Booked" vehicles:
```
b.status === 'confirmed'
```
A vehicle with a `pending` booking shows as "Available" in the fleet status widget, even though conflict detection would block it. The dashboard lies about availability.

**ChangeVehicleDialog** (line 53) filters out only `cancelled`:
```
b.status === "cancelled"
```
This is correct — pending bookings block the vehicle here. But it's inconsistent with FleetStatusWidget.

### Gap 2: `completed` bookings still block future dates in conflict detection

`conflictDetection.ts` only excludes `cancelled`. If a booking was `completed` but its `end_date` is in the future (e.g., returned early), it still blocks. This is an edge case but worth fixing.

### Gap 3: NewBookingDialog does NOT check availability when listing vehicles

The vehicle dropdown in `NewBookingDialog` shows ALL vehicles regardless of existing bookings for the selected dates. The only protection is the conflict check AFTER submission. A staff member can select a vehicle, fill out the entire form, and only learn it's unavailable when they try to submit. Bad UX.

### Gap 4: Book.tsx "Available Vehicles" section has no availability check

`Book.tsx` line 41-45 filters vehicles only by search query — not by booking status. It shows all vehicles as "available" regardless of whether they have active bookings.

### Gap 5: LinkVehicleDialog correctly checks — good reference implementation

`LinkVehicleDialog` properly excludes vehicles with overlapping non-cancelled bookings. This is the pattern everything else should follow.

---

## Fix Plan

### 1. Standardize booking status filter as a shared utility

Create a helper in `conflictDetection.ts`:
```typescript
export const isBlockingBooking = (status: string) =>
  status !== 'cancelled' && status !== 'completed';
```
Use this everywhere. A `completed` booking should NOT block future availability — the vehicle was returned. Only `pending` and `confirmed` block.

### 2. Fix FleetStatusWidget to count `pending` as booked

Change the filter from `b.status === 'confirmed'` to `isBlockingBooking(b.status)`. A pending booking means the vehicle is committed — it should show as "Booked" in the dashboard.

### 3. Fix conflictDetection.ts to exclude `completed`

Change the filter from `b.status !== 'cancelled'` to `isBlockingBooking(b.status)`. Completed bookings should not conflict with new bookings on the same dates.

### 4. Add availability indicators to NewBookingDialog vehicle list

After the user selects dates, mark vehicles in the dropdown that have conflicting bookings. Show a warning badge "Booked for these dates" next to unavailable vehicles. Don't prevent selection (staff may want to override) but make it visible.

### 5. Fix Book.tsx "Available Vehicles" to check real availability

Filter out vehicles that have blocking bookings spanning today. Show actual available-now count.

### 6. Fix ChangeVehicleDialog to exclude `completed`

Currently excludes only `cancelled`. Should use `isBlockingBooking()` for consistency.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/conflictDetection.ts` | Add `isBlockingBooking()` helper, use it in `checkBookingConflicts` |
| `src/components/dashboard/widgets/FleetStatusWidget.tsx` | Count `pending` bookings as "Booked" |
| `src/components/dialogs/NewBookingDialog.tsx` | Show availability indicators on vehicle list after dates selected |
| `src/components/dialogs/ChangeVehicleDialog.tsx` | Use `isBlockingBooking()` instead of `!== 'cancelled'` |
| `src/components/dashboard/Book.tsx` | Filter "Available Vehicles" by actual booking availability |

## Risk

Low-medium. These are filter logic fixes — no schema changes, no new APIs. The `isBlockingBooking` helper centralizes the logic so future status additions only need one update.

