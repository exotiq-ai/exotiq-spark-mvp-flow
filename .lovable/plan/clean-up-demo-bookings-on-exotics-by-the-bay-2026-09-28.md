# Clean up demo bookings on Exotics By The Bay

## What I found (Exotics By The Bay only)

| Ref | Renter | Source | Status | Value | Payments logged |
|---|---|---|---|---|---|
| BK-03576 | Gregory Ringler | Manual | Cancelled | $700 | none |
| BK-03577 | Gregory Ringler | Marketplace | Payment expired | $2,150 | none |
| BK-01475 | Zachary Schneider | Manual | Completed | $800 | none |
| BK-03485 | Zachary Schneider | Marketplace | Cancelled | $1,600 | none |
| BK-03510 | Zachary Schneider | Marketplace | Cancelled | $2.15 | none |
| BK-03515 | Zachary Schneider | Manual | Cancelled | $3 | $3 |
| BK-03519 | Zachary Schneider | Manual | Confirmed | $800 | $1 |
| BK-03521 | Zachary Schneider | Manual | Confirmed | $18 | none |
| BK-03542 | Zachary Schneider | Marketplace | Cancelled | $2.15 | none |

10 bookings in total. Two of them (BK-01475 and BK-03519, $800 each) currently count toward revenue, and so does BK-03521 ($18). The rest are cancelled or expired, but they still show up in booking lists and history.

Not touched: BK-03523 (Gregory Ringler) belongs to **Tampa Bay Exotic Car Rentals**, a different account.

## What I'll do

1. Permanently remove these 9 bookings from Exotics By The Bay, along with everything attached to them: the two small payment entries ($3 and $1), inspections, messages, tasks, calendar entries and notes. I'll check each attached item before deleting anything.
2. Remove the Gregory Ringler and Zachary Schneider renter profiles from their customer list, but only if they have no other bookings left.
3. Re-check revenue, the dashboard and the booking list afterwards to confirm that nothing from these renters is left.

This only changes Exotiq's records. If money actually went through Stripe (for example the $3 and $1 payments), those charges stay in Stripe, and any refund has to be issued there.

## Technical details
- Run a dependency sweep of every table with a foreign key to `bookings.id` (payments, payment_receipts, vehicle_inspections, damage_claims, documents, booking_extensions, automated_messages, vehicle_tasks, customer_notes, vehicle_blocked_dates, etc.). Delete child rows first, then the bookings, all scoped to `team_id` = EBTB and the 9 IDs listed.
- Before deleting, save the rows to a CSV backup at /mnt/documents so the change can be undone.
- Afterwards, recompute customer LTV and vehicle revenue by running the existing triggers.
