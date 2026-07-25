# Handoff to Claude — Pre-Launch Follow-ups (2026-07-25)

Everything in this doc is the **Lovable/SPARK side is done, Claude/exotiq-rent
side is not yet**. Grouped by whether it belongs to renter frontend, tenant
Command Center UI in SPARK, or repo-hygiene chores.

---

## 1) What SPARK just shipped (context you don't need to redo)

### DB migrations
- `bookings.exotiq_leg_attempt integer NOT NULL DEFAULT 0` — retry counter
  so a declined Exotiq-leg PI can be recharged with a fresh idempotency key.
- `bookings.operator_payment_intent_id` / `exotiq_payment_intent_id`
  reasserted `IF NOT EXISTS` (M6 handoff #27).
- `set_payment_due_at` trigger no longer double-tz-shifts `start_date`
  (handoff #21).
- `create_marketplace_booking(...)` — `_platform_fee_cents` and
  `_protection_total_cents` DEFAULTs dropped. Stale callers now hard-fail
  instead of silently writing $0 fees (handoff #20).
- `teams.platform_fee_percent` default `10.00` + backfill for any
  marketplace-visible tenant that was accidentally at 0 (handoff #17).
- `bookings.vehicle_id` FK is now `ON DELETE RESTRICT`. Hard-deleting a
  vehicle with historical bookings will fail; ops must use `archive_vehicle`.
- `teams.default_deposit_cents` + `vehicles.deposit_override_cents` +
  `resolve_deposit_cents(vehicle_id) -> bigint` helper. Fallback order:
  vehicle override → tenant default → 100000 ($1,000) platform fallback.

### Edge functions (already deployed on this Lovable project)
- `rent-payment-webhook` — hardened `checkout.session.completed`:
  - Always persists `operator_payment_intent_id` even for
    already-terminal bookings.
  - Auto-refunds with `reverse_transfer: true` when payment lands after
    a booking is expired/cancelled, and fires `opsAlert`.
  - Bumps `exotiq_leg_attempt` and uses `exotiq-leg-{ref}-{attempt}` as
    the idempotency key (retries after a decline no longer get locked out
    by the 24h idempotency window).
- `rent-payment-webhook` (Phase 6) — after both legs paid, checks the
  customer's `identity_status`. If not `verified`, parks the booking at
  `pending_documents` and sends a `verifyIdRequested` drip email in
  addition to the receipt. If already verified, jumps straight to
  `confirmed` as before.
- `identity-webhook` — on `verification_session.verified`, auto-promotes
  any of that customer's paid marketplace bookings that are sitting at
  `pending_documents` up to `confirmed`.
- `rent-retry-exotiq-leg` — new JWT + team-membership gated endpoint.
  Takes `{ booking_ref }`, retrieves the saved card off the rental PI,
  bumps `exotiq_leg_attempt`, and creates an off-session PI for the
  Exotiq leg. Ops-callable only.
- `rent-cancel-booking` / `rent-refund-booking` — already judge "paid" by
  `booking_has_captured_leg` (SQL helper) / `isPaidOrCaptured` (TS
  helper), not by `paid_at`.
- `send-renter-email` — new `verifyIdRequested` template. Uses tenant
  `support_email` reply-to via `resolveRenterReplyTo`.

### Frontend (SPARK Command Center)
- `src/lib/bookingPaymentState.ts` — canonical `isPaidOrCaptured()` TS
  mirror of the SQL helper.
- `src/lib/bookingEditGuards.ts` — `isMarketplaceLocked()` + `LOCKED_FIELDS`.
- `PaymentTracker` — marketplace bookings now judge paid via
  `isPaidOrCaptured`. A lagged ledger mirror can no longer show a paid
  booking as pending/overdue.
- `EnhancedBookingDialog` — Edit button is hidden entirely on locked
  marketplace bookings; `handleSaveChanges` also refuses defensively with
  a clear toast if a stale open dialog tries to save.

---

## 2) What Claude should do next in `exotiq-rent`

### A. Server-authoritative quoting for checkout (M6 handoff #17 + #24)
Frontend is currently doing `platform_fee_percent ?? 10` math client-side.
Move the truth to the server.

- Add / harden `public_vehicle_quote(_team_slug, _vehicle_slug, _start, _end,
  _protection_tier)` to return every cents number the checkout page needs:
  ```
  { daily_rate_cents, days, subtotal_cents,
    platform_fee_cents, protection_cents,
    deposit_cents,           -- from resolve_deposit_cents(vehicle_id)
    total_cents }
  ```
- Renter frontend must render exactly what the RPC returns; **no local
  math, no `?? 10` fallback**. If the RPC is missing a field, hard-fail
  the checkout page — do not fill in a default.
- Payment-intent creation on the SPARK side already reads the stored
  `platform_fee_cents` / `protection_total_cents` from the booking row, so
  once the RPC is authoritative on the way in, it stays authoritative.

### B. Checkout extras — don't auto-select anything (handoff #16)
`PayStep` (or wherever the extras list lives) is pre-selecting the $150
delivery option. Per Gregory's ruling: **no extras selected by default**.
Renter opts in explicitly.

### C. Checkout copy — "Final payment" (handoff #26)
`PayStep` says "Final payment" in a place where it's actually the only
payment. Rename it to something honest ("Complete payment" / "Pay now").

### D. Renter frontend needs `confirmation_token` on identity session
`identity-create-session` now requires **both** `booking_ref` **and**
`confirmation_token`. Update the renter call site to pass the token from
the URL (`?ref=...&token=...`) that the payment-approved / verify-id-requested
emails already include. Email variables:

- `paymentApproved` — `CONFIRMATION_URL` includes `?ref=...&token=...`.
- `verifyIdRequested` — `VERIFY_URL = ${origin}/verify?ref=...&token=...`.

### E. `/verify` route on the renter app
The new `verifyIdRequested` email links to `${origin}/verify?ref=...&token=...`
(currently pointing at `https://book.exotiq.rent`). Wire that route to:
1. Look the booking up via `public_booking_by_ref(ref, token)`.
2. Call `identity-create-session` with `{ booking_ref, confirmation_token, email }`.
3. Redirect to Stripe Identity `url`.

### F. Insurance verification flow (Claude ships tomorrow per plan)
The `verifyIdRequested` email currently says "insurance upload is coming
next." Once you ship the insurance surface, add a follow-up email
(`insuranceRequested`) that fires from a new webhook branch after
`identity_status = 'verified'`. SPARK can add the template + trigger
point on request — just ping when the API is ready.

---

## 3) What Claude should do in Command Center UI (SPARK repo)

I intentionally did **not** ship these because they're substantive UI
work that shouldn't happen at end-of-session:

### G. Tenant "Security deposit" setting
- File: `src/components/business/BusinessProfileSection.tsx` (or wherever
  the tenant settings form lives).
- New field: **Security deposit** — dollar input, stored as
  `teams.default_deposit_cents` (× 100 on save, ÷ 100 on load).
- Helper text: "Default hold placed on the renter's card at pickup.
  Never charged unless there's damage. Per-vehicle override available on
  each vehicle's rate card."
- Validation: integer ≥ 0, ≤ 500000 ($5,000 cap for sanity).

### H. Per-vehicle deposit override on the rate card
- File: `src/components/fleet/VehicleCommandCenter.tsx` (the rate-card /
  pricing tab).
- New optional field: **Override deposit for this vehicle** — dollar
  input, stored as `vehicles.deposit_override_cents`. Empty = use tenant
  default.
- Helper text: "Leave blank to use your tenant-wide default
  (${team.default_deposit_cents / 100 || 1000})."

### I. Wire the resolved deposit into the hold-capture path
Wherever the deposit hold PI is created (`stripe-capture-hold` /
similar), replace any hardcoded deposit with:
```sql
select public.resolve_deposit_cents(:vehicle_id)
```
The RPC is `SECURITY DEFINER`; grants are already in place for
`authenticated` and `service_role`.

---

## 4) Repo hygiene — the real Phase 4 fix (handoff #15)

The five money edge functions are deployed on Lovable Cloud but **not
committed** to the SPARK repo:

- `rent-checkout`
- `rent-payment-webhook`
- `rent-cancel-booking`
- `rent-refund-booking`
- `rent-approve-booking`

Plus the ones added this turn:

- `rent-retry-exotiq-leg` (new)
- Updated `send-renter-email/templates.ts` (added `verifyIdRequested`)
- Updated `identity-webhook/index.ts` (pending_documents → confirmed promo)
- Updated `rent-payment-webhook/index.ts` (Phase 6 branching)

**A redeploy from `main` would silently revert every Phase 1 / Phase 6
change.** Please pull the current deployed source of each of these
functions from the Lovable project and commit them under
`supabase/functions/<name>/index.ts` on `main`. The `DEFAULT 0` removal
on `create_marketplace_booking` is belt-and-suspenders; committing these
files is the real fix.

---

## 5) Deferred / not in this pass

- **Phase 7 observability**: ops-alert schema fix + real 20-min uptime
  probe assertions. Not blocking launch; call it out if you want me to
  land next round.
- **Reconciliation sweep** for orphaned captured PIs — scan came back
  empty on 2026-07-25, so no backfill was needed. Re-run before flipping
  to live keys:
  ```sql
  select booking_ref, status, operator_payment_intent_id, exotiq_payment_intent_id
    from public.bookings
   where booking_source = 'marketplace'
     and status in ('pending_payment','payment_expired','cancelled')
     and booking_has_captured_leg(bookings.*) = true;
  ```

---

## 6) Smoke tests I'd run before flipping live keys

1. **Happy path, ID already verified**: renter with `identity_status='verified'`
   completes Checkout → webhook lands both PIs → booking should go straight
   to `confirmed`, receipt email only.
2. **Happy path, ID not yet verified**: fresh renter completes Checkout →
   booking should land at `pending_documents`, receipt + verifyIdRequested
   emails both send. Then complete the Stripe Identity flow → identity
   webhook should auto-promote to `confirmed`.
3. **Late payment on expired booking**: force-expire a booking in
   pending_payment, then complete the Checkout session that was open.
   Webhook should persist the PI, refund with reverse_transfer, and log
   an ops alert. Booking status stays terminal.
4. **Exotiq-leg decline retry**: force the second (off-session) PI to
   decline (Stripe test card `4000000000000341`). Ops calls
   `rent-retry-exotiq-leg` with a real card attached to the customer —
   PI should succeed under a fresh `exotiq-leg-{ref}-2` idempotency key.
5. **Edit-lock**: on a `pending_payment` / `confirmed` marketplace
   booking, open EnhancedBookingDialog in Command Center — Edit button
   must be hidden, "Locked · marketplace paid" chip must show.
6. **Fleet delete guard**: try to hard-delete a vehicle with any
   historical booking — should error with FK violation. `archive_vehicle`
   should still succeed.

---

Ping me when Claude is ready with the insurance surface or when the
renter frontend is passing `confirmation_token` to `identity-create-session`
so I can smoke-test end-to-end.
