# Tonight's remaining wrap-up

Four items from the 8/18 handoff are still open (the six audit defects shipped earlier tonight). Verified just now against the live backend and the migration source.

## 1. Turnover-day creation contract (highest impact)

`create_marketplace_booking` builds the return instant from the **pickup time** (`_pickup_time`, default 10:00 AM) for both ends of the range, and has no return-time parameter. So a Nov 11–13 booking is composed as Nov 13 10:00 and overlaps any booking starting earlier that day. Availability is day-granular, so the calendar advertises turnover days that creation then rejects.

Fix:
- Add optional `_return_time text` to `create_marketplace_booking`; compose `v_end` from it, falling back to pickup time.
- Extend `public_vehicle_availability` to return precise busy instants (start/end timestamps in team timezone) alongside the day flags, so the renter app can offer valid same-day turnover.
- Thread `return_time` through `rent-create-booking`.

Acceptance: return 10 AM + pickup 10 AM same day succeeds; return 5 PM + pickup 10 AM same day 409s.

## 2. Exotics By The Bay data

Confirmed the location row `ac9f3487…` has swapped fields: `name = "5001 Bridge st"`, `address = "Office"`. Team `pickup_address`, `pickup_instructions`, and `support_phone` are all null.

Fix: correct the location row (name "Office" / address "5001 Bridge St"), seed the team pickup address from it, leave `support_phone` null until EBTB supplies it (renter Call button lights up automatically once set).

## 3. Goodwill-refund copy

`stripe-create-refund` hard-409s marketplace bookings by design and there is no self-serve valve. Interim: add a line in the booking dialog's payments area for marketplace bookings — refunds outside the 72h policy are handled by contacting exotiq support. A real operator-initiated rental-leg-only refund action stays on the backlog.

## 4. Identity webhook dedupe

`supabase/functions/identity-webhook/index.ts` has no reference to `stripe_webhook_events` — the dedupe was **not** shipped. Add the `(consumer='identity', stripe_event_id)` claim-insert before processing so a double-delivered `requires_input` cannot double-count `attempt_count`.

## Already answered (no work)

- State fees: platform-maintained, tenant read-only.
- Drip templates read tenant name from the DB via `{{OPERATOR_NAME}}`.
- "Record payment" stays ledger-only; only Stripe events touch booking payment fields.

## Technical scope

New migration for the two SQL functions plus the EBTB data correction; edits to `supabase/functions/rent-create-booking/index.ts`, `supabase/functions/identity-webhook/index.ts`, and `src/components/dialogs/EnhancedBookingDialog.tsx`. No renter-facing contract removals — the availability payload is additive.
