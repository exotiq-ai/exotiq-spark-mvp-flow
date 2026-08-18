# Request-received email at booking creation

Today a renter who submits a booking request gets nothing. Their secure confirmation link exists only in the browser tab they used, and the renter app's not-found page tells them to check an email that was never sent. The first email they ever receive is "payment approved" — which may be hours later, or never if the operator declines.

This adds a `bookingRequest` template sent the moment `rent-create-booking` succeeds.

## What the renter gets

Subject: `Request received — {Operator} is reviewing your dates · {BK-ref}`
From: operator business name, reply-to the operator's support email (same tenant branding shipped for approval/receipt emails).

Body:
- Confirmation that the request is in, with vehicle, date range, pickup time, and booking reference.
- A prominent **View your booking** button using the tokenized confirmation link — the durable copy of what currently only lives in the browser tab.
- "What happens next" as three steps: operator reviews → payment link emailed with a deadline → pickup details confirmed.
- A note that no charge has been made yet.
- Operator support contact (support email, and support phone when the tenant has one) plus "just reply to this email".

Two variants of the "what happens next" opening step, driven by the booking's initial status:
- `requested` (ID already verified): "Review usually happens within a few hours."
- `pending_documents` (ID not yet verified): same steps, plus a line that ID verification is part of the process and the operator will follow up — no dead-end CTA, since verification currently happens after payment.

## Technical notes

- New key `bookingRequest` in `supabase/functions/send-renter-email/templates.ts`, matching the existing dark-card markup of `paymentApproved`. Variables: `OPERATOR_NAME`, `BOOKING_REF`, `VEHICLE_NAME`, `VEHICLE_SHORT`, `DATE_RANGE`, `PICKUP_TIME`, `LOCATION`, `RENTAL_TOTAL`, `NEXT_STEP_NOTE`, `SUPPORT_LINE`, `BOOKING_URL`. Every placeholder must resolve — the sender rejects unresolved `{{VARS}}`.
- `supabase/functions/rent-create-booking/index.ts`: after `create_marketplace_booking` returns, fetch the team row (`name`, `currency`, `timezone`, `support_email`, `support_phone`), build the link with the existing `buildPayUrl` helper against `RENTER_APP_ORIGIN`, and call `sendRenterEmail` from `_shared/rentEmail.ts` with `fromName` = operator name, `replyTo` = `resolveRenterReplyTo(team.support_email)`, and `idempotencyKey` = `request-${booking_ref}` so retries never double-send.
- Send is best-effort and wrapped in try/catch: an email failure logs `[RENT-CREATE-BOOKING] Request email failed` and still returns the booking payload. Booking creation must never fail because Resend is down.
- Reuses `formatDateRange`, `formatPickupTime`, `formatCurrency`, `shortVehicleName` from `_shared/rentFormat.ts`; no new helpers.
- Tags: `booking_ref` and `email_type: booking_request` for Resend filtering.
- Deploy `rent-create-booking` and `send-renter-email`.

## Verification

- Render check: interpolate the new template with a sample payload and confirm zero unresolved placeholders in both the HTML and derived plain-text path.
- Live send: create a real marketplace booking request against a test tenant through `rent-create-booking`, confirm a `202`/message id from Resend in the function logs, and confirm the emailed link opens that booking on the renter app rather than the 404 page.
- Repeat once for a `pending_documents` booking (unverified email) to confirm the alternate next-step copy.
- Re-run the same creation with the identical reference to confirm the idempotency key suppresses a duplicate.
