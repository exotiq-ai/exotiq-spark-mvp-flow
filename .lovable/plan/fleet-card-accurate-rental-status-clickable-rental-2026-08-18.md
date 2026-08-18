# Fleet card: accurate rental status + clickable rental

## The problem

In the Fleet module, the vehicle quick-view shows a rental block labeled "Active Rental" even when the rental starts weeks in the future (the Audi S8 shows Nov 22–29 as "Active"). The lookup that feeds that block matches any booking with status `active` or `confirmed` for the vehicle and ignores the dates entirely, so a confirmed future reservation is presented as if the car is out right now. The block is also static text — clicking it does nothing.

## What changes

### 1. Date-aware rental status

Split the lookup into what the dates actually say and label each state plainly:

| State | Condition | Label |
|---|---|---|
| Out now | start <= today <= end | "On Rental Now" (with "Due back {date}") |
| Returning today | end is today | "Returning Today" |
| Upcoming | start is in the future | "Upcoming Rental" (with "Starts {relative time}") |
| Overdue | end < today, still open | "Overdue Return" |

Only the out-now case keeps the primary/purple treatment. Upcoming uses the muted/accent treatment already used by the existing "Next Booking" block, so the two are visually distinct at a glance. When a car is out now and also has a later reservation, both blocks show ("On Rental Now" + "Upcoming Rental"), which today is suppressed.

### 2. Make the rental clickable

The rental block becomes a button that opens the booking details for that reservation (same destination the Bookings module and global search use). It gets hover/press feedback and a right chevron so it reads as tappable, and keyboard focus works.

### 3. Consistency

Apply the same date-aware helper to the fleet grid cards, so a card badge never says a car is out when it isn't.

## Technical notes

- `getActiveBooking` / `getNextBooking` in `src/components/fleet/FleetPageEnhanced.tsx` are replaced by one helper that classifies a vehicle's non-cancelled bookings into `current` and `upcoming` using day-normalized comparisons (`startOfDay`), matching the calendar's existing normalization convention.
- Historical bookings (`is_historical = true`) are excluded from both states.
- `src/components/dialogs/VehicleImageDialog.tsx` renders the labeled variants and accepts an `onOpenBooking(bookingId)` callback; the Fleet page wires it to the existing `openBooking` navigation helper in `src/hooks/useModuleNavigation.ts` and closes the quick-view on click.
- No schema, RLS, or edge function changes; presentation and lookup logic only.

## Verification

- Audi S8 (future Nov 22–29 reservation) shows "Upcoming Rental — Starts in X", not "Active Rental".
- A vehicle currently out shows "On Rental Now" with its due-back date.
- Clicking either block lands on that exact booking.
- Checked on desktop and mobile widths.
