# Exotics by the Bay go-live — backend/Command Center response

Answers to Claude's handoff, plus the work needed on our side. Verified against the live backend today.

## What's already true (no work)

- **State fee is jurisdiction-aware and live.** The quote returns `state_code`, `state_fee_label`, `state_fee_daily_cents` from the `state_rental_fees` table via the tenant's pickup-location state. Unknown state returns 0.
- **Support email already exists per team** and is already used as reply-to by approval, reminder, receipt, expiry and hold emails (`resolveRenterReplyTo`).
- **Tax fields already exist per team** (label, rate %, inclusive flag) in Business Profile settings — they just aren't wired into the marketplace quote yet.
- **Booking snapshot columns exist** for platform fee, protection, state fee, processing fee — tax needs one new column.
- **10% renter-side only** in checkout — confirmed, left alone.

## Work

### 1. Identity live-mode flip (blocker)
Point `STRIPE_IDENTITY_SECRET_KEY` at the live secret key, redeploy `identity-create-session` and `identity-session-status`, then create and cancel one live session to confirm.

### 2. Tenant-branded renter emails (blocker)
Per your call: tenant name leads, platform stays quiet, automation flow untouched.

- From display name becomes the tenant's business name (address stays `bookings@exotiq.rent`), reply-to stays the tenant's Command Center support email, falling back to platform support.
- Subjects carry the tenant name ("Your Exotics By The Bay booking…").
- Templates already accept `OPERATOR_NAME`; replace the 14 hardcoded "Drive Exotiq" strings (titles, header lockups, footers) with that variable and make every caller pass the team name. No changes to when or why emails fire.

### 3. Operator tax as a quote line item
- `public_vehicle_quote` gains `operator_tax_rate`, `operator_tax_label`, `operator_tax_cents`; `operator_total_cents` becomes rental subtotal + tax.
- New `operator_tax_cents` column on bookings, snapshotted at creation and exposed by `public_booking_by_ref`.
- `rent-checkout` operator leg charges subtotal + tax so the tenant receives and remits it; transfer still nets only their own Stripe fee share. Platform leg untouched.
- Tenants with rate 0 see no line (Exotics by the Bay is 0 today unless they set one).

### 4. State fee visibility in Command Center
Read-only panel in tenant settings showing the resolved state, label and daily rate, with a note that the platform maintains the rate. Super Admin gets an editor for the `state_rental_fees` table.

### 5. Cancellation policy of record
Platform standard, no operator override: full refund more than 72h before pickup, full forfeit after. Backend already behaves this way — we document it as deliberate and surface the same wording in Command Center so operators see the policy they're bound by. Claude rewrites the renter copy to match.

### 6. Onboarding readiness checks
Extend the marketplace readiness panel with hero image on every listed vehicle, public description, timezone, state, phone, Connect charges/payouts enabled, Connect statement descriptor set, and platform fee % greater than zero. Each item shows the renter-visible failure it prevents.

### 7. Identity webhook dedupe
Add per-event idempotency to `identity-webhook` so a duplicate delivery can't double-count `attempt_count` and push a renter into manual review a failure early. Confirm the manual-review queue is visible to Exotics by the Bay staff in their Command Center.

### 8. Timezone confirmation
Confirm marketplace booking writes compose start/end from local date + time through the team timezone for `America/New_York`, and add `timezone` to `public_booking_by_ref` so confirmations render correctly without the catalog RPC.

## Verification before go-live
Live quote + booking dry run on the Exotics by the Bay storefront: quote equals snapshot equals charge (including tax when set), FL fee at $2.00/day, one real Identity verification end-to-end, and one tenant-branded email received and inspected.

## Reply for Claude
A short summary of the above (what shipped, what's changing, the two policy answers) written for copy-paste once the work lands.
