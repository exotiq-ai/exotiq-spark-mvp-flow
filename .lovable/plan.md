## Diagnosis review

Claude's root cause is correct — verified against the code:

- `identity-webhook/index.ts` (lines 182–193): promotes `pending_documents → confirmed` only when `paid_at IS NOT NULL`. Nothing handles the pre-payment case.
- `rent-approve-booking/index.ts` (line 84): `APPROVABLE = ["pending","requested"]` — intentionally excludes `pending_documents`, so the operator can't rescue it.
- `expire_unverified_holds()` (migration `20260725002742…sql` line 102): cancels both `requested` and `pending_documents` after `4 hours` — so even after we fix the transition, a weekend request still dies before an operator sees it.

Claude's proposed fix (split on `paid_at` inside identity-webhook, keep `pending_documents` non-approvable) is the right shape. Two refinements worth making:

- **Different clocks for different waits.** `pending_documents` is waiting on the *renter* to verify ID — a shorter window there is fine (24h). `requested` is waiting on the *operator* — that's the one that must survive nights and weekends (72h). Collapsing both to 72h means an abandoned unverified booking blocks the calendar for 3 days. Split the expiry.
- **Pre-cancel warning email, not just at cancel.** Send at T-24h before auto-cancel, then again on cancel, to both renter and operator.

No pushback on the core fix — it's the smallest correct change and preserves the "verification before approval" precondition.

## Plan

### 1. Fix the missing transition (the launch blocker)
`supabase/functions/identity-webhook/index.ts`, in the `notifyVerified` branch:
- If `paid_at IS NOT NULL` → set `status = 'confirmed'` (existing behavior).
- If `paid_at IS NULL` → set `status = 'requested'` (new — this is what's missing).
- Both scoped to `booking_source='marketplace'` and `status='pending_documents'` as today.
- Redeploy the function.

### 2. Rescue BK-03458 before 19:14 UTC
One-off SQL update: flip BK-03458 from `pending_documents` → `requested` so the operator can approve it. Do this immediately after (1) ships so the fix is in place for anything else already in-flight.

### 3. Widen the expiry window, split by who we're waiting on
Migration to replace `expire_unverified_holds()`:
- `pending_documents` (waiting on renter ID): expire at `created_at + 24h`.
- `requested` (waiting on operator): expire at `created_at + 72h`.
- Return the same shape so `rent-payment-scheduler` / any caller keeps working.

### 4. Warn before cancelling, notify on cancel
- Add a scheduler pass (extend `rent-payment-scheduler` or add a sibling) that finds rows within 24h of their expiry and haven't been warned yet — email renter + operator, stamp a `expiry_warning_sent_at` column so we don't re-warn.
- On actual auto-cancel, send a cancellation email to both parties with `cancellation_reason` in the body. Today it's silent.
- Two new email templates in `send-renter-email/templates.ts`: `unverifiedHoldWarning`, `unverifiedHoldExpired` (renter copy; operator copy piggybacks on existing bell notifications + a short email).

### 5. Surface `cancellation_reason` in the renter app
Out of scope for this repo (renter app lives in `exotiq-rent`) — call it out in the Claude handoff so it lands there. On our side, make sure `cancellation_reason` is being written on every auto-cancel path (already is for `unverified_hold_expired`; confirm the same for payment expiry).

### 6. Handoff note for Claude
Short doc under `docs/rent/` summarizing: the transition fix, the new expiry windows, the new email templates + their variables, and the renter-app action item (render `cancellation_reason`).

## Technical details

- **Files touched:** `supabase/functions/identity-webhook/index.ts`, `supabase/functions/rent-payment-scheduler/index.ts` (or a new `rent-hold-expiry-scheduler`), `supabase/functions/send-renter-email/templates.ts`, one new migration for `expire_unverified_holds()` + `bookings.expiry_warning_sent_at`.
- **Not touched:** `rent-approve-booking` (keep `pending_documents` non-approvable — the precondition is correct).
- **Verification:** after (1), create a fresh marketplace booking, verify ID with the Stripe test doc, confirm the row lands in `requested` and appears in the operator's approval queue. Re-run the identity webhook against BK-03458's session id to prove idempotency.
