Now that `exotiq.rent` is verified in Resend, the M6d email system can send live. The 6 PR #32 templates are already inlined in `supabase/functions/send-renter-email/templates.ts` and all edge functions are deployed. No template or code changes are needed — this is a config + verification pass, plus a cron registration if the scheduler isn't wired.

## Steps

1. **Confirm sender secret**
   - Check `RENTER_EMAIL_FROM`. Code default is `Drive Exotiq <bookings@exotiq.rent>`; if unset or pointed elsewhere, set it to an address on the now-verified `exotiq.rent`.
   - Confirm `RESEND_API_KEY` and `INTERNAL_FUNCTION_TOKEN` are present.

2. **Live send smoke test**
   - Invoke `send-renter-email` with `paymentApproved` to a real inbox using representative variables.
   - Confirm HTTP 200 + Resend `message_id`, and that the email renders on Gmail web + iOS Mail.

3. **End-to-end approval test**
   - Call `rent-approve-booking` on a marketplace `pending` booking → confirm `payment-approved` email arrives and `payment_due_at` is set.

4. **Scheduler cron: verify or register**
   - Check `cron.job` for a `rent-payment-scheduler` entry and check recent edge-function logs.
   - **If no recent runs / no schedule exists** (expected — no `cron.schedule` for it appears in the migrations):
     - Register a pg_cron job that fires every 15 minutes and calls the function via `net.http_post` with the `x-cron-token` header (using `INTERNAL_FUNCTION_TOKEN` or the dedicated cron token secret if one exists — confirm which the function expects).
     - Because the SQL contains project-ref, anon key, and secret token, register it via the Supabase insert path (not a repo migration).
     - Also commit a reproducible migration file under `supabase/migrations/` that documents the schedule with placeholders (no secrets), so cutover to prod can re-register it.
     - Wait one cycle and confirm one live execution appears in the logs with a 200 response.
   - **If it already exists and is firing**, just note the last run time.

5. **Reminder + expiry spot check**
   - Optionally shorten `payment_due_at` on a test booking to force reminder + expiry paths and confirm `paymentReminder`, `paymentExpired`, and `operatorExpired` all send.

6. **Report back**
   - Message IDs, cron job id + last run, and any rendering issues.

## Out of scope
- Template copy changes.
- Migrating to Lovable Emails.
- Any function code changes unless smoke test surfaces a bug.
