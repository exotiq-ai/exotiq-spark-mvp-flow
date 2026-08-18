# Payment actions are missing on the Bookings → Payments rows

You are not missing a setting. The resend action was built, but it only exists in two places, and neither is the screen in your screenshot.

## Where it exists today

- **Booking Details dialog** — a "Send payment link to renter" button in the sticky footer, shown only when the booking status is exactly `pending_payment`.
- **Vault → Payments → Awaiting payment** list — "Send payment link" on marketplace rows, "Record payment" on manual ones.

## Where it is missing (your screenshot)

**Bookings → Payments tab → Payment Status.** Those rows render amounts and a badge only. The action row is there in code but every button is gated:

- `Record payment` / `Collect Balance` are hidden for marketplace bookings (correct — manual charges would bypass the platform fee leg).
- Holds and refund buttons only appear when a hold or a completed Stripe payment exists.
- There is no send-payment-link button at all in this list.

So for the Aston Martin, Audi S8 and Rolls-Royce rows, marketplace bookings show zero actions, which reads as a dead list.

## The operator workflow, stated plainly

1. Request arrives → operator **Approves** → renter is emailed the secure payment link, deadline set (48h, capped 2h before pickup).
2. Renter does not pay → operator **re-sends the same link** (no new charge, no new deadline) from the booking card or Vault.
3. Deadline passes → booking becomes `payment_expired`; the resend button becomes **Re-approve & send link** so a fresh window is set instead of mailing a dead one.
4. Non-marketplace bookings are collected by the operator directly: **Record payment**.

## The fix

Give the Payment Status rows the same actions as the rest of the app:

- Marketplace rows in `pending_payment`: **Send payment link** (calls the existing resend function, 60s throttle, toast naming the address and deadline).
- Marketplace rows in `payment_expired`: **Re-approve & send link**, routed through the approve path.
- Non-marketplace rows: keep **Record payment** / **Collect Balance** as-is.
- Every row gets **View booking**, and the row body becomes clickable so the operator can open the reservation from the list instead of hunting for it.
- Rows with no possible action (marketplace, awaiting the renter, link already sent) show a one-line explanation — "Renter has the payment link · due Aug 20, 4:25 PM" — instead of empty space.
- Add the same "Send payment link" affordance to the customer card's unpaid bookings so the three entry points behave alike.

Also: the vehicle name in these rows opens a small vehicle quick-view that overlaps the list awkwardly (second screenshot). Change that click to open the booking, which is what an operator on a payments screen wants.

## Verification

- Audi S8 (BK-03493, marketplace, pending_payment): Send payment link appears, sends, toast shows the renter address and the Aug 20 deadline, no charge created.
- Rolls-Royce (overdue, manual): Record payment still opens as today.
- An expired booking shows Re-approve & send link and gets a new deadline.
- Double-clicking send inside 60s is throttled, not double-mailed.
- Mobile width: actions wrap and stay reachable.

## Technical notes

Files: `src/components/dashboard/PaymentTracker.tsx` (row actions, resend call, view-booking click, contextual status line), `src/components/dialogs/CustomerProfileDialog.tsx` (send-link on unpaid bookings). Reuses the deployed `rent-resend-payment-link` and `rent-approve-booking` functions — no new edge functions, no changes to amounts, fees, or Stripe writes.
