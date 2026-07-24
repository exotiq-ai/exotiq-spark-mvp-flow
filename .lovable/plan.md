## Goal
Route renter-email replies to each tenant's own support address, while keeping the From address on our verified `bookings@exotiq.rent` domain (DMARC-safe). Platform-owned refund replies stay with Exotiq support.

## Changes

### 1. Schema
Migration adds one nullable column:
- `teams.support_email text` (validated in-app; no CHECK constraint).

No grants/RLS changes needed — `teams` is already exposed to authenticated users via existing policies.

### 2. Team settings UI
In `src/components/dashboard/settings/BusinessProfileSection.tsx`, add a "Support email" input:
- Label: **Support email**
- Helper: *"Where renter replies to booking emails go. Leave blank to use Exotiq support."*
- Client-side validation: must be a valid email (zod), max 255 chars, or empty/null.
- Saved alongside existing business-profile fields; gated by `canEdit` (owner/admin).
- Refreshes `TeamContext` on save so downstream reads are current.

### 3. Edge-function reply-to routing
Introduce shared resolver logic; each caller looks up `teams.support_email` for the booking's team and passes it as `replyTo`.

Update these call sites:
- `supabase/functions/rent-approve-booking/index.ts` (paymentApproved)
- `supabase/functions/rent-payment-scheduler/index.ts` (paymentReminder + paymentExpired renter mail; operatorExpired stays as-is — it goes to the operator)
- `supabase/functions/rent-payment-webhook/index.ts` (receiptConfirmed)

Resolution order per email:
```
replyTo = team.support_email
       ?? Deno.env.get("RENTER_EMAIL_REPLY_TO")
       ?? "support@exotiq.ai"
```
Drop the current `${operatorName} <no-reply@exotiq.ai>` pattern — `no-reply@exotiq.ai` isn't a real inbox and defeats the point.

**Exception:** `supabase/functions/rent-refund-booking/index.ts` (refundConfirmation) keeps platform reply-to only:
```
replyTo = Deno.env.get("RENTER_EMAIL_REPLY_TO") ?? "support@exotiq.ai"
```

`send-renter-email/index.ts` default already falls back to `support@exotiq.ai`; update it to prefer `RENTER_EMAIL_REPLY_TO` env var when set.

### 4. Env var
Add `RENTER_EMAIL_REPLY_TO` as a project secret (via `set_secret`, value `support@exotiq.ai`) so the fallback is externally controllable without a redeploy.

### 5. From address
Unchanged — `bookings@exotiq.rent` everywhere. Never From a tenant address.

### 6. Seed + verify
- Set `teams.support_email` for the Exotiq team (target address to be confirmed — see question below).
- Redeploy the four affected edge functions.
- Verify by sending a test `paymentApproved` (Reply-To should be tenant address) and a test `refundConfirmation` (Reply-To should be `support@exotiq.ai`).

## Technical notes
- Booking rows already carry `team_id`; scheduler/webhook/approve all fetch the team already, so adding `support_email` to those selects is a one-field extension.
- `types.ts` regenerates after the migration is approved, then code changes land.
- No frontend consumer besides the settings form reads this field yet.

## Open question
What email should `teams.support_email` be seeded to for the Exotiq team? (e.g. `hello@exotiq.ai`, `support@exotiq.ai`, or a dedicated `bookings@exotiq.ai`?)
