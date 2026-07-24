Build the M6d renter money expiry and notification flow, consuming HTML email templates from Claude Code's PR.

## Design handoff
- Claude will deliver one HTML file per template via `github.com/exotiq-ai/exotiq-rent/pull/32`.
- Files: `payment-link.html`, `payment-reminder.html`, `payment-receipt.html`, `payment-refund.html`, `payment-expired-renter.html`, `booking-expired-operator.html`.
- Tone must match the booking site exactly; Claude owns brand assets and CSS.
- I will inline the HTML into the `send-renter-email` Edge Function with no external CSS or images (no storage dependency).

## Build steps
1. **Function: `send-renter-email`**
   - Create Edge Function with CORS and JWT verification.
   - Accept `{ template, booking_id, recipient_email, send_at?, override_data? }`.
   - Load booking + vehicle + team + renter + payment rows with tenant RLS guard.
   - Map each template to a pre-rendered HTML body with Liquid-style variable replacement.
   - Enqueue into the existing transactional email queue via `enqueue_email` RPC.

2. **Payment window expiry scheduler**
   - Add `payment_due_at` clamp logic: `min(pickup_time - 2h, booking_approved_at + 48h)`.
   - Create a row-level `cron` schedule per pending booking when approved:
     - Expiry job at `payment_due_at` to release dates if still `pending_payment`.
     - Reminder job at `payment_due_at - 24h`.
   - Cleanup jobs on payment status change.

3. **Status-change triggers**
   - `approved` → send `payment-link` email to renter; schedule expiry + reminder.
   - `payment_reminder` event → send `payment-reminder`.
   - `paid` → send `payment-receipt` with both charge breakdowns; cancel expiry/reminder.
   - `refunded` → send `payment-refund` confirmation.
   - `expired` → send `payment-expired-renter` to renter and `booking-expired-operator` to operator.

4. **Date release logic**
   - On expiry, set booking status to `expired` (or `cancelled` with reason) and remove the booking from vehicle availability.
   - Log to `booking_change_log` with reason `payment_window_expired`.

5. **Tokened payment link**
   - Use existing `booking.id` + hash as short-lived token for the `/rent/pay?b=...&t=...` URL.
   - Ensure URL points to the correct marketplace origin and is rendered in every email.

6. **Testing & deployment**
   - Deploy `send-renter-email` and `payment-window-scheduler` (or reuse the same function with `action` param).
   - Run smoke test:
     - Approve a booking <48h before pickup → confirm `payment_due_at` clamps to `pickup - 2h`.
     - Let one expire → confirm dates release and both emails enqueue.
     - Pay one → confirm receipt email and cron jobs cancel.
   - Verify templates render correctly across mobile and desktop clients.

## Out of scope
- Marketing/promotional emails.
- Auth email templates (already handled by Lovable auth).
- Payment UI changes outside the email flow.
