# Quote Fee Expansion + Renter Email OTP — Plan

## Part A — `public_vehicle_quote` fee expansion (RPC + snapshot + charge)

### A1. New column: `state_fee_cents`
- Formula: `589 * rental_days` (per day, hardcoded).
- Belongs in the **Exotiq leg**, added to `exotiq_total_cents` and `grand_total_cents`.
- **Not** added to `operator_total_cents`.
- Add `-- TODO: per-jurisdiction rate/label; breaks when a non-CA operator goes marketplace-visible` at the constant.

### A2. New column: `processing_fee_cents`
- **Decision: estimate once, no gross-up.** Simpler to explain on an invoice; cents-level difference isn't worth the complexity of iterative gross-up math on the RPC. Document this inline.
- Base = Exotiq leg pre-fee = `platform_fee_cents + protection_total_cents + state_fee_cents + round(0.02 * rental_subtotal_cents)`.
- Formula:
  ```
  take_2pct       = round(0.02 * rental_subtotal_cents)
  exotiq_pre_fee  = platform_fee_cents + protection_total_cents + state_fee_cents + take_2pct
  stripe_fee      = round(0.029 * exotiq_pre_fee) + 30
  processing_fee_cents = take_2pct + stripe_fee
  ```
- Added to `exotiq_total_cents` and `grand_total_cents`; **not** in `operator_total_cents`.
- Rental leg (M6-D2 destination-charge netting in `rent-checkout`) is **untouched** — operator continues to absorb their own Stripe fee.

### A3. Totals contract after change
```
exotiq_total_cents  = platform_fee + protection + state_fee + processing_fee
operator_total_cents = rental_subtotal   (unchanged, deposit already 0)
grand_total_cents   = exotiq_total + operator_total
```
Verification query (Bugatti Chiron, +30d/+33d, premium): `grand_total == rental + platform_fee + protection + state_fee + processing_fee`, and Exotiq PI amount will equal the last four.

### A4. Snapshot + charge propagation
- `bookings`: add `state_fee_cents` and `processing_fee_cents` (nullable int, default 0). Backfill existing rows to 0.
- `create_marketplace_booking` RPC + `rent-create-booking` edge fn: accept and persist the two new snapshot fields, alongside existing `platform_fee_cents`/`protection_total_cents`.
- `rent-checkout`: Exotiq-leg PI `amount` = `platform_fee + protection + state_fee + processing_fee` read from the **booking row**, not re-quoted. Shown == snapshot == charged.
- `receiptConfirmed` email + any renter-app totals: pick up the new fields via snapshot.

### A5. Repo split
- SPARK (this project): migration for column adds + `public_vehicle_quote` rewrite + `create_marketplace_booking` signature bump + `rent-create-booking` / `rent-checkout` edits.
- `exotiq-rent`: adapter needs `state_fee_cents` + `processing_fee_cents` surfaced in the price breakdown UI. Handoff doc to Claude after SPARK migration lands.

---

## Part B — Answers to (a)/(b)/(c) before frontend work

### (a) Booking ↔ auth user coupling
**Recommendation: keep `confirmation_token` as the access mechanism. Do not couple booking access to the session.**
- Token already works end-to-end (approve/receipt/verify links, `public_booking_by_ref` gate).
- Session-only access breaks the renter who clears cookies, switches devices, or opens the receipt email on their phone after booking on desktop.
- Do link `bookings.customer_id → customers.auth_user_id` opportunistically (write the FK when OTP succeeds), so a future "My bookings" list works without retrofitting. Access control stays token-based; the user_id is metadata.

### (b) Email already has an account
**Recommendation: silent OTP, no branching prompt.**
- Supabase `signInWithOtp({ email, shouldCreateUser: true })` handles both new and returning identically — user gets a 6-digit code either way.
- No "welcome back" vs "create account" fork in the UI; the step reads as "Verify your email" for everyone. Matches Gregory's "feels like verification, not signup" ask.
- On success, upsert `customers` by email (existing behavior) and stamp `auth_user_id` if unset.

### (c) `rent-create-booking` verify_jwt
**Recommendation: stays anonymous (`verify_jwt = false`).**
- OTP happens at driver step (step 3), *before* the create-booking POST. If we required a session, we'd need to plumb the just-minted JWT through the anon RPC path and gate creation on it — meaningful rewrite for no security gain, because the token model already prevents cross-booking access.
- Server-side, we can *optionally* read the Authorization header when present and stamp `bookings.created_by_user_id` — additive, non-gating. Same pattern `identity-create-session` already uses for the operator/guest split.
- Keeps the guest-fallback path (renter loses email mid-flow, retries) working without a login wall.

---

## Order of operations
1. Migration: add columns to `bookings`, rewrite `public_vehicle_quote`, bump `create_marketplace_booking` signature. Verify with Bugatti query.
2. Edge fns: `rent-create-booking` (snapshot new fields), `rent-checkout` (charge from snapshot).
3. Email template: surface `state_fee_cents` + `processing_fee_cents` in `receiptConfirmed`.
4. Handoff doc for `exotiq-rent` adapter + price-breakdown UI.
5. **Wait for your go on (a)/(b)/(c)** before touching any OTP frontend or Supabase Auth config.

## Open items I'd like your call on
- Confirm the estimate-once processing fee math (2.9% + $0.30 on the pre-fee Exotiq leg including the 2% take). Alternative: estimate on rental_subtotal only — simpler, but under-collects when protection/state_fee are large.
- Confirm `state_fee_cents = 589 * rental_days` uses **rental_days = ceil(hours/24)** (matches existing quote day-count), not calendar-date diff.
