# Force returns on DERC historical bookings + owner email draft

## What's there now (verified)

Denver Exotic Rental Cars bookings:
- 68 completed, 41 confirmed, 14 cancelled, 1 active
- Of those, **38 bookings have an end date in the past but are still open** (37 confirmed, 1 active) — these are the "never returned" records
- Fleet: 7 available, 2 booked, 2 retired

## Step 1 — Close out the past-dated bookings

Mark the 38 bookings whose end date is already in the past as **completed** (returned). Scope is strictly `team_id = Denver Exotic Rental Cars` and `end_date < now()` and status in (`confirmed`, `active`). Future-dated bookings, cancelled bookings, and every other tenant are untouched.

Also re-sync vehicle status afterwards: any DERC vehicle sitting in `booked` with no remaining current/future booking goes back to `available` (vehicles genuinely out of service or retired keep their status).

Before/after row counts get reported back so the change is auditable.

## Step 2 — Draft email to the DERC owner

Write a plain-language draft (delivered in chat as text for review — nothing sent automatically) covering:

1. **What was done** — historical rentals that were left open have been closed out as returned, so the calendar, availability and revenue reporting reflect reality.
2. **Why it matters** — open past bookings block vehicles from showing available, distort utilization and revenue, and create false double-booking warnings.
3. **Check-in / Check-out** — recommend running the guided inspection at both ends of every rental: timestamped photo record, fuel/mileage capture, and a clean paper trail for damage claims. Bookings then close themselves at return instead of drifting open.
4. **Payment portal** — recommend recording payments and using the renter payment link so deposits, balances and refunds live on the booking, LTV and revenue charts stay accurate, and the card on file supports extensions and incidental charges.
5. **Suggested operating rhythm** — daily brief in the morning, check-out at handover, check-in at return, payment recorded same day.

## Technical detail

- Two data updates via the database tool: a scoped `UPDATE bookings SET status='completed'` and a follow-up vehicle status re-sync.
- No schema change, no edge function change, no code change.
