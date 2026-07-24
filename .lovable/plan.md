## M6c — Refunds & Cancellation

Two new edge functions plus Command Center wiring. No migration needed (statuses `cancelled`/`refunded` and PI columns already exist from M6a/b). Test mode only.

### 1. Deploy edge functions (from uploaded files)

- `supabase/functions/rent-cancel-booking/index.ts` — from `user-uploads://index-5.ts` (identical to index-6). Anonymous, token-gated renter self-serve cancel. ≥72h → full refund both legs (rental with `reverse_transfer`, Exotiq plain) → `refunded`; unpaid → `cancelled`. <72h → requires `acknowledge_forfeit: true` else 409 `forfeit_ack_required`; with ack → `cancelled`, no refunds. Idempotent per leg. Rate-limited (10/hr/IP). Partial-refund failure → keeps status, logs `renter_cancel_refund_failed`.
- `supabase/functions/rent-refund-booking/index.ts` — from `user-uploads://index-4.ts`. Authenticated operator/CC full refund. Verifies caller is active member of booking's team. Refunds both legs → `refunded`.

Both use existing `_shared/stripeMode.ts` (already present).

### 2. `supabase/config.toml` additions

```toml
[functions.rent-cancel-booking]
verify_jwt = false

[functions.rent-refund-booking]
verify_jwt = true
```

### 3. Command Center wiring — `src/components/dashboard/BookEnhanced.tsx` decline dialog

Currently `onConfirm` calls `updateBookingStatus(id, 'cancelled')` unconditionally. Change to:

- Look up the booking; if `paid_at` is set (paid marketplace booking), invoke `rent-refund-booking` with `{ booking_ref }` — the function refunds both legs and flips status to `refunded`. On success, show toast "Booking declined and refunded"; refresh bookings.
- If unpaid, keep existing `updateBookingStatus(id, 'cancelled')` path (rename button context to "Decline" as today).
- On refund failure, surface the returned error (e.g. `renter_cancel_refund_failed`) via toast and leave status untouched.

No new "Refund booking" button in this pass — the decline-after-payment auto-refund is the M6-D5 requirement. A standalone manual refund action can follow if you want it.

### 4. Verify

Deploy → confirm both functions respond (call `rent-refund-booking` without auth → 401; call `rent-cancel-booking` with bad token → 4xx, not "function not found"). Then run the 6-step gate from the README against a paid test booking (BK-03447 flow) in Stripe test mode.

### Notes / flags

- `bookingStatus.ts` already renders `cancelled` and `refunded` (verified: `CANCELLED_STATUSES` includes both). No copy changes needed.
- `FleetContext` already removes GCal events for `cancelled`/`declined`/`no_show`; add `refunded` to that list so refunded bookings also clear from Google Calendar (small addition, same file).
- Uploaded `index-5.ts` and `index-6.ts` are byte-identical — using index-5 as canonical source.
