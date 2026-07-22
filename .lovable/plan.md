
# M6 — Two-charge marketplace money flow + Exotiq hero image seeding

Answers locked from you today:
- **Total Exotiq take = 20% of rental subtotal** (10% renter-paid at checkout + 10% operator-paid post-settlement).
- **Protection (D5, $89/$289/day)** rides on the Exotiq charge, not the operator charge.
- **Charge timing:** Exotiq's charge (fee + protection) captured immediately. Operator's charge (rental + deposit) is a manual-capture hold, captured at pickup — matches your "hold-only launch" preference for the operator side.
- **Cancellation:** Exotiq's charge is **non-refundable**. Operator's uncaptured hold is voided.

The plan below builds the renter-facing side of M6 now (charges A + B). The operator-side 10% clawback is scoped as a follow-up because you flagged the mechanism still needs to be worked out with Stripe.

---

## Part 1 — M6 money flow

### The two charges

**Charge A — Exotiq platform account (captured immediately)**
- Amount = `10% of rental_subtotal + protection_total`
- Card: renter's card, Stripe customer on Exotiq's platform account
- Capture: immediate (`capture_method: automatic`)
- Statement descriptor: `EXOTIQ BOOKING`
- Non-refundable per your call. Recorded in `payments` with `payment_type = 'platform_fee'`.

**Charge B — Operator's Connect account (manual-capture hold)**
- Amount = `rental_subtotal + deposit`  (100% of rental, no Exotiq fee attached)
- Card: same renter card, Stripe customer on the operator's connected account (existing pattern)
- Capture: manual, up to 7 days, captured by operator at pickup from the ops UI (already built)
- Statement descriptor: operator's name (Stripe Connect default)
- No `application_fee_amount` — D1 rip-out from last week stays.

Both charges are attempted in one server-side sequence during the renter's checkout. If Charge A fails, we don't attempt B. If A succeeds but B fails (card decline, insufficient funds, hold rejected), we **immediately refund A** and return an error — the renter is never left with a fee-only charge for a booking that didn't happen. This is the only place Charge A gets refunded.

### Rental subtotal, defined once

`rental_subtotal_cents = daily_rate_cents × nights` — matches the existing `compute_rental_base` / `public_vehicle_quote` definition. No extras, no deposit, no tax. This stays the fee base everywhere: the DB quote, the new checkout function, the operator-side clawback later.

### New edge function: `rent-checkout` (M6 core)

Replaces the "publish rent-create-booking then also charge" split. Called by the renter UI after `rent-create-booking` returns a `booking_ref` in `pending_payment` status.

Request:
```json
{ "booking_ref": "BK-01234", "confirmation_token": "uuid", "payment_method_id": "pm_..." }
```

Server sequence (all inside a try/catch with compensating refund):
1. Load booking by ref + token, assert status `pending_payment` (or `requested` for identity-verified renters).
2. Recompute quote from DB — never trust totals the client sends.
3. Create/find Stripe customer on **Exotiq's platform account**, attach `pm_...`.
4. **Charge A:** `PaymentIntent.create` on platform account for `fee + protection`, `capture_method: automatic`, `confirm: true`, `off_session: false`. Metadata: `booking_ref`, `booking_id`, `team_id`, `type: 'platform_fee'`.
5. If A fails → return `{ error: 'card_declined' }`, booking stays in `pending_payment`.
6. Create/find Stripe customer on **operator's connected account**, attach the same `pm_...` (cloned via `PaymentMethod.create` with `payment_method: pm_x, customer: cus_y` on the connected account — standard Connect pattern).
7. **Charge B:** `PaymentIntent.create` on connected account for `rental_subtotal + deposit`, `capture_method: manual`, `confirm: true`.
8. If B fails → `Refund.create` on Charge A, return `{ error: 'operator_charge_failed' }`.
9. Write two `payments` rows (`platform_fee` + `security_deposit_and_rental_hold`), advance booking to `confirmed`, fire the existing operator notification.

### DB changes (one migration)

- `payments.payment_type` — allow new value `'platform_fee'` in the CHECK constraint.
- `bookings.exotiq_fee_cents`, `bookings.protection_total_cents` — snapshot at checkout for reconciliation. Existing `platform_fee_cents` snapshot on the operator side stays 0 until the clawback layer ships.
- Trigger: on booking cancellation via marketplace lifecycle, void the uncaptured operator PI (function call, not SQL), and do NOT refund `platform_fee` payment rows — non-refundable per your call.

### Ops UI (Command Center)

Small, additive:
- Booking payment tab: show two rows — "Exotiq booking fee (paid)" and "Rental + deposit hold (auth'd, capture at pickup)". Already have the components.
- Booking detail header: badge `Fee: paid · Hold: auth'd` so operator sees at a glance.
- No new screens.

### Renter UI contract (for Claude)

