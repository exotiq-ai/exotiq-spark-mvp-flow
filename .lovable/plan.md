# Payments: send a payment link, real search, and retiring the deposit tiles

Four things, all in the Vault → Payments area plus the booking dialog.

## 1. Somewhere to send Gregory his payment link

Right now the tokenized payment link is emailed exactly once, at approval (`rent-approve-booking`, idempotency key `approve-{ref}`). If the renter loses that email there is no button anywhere in the app to send it again — that is why there's no obvious place for it.

Add a **Send payment link** action:

- New edge function `rent-resend-payment-link`: validates the caller's token in code, confirms active membership on the booking's team, requires status `pending_payment`, rebuilds the link with `buildPayUrl(booking_ref, confirmation_token, RENTER_APP_ORIGIN)`, and re-sends the existing `paymentApproved` template with the operator's tenant branding and reply-to. Idempotency key includes a timestamp bucket so a deliberate resend actually sends, with a 60-second per-booking throttle so a double click can't spam the renter.
- Button appears in two places: the sticky action bar of the booking dialog (next to Decline/Approve, shown when status is `pending_payment`) and on each row of the Payment Status list.
- Toast confirms the address it went to and the current payment deadline.
- For `payment_expired` bookings the button reads **Re-approve & send link** and routes through the existing approve path so a fresh deadline is set — no silent link to a dead window.

## 2. Search in Payment Status

The pending list (699 bookings for this tenant) has no search at all. Add a header row with:

- A search box matching customer name, booking reference, and vehicle.
- A quick filter: All / Overdue / Awaiting payment / Hold active.
- Result count, and a "show more" beyond the first 25 rows so the card doesn't render hundreds of blocks.

## 3. Payment History misses most of a customer's payments

Confirmed cause: `stripe-payment-history` pulls only the 50 most recent `payments` rows and scopes them to `user_id = auth user`, then the UI filters those 50 in the browser. Gregory has 9 payment rows across his bookings; only the one that happened to be in the newest 50 shows up. It is also the wrong scope — a manager on the team sees only rows their own user id created.

Fix:

- Scope the query by `team_id` (already populated on all 1,518 payment rows) with membership asserted from the caller's token, instead of `user_id`.
- Push search to the server: pass the query string and filter on customer name, email, booking reference, and vehicle, joined through `bookings`.
- Paginate: 50 per page with a "Load more", and show the true match count.
- Add a "Bookings with a balance" empty-state hint so an operator searching a customer who simply hasn't paid yet understands why there are no payment rows — with a link that opens that customer's bookings.

## 4. Clear the hardcoded security deposits in the Vault payment window

Exotiq exited the deposit flow on 2026-07-28, but the Vault still reads legacy columns: `stripe-get-balance` returns `held_security_deposits` from `bookings.security_deposit_status = 'held'` (45 stale rows), and `PaymentsSection` renders both a "Security Deposits Held" summary tile and a list from it.

- Remove the summary tile and the deposits list from `PaymentsSection`, and stop returning `held_security_deposits` from `stripe-get-balance`.
- Replace the fourth summary tile with **Balance due**, computed from open bookings — useful to a busy operator, unlike a retired count.
- Rename the legacy `Collect Deposit` button in Payment Status to `Record payment` (it already records an ordinary payment; the label is a leftover).
- The stale `security_deposit_*` columns stay on the table untouched — no data migration, display only.

## Technical notes

- Files: `supabase/functions/rent-resend-payment-link/index.ts` (new), `supabase/functions/stripe-payment-history/index.ts`, `supabase/functions/stripe-get-balance/index.ts`, `src/components/dashboard/PaymentTracker.tsx`, `src/components/dashboard/PaymentsSection.tsx`, `src/components/dialogs/EnhancedBookingDialog.tsx`.
- The new function ships with `verify_jwt = false` and in-code token validation, matching the nine functions fixed during the approval work, so browser errors surface real messages via `describeFunctionError`.
- Both edge functions keep the existing rule of never falling back to the platform Stripe account when a team has no connected account.
- Verify after build: Gregory's nine payment rows all appear under a "Gregory" search, the deposit tile is gone from the Vault, and a resend on BK-03493 lands with the correct deadline.
