# Fix booking card readability, the phantom $20, and the checkout error

Three separate issues, all confirmed against the live data and code.

## 1. Unreadable text on the yellow booking banner

The "Awaiting renter ID verification" notice in Booking Details uses `text-warning-foreground`, which is pure white in both light and dark themes, on a 10%-opacity amber background. White on pale amber is effectively invisible.

Fix: use a readable foreground for low-opacity warning surfaces (dark amber text in light mode, light amber in dark mode) via a proper token rather than white, and apply it to this banner and any sibling `bg-warning/10` blocks that inherit the same problem.

## 2. "$2/day, 1 day" showing a $22 total

Confirmed cause from the booking record (BK-03493): the rental is $2.00 and `total_value` is $2.00, but the Collect Payment dialog recomputes the total locally and adds a $20.00 gas/re-fueling fee that is stored on the booking as a default. The fee row is hidden in that summary because the tenant has the gas fee disabled in settings — so the $20 is added but never shown. That's where the $22 came from.

Fix, in the payment dialog's math only:
- When the tenant's gas fee is disabled, treat the gas fee as $0 instead of silently adding it.
- Never apply a gas fee to marketplace bookings — those totals are snapshotted at checkout (rental + platform fee + tax + processing) and must not be recomputed.
- For marketplace bookings, show the snapshotted booking total from the record instead of a locally recalculated figure, so the operator sees exactly what the renter was quoted.

## 3. "Payment Error — Edge Function returned a non-2xx status code"

The booking being charged is a marketplace booking. `create-payment-checkout` deliberately refuses those with a 409 and a clear message ("Marketplace bookings cannot be charged manually — the renter pays via the marketplace checkout link"), because a manual charge would bypass the exotiq fee leg and the platform routing. The dialog throws away that message and shows the raw transport error instead.

Fix:
- Surface the function's actual error message and code in the toast rather than the generic transport string.
- In Booking Details, don't offer "Take Payment" / Stripe Checkout on marketplace bookings at all. Replace it with a short line explaining the renter pays through the marketplace link, keeping "Record / view payments" available for history.
- Also block the "Pay $0 with Stripe" state: disable the checkout button when the computed amount is $0 (the second screenshot), since Stripe rejects zero-amount sessions.

## Technical notes

- `src/index.css`: readable `--warning-foreground` usage for tinted surfaces (add a dedicated token instead of overloading the solid-badge foreground).
- `src/components/dialogs/EnhancedBookingDialog.tsx`: banner class, marketplace payment gating.
- `src/components/dialogs/RecordPaymentDialog.tsx`: gas-fee gating in `financials`, marketplace total passthrough, error surfacing, zero-amount button guard.
- No database or edge function changes; `create-payment-checkout` behaviour is already correct.

## Verification

- Open BK-03493 (marketplace, $2/day): summary reads $2.00 total, no hidden fee, no Stripe checkout offered.
- Open a direct booking with the gas fee enabled: fee row visible and included, unchanged.
- Open a direct booking with the gas fee disabled: fee excluded from the total.
- Banner text legible in light and dark themes.
