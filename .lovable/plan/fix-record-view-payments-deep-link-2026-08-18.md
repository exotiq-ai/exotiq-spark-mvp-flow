# Fix "Record / view payments" deep link

No — it is mis-plumbed. The button closes the booking card and then re-opens the exact same card instead of landing on the Payments tab.

## What is actually happening

1. The button calls the navigation helper for payments, which pushes `/dashboard/bookings?view=payments&bookingId=<id>`.
2. The Bookings page only reads a `tab` parameter when deciding which tab to show. It ignores `view`, so the Payments tab never activates and you stay on the calendar/list tab.
3. The page separately watches for `bookingId` in the URL and auto-opens the booking details dialog — which is why the same card pops straight back open.
4. Even if the tab did switch, the payments view receives no booking context, so it could not focus the booking you came from.

## The fix

- Change the payments navigation to use the parameter the Bookings page actually understands (`tab=payments`), keeping the booking id under a distinct key so it is not mistaken for "open this booking's card".
- Teach the auto-open effect to ignore the booking id when the destination is the payments tab, so no dialog re-opens.
- Pass the booking id into the Payments tab: it scrolls to and highlights that booking's row in Payment Status, so the operator lands exactly where they expect. If the booking is not in the outstanding list (already paid), pre-fill the Payment History search with its booking reference instead.
- Marketplace bookings cannot take manual charges (the card already says so). For those, the button reads "View payment activity" and simply lands on the payments view — no misleading "Record" wording.

## Verification

- From a non-marketplace booking card: button closes the card, Payments tab is active, that booking's row is highlighted, and Record payment opens for it.
- From BK-03493 (marketplace, pending payment): button lands on the payments view with the booking highlighted, no record-payment affordance, no re-opened card.
- From a fully paid booking: lands on Payment History filtered to that booking reference.
- Same checks from the calendar's booking card and from mobile width, since both entry points share the handler.

## Technical notes

Files: `src/hooks/useModuleNavigation.ts` (`goToPayments` param change), `src/components/dashboard/BookEnhanced.tsx` (tab param handling, guard the `bookingId` auto-open, pass focus id to `PaymentTracker`), `src/components/dashboard/PaymentTracker.tsx` (accept `focusBookingId`, scroll/highlight, seed search), `src/components/dialogs/EnhancedBookingDialog.tsx` (label by booking source). Navigation only — no changes to payment amounts, Stripe calls, or booking records.
