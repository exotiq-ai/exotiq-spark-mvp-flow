# BK-03501 full-flow audit

## First correction: the checkout you completed was BK-03493, not BK-03501

Both bookings are yours on the Audi S8 (team Drive Exotiq, Phoenix time):

| | BK-03493 | BK-03501 |
|---|---|---|
| Created | 8/18 19:15 | 8/18 21:26 |
| Dates | Sep 11 17:00 → Sep 12 17:00 UTC | Sep 12 17:00 → Sep 13 17:00 UTC |
| Approved | yes | yes (8/18 23:01, pay by 8/20 23:01) |
| Paid | yes — 8/18 23:02, both legs | no |
| Status | confirmed | pending_payment |

The two Stripe charges at 23:02 (operator leg $2.00 on `acct_1Tvnfg…`, Exotiq leg $6.61) both carry `booking_ref: BK-03493` in metadata. BK-03501 has no payment intents, no ledger rows, no receipt. It will auto-expire on 8/20 unless paid — so if you meant to pay for 03501, that link is still live.

**Good news buried in this:** 03493 ends exactly when 03501 starts (Sep 12 17:00 UTC) and creation accepted it. That is live proof the same-day turnover comparator works — reinforcing the §8 finding in the Claude reply.

## What is correct on BK-03501

- Tenant carryover landed: `pickup_address` = "7328 E Butherus Dr, Scottsdale, AZ 85260", `mileage_limit` 250 with $1.50/mi overage, full 72-hour cancellation text snapshotted. BK-03493 (created before carryover) has none of these — expected.
- Fee snapshot is coherent: rental $2.00 + operator tax $0.02 = `total_value` 2.02; Exotiq leg = platform fee $0.20 + processing $0.52 + state fee $5.89 = $6.61, matching what 03493 actually charged.
- Identity: verified (reused from July), so it entered as `requested`, not `pending_documents`.
- No security deposit anywhere — the deposit exit is holding.

## Defects found (fix list)

1. **`gas_fee = 20` is written on marketplace bookings.** Present on both 03493 and 03501. The UI now ignores it, but the stored value is wrong and any future report that reads the column will re-invent the phantom $22. Marketplace bookings should store `gas_fee = 0`; backfill the existing marketplace rows.
2. **`payment_status` stays `'pending'` on a fully paid booking.** BK-03493 has `paid_at`, both intents, and two `completed` ledger rows, yet the booking's own `payment_status` never flipped. Payment views that key off this column will mislabel paid marketplace bookings. Set it to `'paid'` in the webhook when both legs clear, and backfill.
3. **`exotiq_charge_cents = 0` on BK-03493 despite a captured $6.61 Exotiq leg.** The snapshot column isn't written on success, so revenue reporting undercounts the platform leg. Write it in the webhook, backfill from the captured intents.
4. **Approval is not audited.** `user_activity_log` has the `marketplace_booking_created` row and nothing for approval, so there is no record of who approved or when beyond `updated_at`. Add a `marketplace_booking_approved` entry in `rent-approve-booking`.
5. **`mileage_limit` is null on BK-03493** — pre-carryover row, renter-facing mileage renders blank. Backfill open marketplace bookings that predate the carryover from vehicle/team defaults.
6. **`confirmed_at` is null on a confirmed booking.** Status went to `confirmed` at payment but the timestamp column wasn't set; set it alongside `paid_at`.

## Not defects (leaving alone)

- `subtotal`/`tax_amount` are 0 on marketplace rows — that pair is the operator-invoice path; marketplace money lives in the cents columns.
- `payment_stripe_mode` null on 03501 — only stamped at checkout, correct for an unpaid booking.
- `pickup_location` "Arranged with operator" on 03493 — pre-carryover default.

## Technical notes

Touches `supabase/functions/rent-payment-webhook` (items 2, 3, 6), `rent-approve-booking` (4), `create_marketplace_booking` (1, 5 — stop writing a gas fee, snapshot mileage), plus one data backfill pass over existing marketplace bookings. No renter-facing contract changes; all additive to what Claude already reads.
