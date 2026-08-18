# Booking approval: fix the failure and surface the action

## What I found

**1. The approve action is buried in the reservation card.**
The booking dialog does have Decline / Approve buttons, but they render at the very bottom of the card — below the Details, Payments, Customer, Notes and Activity tab content. On a tall booking you have to scroll past everything to reach them, so from the dashboard "View" it looks like there is no way to approve. There is also a separate "Save & Approve" that only appears in edit mode and only for `pending` (not `requested`) bookings, so marketplace requests never show it.

**2. The approval error.**
The failing booking is BK-03493 (Gregory Ringler, Sept 11, marketplace, status `requested`). The message in the toast was "Failed to send a request to the Edge Function" — that is a network/preflight-level failure, not an error returned by the approval service: the request never reached it, and there is no matching entry in the service logs.

The approval service is configured to require gateway-level token verification (`verify_jwt = true`), while it already re-validates the caller's token and team membership in its own code. Under the current signing-key setup, a gateway rejection happens before the response gets CORS headers, so the browser reports a generic "failed to send" instead of a real error. Every other operator-facing function on this project runs with in-code validation instead.

I confirmed the approval service itself is healthy: invoking it server-side for BK-03493 succeeded — the booking moved to `pending_payment`, a payment deadline was set (Aug 20), and the renter payment email went out. So **that specific booking is now approved**; the fixes below are so the next one works from the UI.

Secondary problem: the client only shows `error.message`, which for a non-2xx response is always the generic "Edge Function returned a non-2xx status code" — the actual reason (e.g. "Renter must complete ID verification", "not a member of this team") is thrown away.

## The plan

### A. Make approval reachable
- Move Decline / Approve out of the bottom of the scroll area into a sticky action bar pinned to the footer of the booking card, so it is visible regardless of tab or scroll position, for `pending` and `requested` bookings.
- Keep the existing guard behaviour: for `pending_documents` show the disabled state with the "awaiting renter ID verification" reason instead of an approve button.
- Include `requested` in the edit-mode "Save & Approve" condition so marketplace requests behave the same as direct ones.
- Show the resulting state clearly after approval ("Payment link sent — renter has until <date>") rather than just closing the dialog.

### B. Fix the approval failure
- Switch the approval function to in-code token validation (the checks it already performs) instead of gateway verification, matching the rest of the operator functions, and redeploy.
- Audit the other functions still on gateway verification that are called from the browser (refund, super-admin invite, Stripe account link, terms acceptance, tenant documents, compliance email, deposit setup, card capture link, digests) and move the browser-invoked ones to the same pattern so this class of failure cannot recur elsewhere.

### C. Make failures legible
- Add a shared helper that reads the JSON body of a failed function response and surfaces the real message in the toast, then use it for approve/decline (and the other booking-money calls that already do this ad hoc).
- Keep a fallback message for genuine network failures that names the likely cause instead of "Failed to send a request".

### D. Verify
- Approve a marketplace `requested` booking end to end from both the dashboard row and the reservation card, confirming status → `pending_payment`, payment deadline set, renter email sent, and the operator sees a success state.
- Confirm a `pending_documents` booking still cannot be approved and shows the reason.
- Confirm approval is blocked for a user outside the booking's team.
- Check desktop and mobile widths for the sticky action bar.

## Technical notes
- Files: `src/components/dialogs/EnhancedBookingDialog.tsx` (sticky actions, `requested` in Save & Approve), `src/contexts/FleetContext.tsx` (`updateBookingStatus` error surfacing), `supabase/config.toml` (`verify_jwt`), `supabase/functions/rent-approve-booking/index.ts` (redeploy; auth logic already present).
- No database changes and no change to the approval state machine: `requested` → `pending_payment` → paid → `confirmed` stays exactly as is.
