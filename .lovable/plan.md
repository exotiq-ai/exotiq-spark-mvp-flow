# DERC: rename to Denver Exotiq Rental Cars + force returns + owner email

## What's there now (verified)

Denver Exotic Rental Cars bookings:
- 68 completed, 41 confirmed, 14 cancelled, 1 active
- Of those, **38 bookings have an end date in the past but are still open** (37 confirmed, 1 active) — these are the "never returned" records
- Fleet: 7 available, 2 booked, 2 retired
Current account record: name `Denver Exotic Rental Cars`, slug `denver-exotic-rental-cars`, 11 vehicles, no support email set.

## Step 1 — Rename to Denver Exotiq Rental Cars (licensed name)

Update the tenant record's display name to **Denver Exotiq Rental Cars**. The name is stored once on the account and read everywhere else — dashboard header, invites and emails, documents, rental agreements, Command Center and Super Admin lists — so this single change carries across the whole platform. A sweep of the codebase confirmed there is no hardcoded "Denver Exotic" text anywhere in the app.

Public marketplace URL: the account also has a web address slug `denver-exotic-rental-cars`. Recommendation is to update it to `denver-exotiq-rental-cars` so the public listing matches the licensed name. Trade-off: any previously shared link using the old slug stops working. Say the word if you'd rather keep the old slug for now — the display name change works either way.

Verification after the change: confirm the account name and slug read correctly, the public marketplace listing loads on the new address, and vehicle listing links still resolve.

## Step 2 — Close out the past-dated bookings

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
