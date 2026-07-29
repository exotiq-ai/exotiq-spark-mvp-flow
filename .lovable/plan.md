## Extend Booking — Claude review v3 fixes

Two blockers (money bug + missing consent email) plus three smaller items. Ship in this order; E2E last.

---

### Blocker 1 — Processing fee overcharge (money bug)

**Current (wrong):** 2.9% is applied to `addedSubtotalCents + addedProtectionCents` — the rental subtotal is billed to the renter here AND already absorbed by the operator through the destination-charge Stripe fee. Renter pays Stripe on rental twice. Verified against BK-03459: 2881¢ correct vs 5033¢ shipped, ~$21.52/day overcharge.

**Fix in `supabase/functions/rent-extend-booking/index.ts`** (~line 191):

```
addedProcessingFeeCents =
  Math.round(0.02 * addedSubtotalCents) +
  Math.round((addedPlatformFeeCents + addedStateFeeCents + addedProtectionCents + Math.round(0.02 * addedSubtotalCents)) * 0.029) +
  30
```

i.e. 2% flat platform commission on rental + Stripe 2.9%+30¢ applied to the **Exotiq leg only** (platform + state + protection + the 2% itself). Matches `public_vehicle_quote` reconstruction (39689 → 1181 → 2881).

Also delete the dead & wrong `estimateProcessingFeeCents` helper.

### Blocker 2 — Renter consent email

`rent-extend-booking` never calls `sendRenterEmail`. Two off-session charges land silently → chargeback + no written consent trail.

**Fix:**
1. Add `bookingExtended` template to `supabase/functions/send-renter-email/templates.ts` + type union in `_shared/rentEmail.ts`. Content: extension summary (added days, new return date, itemized breakdown, both charge amounts, operator name, "if you did not authorize this, reply immediately").
2. In `rent-extend-booking` after `applyBookingBump` succeeds on the `card_on_file` path, call `sendRenterEmail({ templateName: "bookingExtended", idempotencyKey: \`ext-${extension.id}\`, ... })`. Failure to send emails must NOT reverse the charge — log and continue.
3. Resolve reply-to via `resolveRenterReplyTo(team.support_email)`.

---

### Smaller items

**S1 — Availability status list.** Line 155: add `pending_documents` and `pending_payment` to the `.in("status", [...])` list so extensions can't overlap holds/awaiting-payment bookings.

**S2 — Row lock on the booking during extend.** Currently `SELECT → charge → UPDATE` with no lock: two concurrent extensions both pass the availability check and both charge. Wrap the booking read + availability check + insert in an RPC `begin_booking_extension(booking_id, new_end_date)` that does `SELECT ... FOR UPDATE` on the booking row and re-validates status ∈ {confirmed, active, checked_out} before returning the snapshot the function uses to charge. Prevents both the concurrent-extend race and the "renter cancels mid-extension" race (review item 6).

**S3 — Protection rate drift (3rd copy).** `protectionDailyCentsForTier` restates rates that already live in `public_vehicle_quote` and `totals.ts`. Read the rate from the quote: extend the RPC (or add a small `get_protection_daily_cents(tier)` SQL function) and call it from the edge function instead of hardcoding. Fallback to the current constants only if the RPC fails, and log a warning.

**S4 — Idempotency keys on failure-path refunds.** In `rent-extend-booking` rollback branches, pass `idempotencyKey: \`ext-rollback-op-${extension.id}\`` / `ext-rollback-exotiq-${extension.id}\`` to the `refunds.create` calls, matching the pattern used in `rent-cancel-booking`.

---

### E2E (after fixes only)

Operator extends BK-03459 by 1 day in the Command Center. Claude verifies from DB + Stripe:
- Both PIs, amounts vs quote formula (expect 2881¢ processing, not 5033¢)
- `bookings` snapshot bumps (`total_value`, `platform_fee_cents`, `state_fee_cents`, `processing_fee_cents`, `protection_total_cents`)
- `booking_extensions` row status = `paid`
- Renter received `bookingExtended` email
- Then cancel in free window → confirm both base legs AND both extension legs refunded (4 PIs total)

### Technical notes

- Do NOT deploy edge functions until all four fixes are in one push (fee math + email + status list + idempotency). S2 requires a migration for the RPC — that lands first, then the edge function switches to use it.
- S3 can ship in the same edge deploy if the RPC is trivial; otherwise defer S3 to a follow-up and leave a `// TODO drift-risk` comment referencing the two other locations.
- No UI changes needed; `ExtendBookingDialog` already computes the same processing formula client-side for the preview — it needs the same fix to keep the preview equal to the server (edit `src/components/dialogs/ExtendBookingDialog.tsx` line ~93 in parallel).