Document in `docs/rent/MARKETPLACE_TESTING_HANDOFF.md`:
- Two Stripe **publishable keys** are needed on the renter site: Exotiq's platform pk + one per operator connected account. For launch (Exotiq only), one platform pk + Exotiq's connected pk (same account, but Elements needs to be initialized against the connected account for Charge B step).
- Flow: `rent-create-booking` → Stripe Elements collects card → `rent-checkout` runs both charges server-side → redirect to confirmation page (existing `public_booking_by_ref` RPC).
- Renter sees **two line items** on card statement, matching D1 intent.

### Explicitly out of scope for M6 (tracked as follow-ups)

- **Operator-side 10% clawback.** You said "we'll work this out with Stripe later." Options I'd bring to that session: (a) enable `application_fee_amount` on Charge B once ready — simplest, splits at Stripe level, requires operator Connect terms update; (b) monthly `Transfer` from operator balance to platform via Stripe Billing invoice; (c) manual off-Stripe invoicing. Keeping `platform_fee_percent` on `teams` set to 10 so we can flip mechanism (a) on later without re-quoting.
- **Refund edge cases:** partial refunds, post-capture disputes, chargebacks. Operator's existing refund UI handles Charge B; Charge A stays non-refundable by policy.
- **Multi-operator support.** Everything is written to work for N operators (payment method cloning is per-connected-account), but the launch only tests Exotiq.

---

## Part 2 — Exotiq hero image seeding (30 vehicles)

Runs in parallel with M6 backend work; no dependency.

**The 30 vehicles** (all marketplace-visible, no `image_url`): DB12, DBS Superleggera, Valkyrie, Vantage, R8 V10 Plus, Flying Spur, Mulliner Batur, M8 Competition, Chiron Sport, 488 GTB, 812 Superfast, F8 Tributo, SF90 Stradale, Jesko, Aventador SVJ, Countach LPI 800-4, Revuelto, MC20, Quattroporte Trofeo, 720S Spider, 765LT, Artura, AMG GT R, AMG One, Maybach S680, Huayra, 911 Turbo S, Taycan Turbo S, Ghost, Wraith.

### Approach

- **Generator:** `imagegen` fast tier (30 images; premium is overkill for card thumbnails, ~10× the cost).
- **Locked prompt template** (consistency > creativity):
  > "Studio-lit editorial photograph of a {year} {make} {model} in {signature_color}, three-quarter front angle, low camera height, dark neutral seamless backdrop with subtle gradient, dramatic side lighting, showroom-clean paint with realistic reflections, no people, no text, no watermark, hyperreal automotive photography, 16:9"
- **Signature color map** (used when `vehicles.color` is null so we don't get beige defaults): Ferrari→Rosso Corsa red, Lamborghini→Giallo Orion yellow, Bugatti→two-tone French Racing Blue, Porsche→Guards red or GT silver by model, Rolls-Royce→Arctic White, AMG→Solarbeam yellow (One) / Selenite grey (GT R), Aston→Stirling green, McLaren→Papaya orange, Maserati→Blu Emozione, Bentley→British Racing Green, Pagani→carbon exposed + red, Koenigsegg→Candy Apple red, BMW→Frozen Blue, Audi→Ara Blue, Maybach→two-tone black-over-silver.
- **Dimensions:** 1600×900 (card aspect).
- **Storage:** upload each to `vehicle-photos/{team_id}/marketplace-hero/{vehicle_id}.jpg` (existing bucket, existing RLS, existing signed-URL layer via `rent-public-media`).
- **DB update:** set `vehicles.image_url` for each row to the storage path.

### Execution steps

1. **Preview batch of 3** — Bugatti Chiron Sport, Pagani Huayra, Lamborghini Revuelto. Ship these first so you can eyeball the style. If the look is off we tune the prompt once, not 30 times.
2. **Generate remaining 27** with the locked prompt.
3. Upload all 30 to storage, update `image_url` rows.
4. Spot-check 3 via `rent-public-media?team=exotiq&vehicle={slug}` — expect signed URLs and hero image.
5. `public_team_fleet` should now return all 54 marketplace vehicles with heroes (up from 24).
6. Renter UI can drop `_require_hero => true` for Exotiq; leave the arg available for other tenants.

### What you approve before I start

- **Preview batch first?** (my recommendation) or skip straight to all 30?
- **Editorial studio style** as described, or lifestyle/on-location (harder to keep consistent — I'd argue against)?

---

## Suggested order

**Morning:** M6 DB migration + `rent-checkout` edge function skeleton + preview batch of 3 hero images.
**Afternoon:** wire Charge A + Charge B end-to-end against Exotiq's live account with a $1 test booking, generate remaining 27 heroes.
**End of day:** update `MARKETPLACE_TESTING_HANDOFF.md` with the new `rent-checkout` contract so Claude can wire the renter Elements form tomorrow.

Approve and I'll switch to build mode.
