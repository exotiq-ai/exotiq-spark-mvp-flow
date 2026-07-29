
## Verification: `setup_future_usage`

Confirmed in `supabase/functions/rent-checkout/index.ts:174` — `payment_intent_data.setup_future_usage: "off_session"` is already set, and `payment_method_types` is card-only (line 158). Every marketplace booking created since M6b has a reusable card on file at the **platform** customer. No change needed to `rent-checkout`; backward-compat clause is moot.

## Bugs to fix in `rent-extend-booking`

The M6 charge model is a **destination charge on the platform** with `on_behalf_of` + `transfer_data` for the operator rental, plus a **separate platform charge** for the Exotiq leg. My first pass got two things wrong:

1. **PI lives on the platform, not the connected account.** I called `stripe.paymentIntents.retrieve(pi, { stripeAccount })` — that queries the connected account and would return "not found" for every marketplace booking. Fix: retrieve without `stripeAccount`, pull `customer` + `payment_method` from the platform PI.

2. **Single PI on the connected account is wrong split.** I created one PI for `added_total_cents` on the connected account with `application_fee_amount`. That routes the state fee + Exotiq platform fee to the operator's Stripe balance, then claws back only the platform fee — the state fee stays with the operator instead of Exotiq. Correct split for an extension of +N days:
   - **Operator leg** (destination charge on platform): `rental_rate × added_days` — `transfer_data.destination = operator`, `amount = rental − operator's Stripe processing share` (mirrors `stripeFeeEstimateCents` in `rent-checkout`).
   - **Exotiq leg** (plain platform charge): `platform_fee_pct × added_rental + state_fee_589¢ × added_days + processing_fee_est`. No `transfer_data`; stays on the platform.
   Both use the same saved PM off-session on the platform customer. Two `paymentIntents.create` calls, distinct idempotency keys (`extend-op-…`, `extend-fee-…`).

3. **Failure ordering.** Charge operator leg first, then Exotiq. If operator succeeds but Exotiq fails, mark extension `partially_paid`, refund the operator leg, and surface a clear error — never leave the operator with rental $ but Exotiq with $0.

4. Insert two `payments` rows (one per leg) to match how `rent-payment-webhook` records the original two legs.

## Fees on extensions

Per your direction — every added day carries the same three components as the original booking:
- Rental rate × added days → operator
- Platform fee % of added rental → Exotiq
- State rental fee 589¢ × added days → Exotiq
- Processing fee estimate on the Exotiq leg → Exotiq

Snapshot all four onto `booking_extensions` so the row is a self-contained receipt.

## Flag: state-fee jurisdiction gap (system-wide, not extension-specific)

The 589¢/day state fee is **hardcoded and location-blind everywhere it appears** — `rent-create-booking`, `public_vehicle_quote`, and now the extension. There is no `location.state` → tax-rate lookup, no exemption table, and the `state_fee_cents` column has no jurisdiction metadata. So:
- Bookings originating in Montana, Oregon, New Hampshire, Delaware, or Alaska (no sales tax) currently overcharge.
- Bookings originating in states with short-term rental tax that isn't 589¢/day (most of them) are wrong too — the 589¢ figure was a placeholder in the M6d fee migration.
- Extensions will inherit whatever wrong-or-right rate was on the original booking, which is at least internally consistent, but the underlying flaw is not extension-specific.

Recommendation: leave the extension using 589¢/day for now (matches the rest of the system), and open a follow-up to add a per-location `state_fee_cents_per_day` on `locations` with exemption support. That's a M6-adjacent tax project, not part of this extend-booking work.

## Files touched (implementation phase)

- `supabase/functions/rent-extend-booking/index.ts` — rewrite charge section per the two-leg model above; keep the manual/`card_on_file` branch, availability re-check, and idempotency envelope.
- `src/components/dialogs/ExtendBookingDialog.tsx` — no functional change; copy tweak so the receipt block itemizes "Rental (operator)" and "Fees (Exotiq)" separately, matching the receipt renters see in the confirmation email.
- No DB migration — `booking_extensions` already carries all four cent columns.

## Verification after implementation

- Typecheck.
- Manual sandbox test on BK-03458 (or a fresh test booking): extend +1 day, confirm two PIs appear in Stripe (one destination-charged to operator connected acct, one on platform), both `succeeded`, both mirrored in `payments`.
- Force the Exotiq leg to fail (bad amount) and confirm the operator leg is auto-refunded and extension row lands `failed` with a useful reason.
