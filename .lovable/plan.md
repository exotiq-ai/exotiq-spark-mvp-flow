# Fix silently-failing paid branch in identity-webhook

## Confirmed
- `guard_marketplace_confirm_transition` raises `check_violation` on both `requested → confirmed` AND `pending_documents → confirmed` for marketplace bookings.
- `identity-webhook`'s paid-path update (`pending_documents → confirmed` when `paid_at IS NOT NULL`) hits that guard, is caught only by `console.error`, and the webhook still returns 200. Silent failure in a money-adjacent webhook — must fix.
- Reachable via redact-then-reverify and payment/ID race orderings. Not a launch blocker but a real correctness bug.

## Decision: relax the trigger, keep the webhook branch

Rationale: the branch encodes a legitimate state ("payment landed before ID cleared"). Deleting it just moves the silent failure into a real one on the race. Better to teach the guard that `pending_documents → confirmed` is legal specifically when payment has already been captured — that's the invariant the guard actually cares about (no confirming without money).

## Migration

Update `public.guard_marketplace_confirm_transition` to:

```sql
IF NEW.status = 'confirmed'
   AND NEW.booking_source = 'marketplace' THEN
  -- requested → confirmed: always blocked, must flow through approval + payment
  IF OLD.status = 'requested' THEN
    RAISE EXCEPTION 'Marketplace bookings cannot be confirmed directly from requested — approval must go through rent-approve-booking (→ pending_payment → payment webhook → confirmed).'
      USING ERRCODE = 'check_violation';
  END IF;
  -- pending_documents → confirmed: allowed ONLY when payment already captured
  -- (the payment-first / ID-second race handled by identity-webhook).
  IF OLD.status = 'pending_documents' AND NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'Marketplace bookings cannot be confirmed from pending_documents without a captured payment.'
      USING ERRCODE = 'check_violation';
  END IF;
END IF;
RETURN NEW;
```

## Webhook cleanup (same turn)

In `supabase/functions/identity-webhook/index.ts`, promote the paid-branch error from `console.error` to a hard failure path: if the update returns an error, log it AND return 500 so Stripe retries. The unpaid branch stays as-is (its update is now the only "expected to succeed" one in the block, and `requested` transitions aren't guarded).

## Not doing (per your message)
- OTP / Supabase Auth config — parked.
- B1 webhook dedupe — waiting on Gregory's Stripe dashboard event list.
- Plan step 3 (draft-endpoint) from the previous plan — dropped; booking is created at reserve, so OTP-verified email just flows into `rent-create-booking` normally when we build OTP later.

## Verification after apply
1. Re-run the pending_documents → confirmed transition with `paid_at IS NOT NULL` on a test row → succeeds.
2. Same transition with `paid_at IS NULL` → raises check_violation.
3. `requested → confirmed` still blocked.
4. Re-check `identity-webhook` logs on a synthetic verified event for a paid booking → no error line, status flips to confirmed.
