## Extension follow-ups v2 — incorporating Claude's six refinements

Sequencing unchanged: refunds first, then protection, then renter-visible quote. All six pieces of Claude's feedback accepted with notes.

---

### 1. Refund/cancel walks extension rows (highest priority)

Both `rent-refund-booking` and `rent-cancel-booking` currently ignore `booking_extensions`. Extension PIs are stranded on renters' cards.

**Implementation**
- **Row-lock first (Claude #6):** `SELECT ... FROM bookings WHERE id = ? FOR UPDATE` at the top of both functions, then re-read status inside the lock. Any extension that started charging holds a row lock on the parent booking (added in step 2 below), so cancel/refund cannot race past a mid-flight extension.
- Walk `booking_extensions WHERE booking_id = ? AND status IN ('completed','partially_paid')` and call the existing `refundLeg()` helper for each row's `operator_payment_intent_id` (`reverse_transfer: true`) and `exotiq_payment_intent_id` (plain). Idempotency keys `cancel-ext-{op|exotiq}-{ext_id}` / `op-refund-ext-{op|exotiq}-{ext_id}`.
- After refunds succeed, `UPDATE booking_extensions SET status = 'refunded'` on those rows.
- Refund email `TOTAL_REFUNDED` sums base + extensions.

**Forfeit branch — component-by-component (Claude #5)**
Don't treat the extension as an atomic forfeit. Mirror the base booking's rule:
- Trip fees + protection portion of each extension: **non-refundable** (Exotiq leg forfeit).
- Operator-rental portion of each extension: **refund per operator policy** — for now, same rule as the base booking's operator rental in the <72h window (currently: not refunded). Split by leg using the two PIs already on the row.
- Structurally: in the forfeit branch, refund only the operator leg PI when the operator's policy would refund the base rental; skip the Exotiq leg PI.
- Flag for Gregory in the handoff: confirm operator-rental late-cancel policy. Right now the code path is "no refund" for base, so this parity means "no refund" for extensions too — matches current behaviour, doesn't overreach.

---

### 2. Protection charged on extensions

**Rate source — read the tier, don't derive (Claude #1)**
Do NOT divide `protection_total_cents / days`. On second extension the numerator has already been bumped, so the derived rate is wrong and silently overcharges.

Instead: `bookings.protection_tier` is the source of truth. `public_vehicle_quote` already returns `protection_daily_cents` keyed by tier from a server-side lookup. Reuse that same lookup (extract into a shared helper or re-call the RPC with the booking's tier + vehicle). `addedProtectionCents = protectionDailyCents × addedDays`.

**Schema (single migration with #3)**
```sql
ALTER TABLE booking_extensions
  ADD COLUMN added_protection_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN channel text; -- 'phone' | 'in_person' | 'email' (consent trail)
```

**Charge math ordering**
1. Compute `addedProtectionCents` from tier.
2. Add it into the Exotiq leg subtotal alongside platform fee + state fee.
3. **Recompute** `addedProcessingFeeCents` (2.9% + $0.30) on the new Exotiq leg total.
4. Row-lock the booking (`FOR UPDATE`), re-check availability, then charge two legs in the existing order.

**Snapshot bump after both legs settle**
- `bookings.protection_total_cents += addedProtectionCents`
- `bookings.total_value += addedRentalSubtotal` (Claude #4 — confirmed, needs to bump; renter confirmation header and CC revenue both read `total_value`)
- `bookings.state_fee_cents`, `bookings.processing_fee_cents`, `bookings.platform_fee_cents` all bump as already planned
- `bookings.end_date` bumps
- Persist `added_protection_cents` on the extension row; include in `added_total_cents`

**Overlap guard — marketplace AND non-marketplace (Claude #3)**
The exclusion constraint `bookings_no_marketplace_overlap` only fires for `booking_source = 'marketplace'`. An extension whose new `end_date` collides with the operator's own direct booking would slip past it.

- For marketplace collisions: rely on the constraint → 23P01 → 409 (as planned).
- For non-marketplace collisions: the availability re-check IS the only guard, so it must run inside the row lock. Use `SELECT ... FROM bookings WHERE vehicle_id = ? AND id != ? AND tstzrange(start_date, end_date, '[)') && tstzrange(?, ?, '[)') AND status IN (...) FOR UPDATE` before the UPDATE. Same transaction as the extension write.

**UI (`ExtendBookingDialog.tsx`)**
Add "Protection (+Nd)" line in the Exotiq breakdown so the operator sees what's being charged before confirming.

---

### 3. `public_booking_by_ref` returns `state_fee_cents` + `processing_fee_cents`

Renter `PaymentCard` currently sums only `platform_fee_cents + protection_total_cents`, under-quoting by $34.70 on BK-03459. Gap grows with every extension.

**Migration — single transaction (Claude #2)**
```sql
BEGIN;
  DROP FUNCTION public.public_booking_by_ref(text, uuid);
  CREATE FUNCTION public.public_booking_by_ref(...)
    RETURNS TABLE (... existing cols ..., state_fee_cents bigint, processing_fee_cents bigint)
    ...;
  GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon, authenticated;
COMMIT;
```
Wrapping in `BEGIN/COMMIT` closes the window where a renter opening `/booking/:ref` mid-migration would hit "function does not exist". Additive columns are safe because the renter app reads by name.

Renter-app change (outside this repo): flag `PaymentCard` to include the two new fields in its total.

---

### 4. Renter-facing extension email — consent trail

New template `bookingExtended` + `sendRenterEmail` call at the end of `rent-extend-booking` after both legs settle. Contents: added days, new end date, itemized charge (operator rental / Exotiq fees / protection), total. Idempotency key `extension-{ext_id}`. This doubles as the written record of the phone-authorized extension.

Also persist `channel` on `booking_extensions` (default `'phone'`) and continue recording `extended_by_user_id`.

---

### 5. Deliberately unchanged

- **Refund-on-failure for extensions:** atomic rollback stays (differs from base booking's park-and-retry). Deliberate, per Claude's agreement.
- **Partial cancel (drop extension, keep base):** out of scope.

---

### 6. Pre-live-flip flag for Gregory (not in this plan)

- **Arizona state-fee rate:** only marketplace-visible tenant is AZ; 589¢/day was sourced from Colorado. Confirm real AZ vehicle-rental surcharge before any real renter books. Fix constant or ship per-location `state_fee_cents_per_day` project first.
- **B1 Stripe dashboard check:** is the legacy `stripe-webhook` endpoint subscribed to `checkout.session.completed` / `payment_intent.succeeded`? One dashboard look settles the dedupe race.
- **Operator-rental late-cancel policy:** confirm the component-by-component forfeit rule in §1 matches Gregory's intent.

---

### File list

- **New migration:** `booking_extensions.added_protection_cents` + `channel`; `public_booking_by_ref` recreate inside `BEGIN/COMMIT` with two new fee columns.
- `supabase/functions/rent-extend-booking/index.ts` — tier-based protection rate lookup, processing-fee recompute after protection, `total_value` bump, `FOR UPDATE` lock + non-marketplace overlap re-check inside the lock, renter email at the end, persist `channel`.
- `supabase/functions/rent-refund-booking/index.ts` — row-lock + status re-read + walk extension rows.
- `supabase/functions/rent-cancel-booking/index.ts` — same lock/walk; forfeit branch splits by leg per the operator-rental policy.
- `supabase/functions/_shared/rentEmail.ts` + templates — `bookingExtended` template + type entry.
- `src/components/dialogs/ExtendBookingDialog.tsx` — "Protection (+Nd)" line in Exotiq breakdown.

### Execution order

1. Refund/cancel walk extensions (with row lock) — stops the money leak on anything already extended.
2. Protection column + tier-based charge + snapshot bump (incl. `total_value`) + non-marketplace overlap re-check inside lock + UI line + renter email.
3. `public_booking_by_ref` recreate inside a single transaction.
