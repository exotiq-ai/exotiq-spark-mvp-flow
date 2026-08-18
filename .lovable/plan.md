# Finding payments that are owed + clickable customer activity

## 1. Where "needed payments" live today

Two separate screens, and only one of them has the list:

- **Payments (Vault → Payments)** shows four tiles — Available, Pending, Total Collected, Balance Due — plus Payment History. Balance Due shows an amount and "N open bookings", but it is a static tile: there is no way to click it and see which bookings owe money.
- **Bookings → Payments tab** has the actual "Payment Status" list of unpaid/partially paid bookings, with Record payment and Send payment link.

So an operator asking "who still owes me?" has to already know to go to Bookings, not Payments. That is the gap.

### Fix

- Make the **Balance Due** tile a real entry point: clicking it opens the outstanding list.
- Add an **Awaiting payment** card directly under the tiles in the Payments screen: the open bookings sorted by soonest pickup, each row showing booking reference, customer, vehicle, dates, amount owed, and how it is being collected (marketplace card-on-file vs. manual). Rows carry the same two actions already in use — Send payment link and Record payment — and clicking the row opens the booking.
- Keep it to the first 6 rows with a "View all" link into the Bookings → Payments tab, so there is one authoritative list and no drift between the two screens.
- Same data source as the Balance Due tile, so the tile count and the list can never disagree.

## 2. Customer card — activity items

Yes, they should be clickable. Today every timeline row is a static block, so seeing "Booking created · 9/11/2026 – 9/12/2026 · $2" is a dead end.

- Booking rows (created / cancelled / completed) become buttons that close the customer card and open that booking's details.
- Notes and ID-verification rows stay non-clickable — there is nowhere for them to go, so they get no hover/pointer affordance.
- While there: rows currently print the placeholder "Vehicle" when a booking has no stored vehicle name (visible in the screenshot). Resolve the name from the fleet when it is missing, and fall back to the booking reference instead of the word "Vehicle".
- The **Bookings** tab in the same customer card gets the same click-through, so both tabs behave alike.

## Verification

- Payments screen: Balance Due count matches the row count in Awaiting payment; clicking the tile and clicking "View all" both land on the full list.
- A marketplace booking in the list shows no manual "Record payment" affordance (charges are automatic), only Send payment link.
- Gregory Ringler's customer card: clicking each booking activity row opens the matching booking; note and ID rows are not clickable.
- Checked at mobile width — rows wrap, action buttons stay reachable, list scrolls.

## Technical notes

Files: `src/components/dashboard/PaymentsSection.tsx` (clickable tile + Awaiting payment list), reusing the outstanding-balance computation already behind `stripe-get-balance` / the fleet booking data used by `PaymentTracker`; `src/components/crm/CustomerTimeline.tsx` (clickable booking events, vehicle-name resolution) and `src/components/dialogs/CustomerProfileDialog.tsx` (pass a booking-click handler through to the timeline and Bookings tab). Display and navigation only — no new charges, refunds, or writes.
