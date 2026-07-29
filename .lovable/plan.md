# Booking dialog upgrades

## 1. Header cleanup — move Google Cal, dedupe Edit

Header (right of title) becomes: `[Cal icon] [Edit] [Status badge] [X]`.
- Replace the "Add to Google" text button in Quick Actions with a compact icon-only button (`CalendarPlus`, tooltip "Add to Google Calendar") sitting to the left of Edit.
- Remove the duplicate "Edit Booking" pill from Quick Actions. Header Edit already opens edit mode; the second button opened a separate `EditBookingDialog` — redundant.
- Keep "Change Vehicle" in Quick Actions.

## 2. Extend Booking

New action in Quick Actions: **Extend booking**. Only shown when booking is `confirmed` / `active` / `checked_out` and end_date is in the future or within 24h past pickup.

### UI flow (new `ExtendBookingDialog`)
1. Shows current end date + a date picker for new end date (must be after current end).
2. Recalculates: added days, per-day rate (pre-filled with original snapshot rate, **operator-editable**), added subtotal, added state fee (`589¢ × added_days`), added processing fee (`2% + Stripe 2.9%+30¢` on Exotiq leg), **balance due**.
3. Availability check: calls existing conflict helper — blocks if extension collides with another booking or an out-of-service window. Shows the conflicting booking ref.
4. Charge method picker:
   - **Marketplace booking with saved card** → "Charge card on file now" (default).
   - **Direct booking / no saved PM** → "Send payment link" (Stripe hosted invoice) OR "Mark as balance owed" (operator will record payment).
5. Confirm → runs the edge function, shows success/failure toast, refreshes booking.

### Backend — `rent-extend-booking` edge function
Single function, transactional:
1. Auth: JWT → team membership check on booking.team_id.
2. Validate: new_end_date > current end_date; not a marketplace-locked cancellation; availability re-check inside a transaction (SELECT ... FOR UPDATE on overlapping rows via `check_booking_conflict` RPC).
3. Compute deltas (added_days, added_subtotal_cents, added_state_fee_cents, added_processing_fee_cents, added_total_cents).
4. Charge path:
   - **Marketplace + saved PM present**: create off-session `PaymentIntent` on the connected account for `added_total_cents`, with `application_fee_amount` = added platform fee, `customer` + `payment_method` from original PI, `off_session: true`, `confirm: true`. On `requires_action` → return `requires_action` to the UI (operator sees "3DS needed; sending payment link") and fall through to hosted invoice.
   - **Direct or no PM**: create a Stripe Invoice (hosted) on the tenant's connected account, email link to renter, mark extension `pending_payment` in a new `booking_extensions` row.
   - **Manual**: skip Stripe, mark extension `balance_owed`.
5. On successful capture (or manual confirm): update `bookings.end_date`, bump `total_value`, `platform_fee_cents`, `state_fee_cents`, `processing_fee_cents`, append to `payments` (new row with `payment_type='extension'`), emit `booking_extended` notification to renter (new email template) + operator activity log entry.
6. Google Calendar sync: if `gcal_event_id` set, PATCH the event end time.

### New table: `booking_extensions`
Tracks each extension as an audit row so financial history stays reconstructible.
```
id, booking_id, extended_by_user_id, previous_end_date, new_end_date,
added_days, added_subtotal_cents, added_state_fee_cents,
added_processing_fee_cents, added_total_cents, rate_cents_per_day,
charge_method ('card_on_file' | 'payment_link' | 'manual'),
payment_intent_id, invoice_id, status ('paid' | 'pending' | 'failed' | 'manual'),
created_at
```
Full GRANTs + RLS scoped by `team_id` via booking join.

### Safety rails
- **Idempotency**: `Idempotency-Key` on the Stripe call = `booking_id + previous_end_date + new_end_date`. Prevents double-charge on retry.
- **Rollback**: if DB update fails after successful charge, refund the PI and surface the error.
- **Payment failure UX**: `card_declined` / `authentication_required` never mutates dates — operator sees the error and falls back to payment link.
- **Marketplace locked bookings**: extensions still allowed post-payment (dates aren't the locked field), but the extended leg is a separate PI so refund policy stays clean.
- **Availability race**: transaction-level lock prevents two operators extending into the same window.

## 3. Dialog width — my recommendation

**Widen to ~900px, keep as modal.** Reasoning:
- The card is genuinely dense (5 tabs + hero + actions + financial summary). 700px forces awkward wrapping on Payments and Activity tabs.
- 1100px + 2-column crosses into "page" territory — operators lose context of the list behind. Full page navigation is the wrong tradeoff for a quick-read card.
- 900px hits the sweet spot: tabs breathe, financial rows stop wrapping, still overlays the list. Verified against your 989px viewport → sits comfortably with sidebar collapsed.
- No need for A/B — the density complaint is real, and the fix is cheap and reversible. Ship it and iterate if we see friction.
- Also tighten header spacing and reduce hero padding by ~4px to reclaim vertical room.

Mobile stays full-screen inset (already handled).

## Testing

- **Unit**: `booking_extensions` computations (added_days, fee math), RLS on new table, availability conflict function returns the right blocker.
- **Edge function**: happy path (marketplace card charge succeeds), 3DS-required fallback to invoice, direct booking → invoice, availability collision → 409, unauthorized team member → 403, idempotency (same key returns cached result), Stripe decline → no date mutation.
- **E2E (Playwright)**: extend a confirmed marketplace booking end-to-end in sandbox, verify PI captured, `bookings.end_date` moved, `payments` row created, GCal PATCH called.
- **Regression**: existing tests for `EnhancedBookingDialog` still pass, calendar collision detection unchanged for non-extended flows.

## Files touched

- `src/components/dialogs/EnhancedBookingDialog.tsx` — header restructure, Quick Actions cleanup, width bump, add "Extend booking" button.
- `src/components/dialogs/ExtendBookingDialog.tsx` — **new**.
- `src/lib/pricing.ts` — export `computeExtensionDeltas()` helper for UI + edge to share math.
- `supabase/functions/rent-extend-booking/index.ts` — **new**.
- `supabase/functions/send-renter-email/templates.ts` — new `bookingExtended` template.
- `supabase/functions/gcal-sync/index.ts` — accept extension patches.
- `supabase/migrations/<ts>_booking_extensions.sql` — new table + RLS + GRANTs.
- Tests: `src/lib/__tests__/pricing.extend.test.ts`, `tests/e2e/booking-extend.spec.ts`.

## Open items requiring your input

- **Stripe verification**: for marketplace bookings, does the current Checkout session set `payment_intent_data.setup_future_usage: 'off_session'`? If not, first-time extensions won't have a saved PM and will always fall back to invoice. I'll check `rent-checkout` during build; if it doesn't, we'll add it (backward-compatible for new bookings only — pre-existing bookings will use the invoice path).
- **State fee for extensions**: assuming same `589¢/day` for now — flag if extensions should be tax-exempt in any jurisdiction.
