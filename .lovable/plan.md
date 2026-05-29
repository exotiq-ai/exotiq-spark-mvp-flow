
# Margin "Big Push" — Phase 1 (Items 1–5) + E2E Test

Ship items 1–5 in one coordinated push. ROI / Budgets / Tax Export / Plaid stay parked for a separate project.

---

## 1. Smart routing + per-rental booking_id + Review polish

**Schema** (`vehicle_expenses`):
- `booking_id uuid NULL` (+ index)
- `match_confidence numeric NULL` (0–1)
- `requires_admin_approval boolean NOT NULL DEFAULT false`
- `auto_routed_reason text NULL` — short tag: `low_confidence`, `no_vehicle_match`, `old_date`, `high_amount`, `ok`
- `source_ref jsonb` — for cross-module links (work_order_id, damage_claim_id, stripe_payment_intent_id)

**Edge function `parse-expense-receipt`** — extend with match cascade:
1. Plate/VIN exact match
2. Make+model fuzzy ("296" → Ferrari 296)
3. Active or recent work order on a vehicle within ±14 days of receipt date → suggest that vehicle
4. If matched vehicle has a booking covering receipt date → suggest booking_id
5. Set `match_confidence`, `auto_routed_reason`, `requires_admin_approval` per rules:
   - confidence < 0.85 → flag low_confidence
   - no vehicle → flag no_vehicle_match
   - date > 90 days → flag old_date
   - amount > $5,000 → require admin approval
   - amount > $25,000 OR date > 1 year → owner only

**RPC `review_expense`** — already exists; extend to:
- Block approve if `requires_admin_approval` and caller lacks role
- Accept edits (vehicle_id, booking_id, date, amount, type, notes) atomically with approve

**Review tab** (`ReviewTab.tsx`):
- Group cards by `auto_routed_reason` (Needs vehicle / Old date / Low confidence / Needs admin / Ready)
- Inline edit: vehicle picker, booking picker (filtered by vehicle + date), date, amount, type
- Receipt thumbnail inline (PDFs → first-page preview via existing storage URL)
- Bulk approve button when all visible cards are "Ready"
- Reject → confirmation, sets `status='rejected'`

**Booking detail** — new "Costs" section listing expenses where `booking_id = this`, with running total and link back to receipt.

**Toast** on approve → "Expense added — View" deep-links to `/dashboard/margin?tab=expenses&highlight=<id>`.

---

## 2. Maintenance → expense auto-link

When a work order transitions to `completed` with `actual_cost > 0` (DB trigger on `work_orders` or wherever maintenance lives — verify table name during build):
- Insert `vehicle_expenses` row: `status='pending_review'`, `expense_type='maintenance'`, `vehicle_id`, `vendor=service_provider`, `amount=actual_cost`, `expense_date=completed_at::date`, `source_module='maintenance'`, `source_ref={work_order_id}`, `auto_routed_reason='ok'`, `match_confidence=1.0`
- Skip if a row with the same `source_ref->>'work_order_id'` already exists (idempotent)
- Surface in Review tab as "From work order #XXX — confirm"

---

## 3. Recurring expenses

**New table `recurring_expense_templates`**:
- `id`, `team_id`, `vehicle_id NULL`, `location_id NULL`
- `name`, `expense_type`, `amount`, `vendor`, `notes`
- `cadence text` enum: `monthly | quarterly | annual`
- `day_of_month int` (1–28)
- `next_run_at date`, `last_run_at date NULL`
- `is_active boolean`, standard timestamps

**Edge function `generate-recurring-expenses`** (cron daily 03:00 UTC via `pg_cron` + `pg_net`):
- For every active template where `next_run_at <= today` and no expense exists with `source_ref->>'recurring_template_id'` = this template for current period:
  - Insert `pending_review` expense (high confidence, no admin flag)
  - Advance `next_run_at` by cadence

**UI**: New "Recurring" sub-tab in Expenses tab — list, create, pause, edit, delete templates.

---

## 4. Stripe processing fees

Extend `stripe-webhook` `payment_intent.succeeded` and `charge.succeeded` handlers:
- Read `balance_transaction.fee` (or expand the charge)
- Look up booking via existing `payment_intent_id` mapping
- Insert `vehicle_expenses`: `expense_type='processing_fee'`, `amount=fee`, `vehicle_id=booking.vehicle_id`, `booking_id=booking.id`, `expense_date=charge_date`, `vendor='Stripe'`, `source_module='stripe'`, `source_ref={payment_intent_id, charge_id}`, `status='confirmed'` (auto-approved — it's a known cost)
- Idempotent on `source_ref->>'charge_id'`

Add `processing_fee` to `EXPENSE_TYPES` enum/array used by parser + UI. Show in Expense Breakdown chart in its own color.

For refunds (`charge.refunded`): mirror entry as a negative-style reversal expense OR update the existing row's `reimbursed_amount`.

---

## 5. Damage claim → expense

When `damage_claims.claim_status` transitions to `resolved` with `actual_cost > 0` (DB trigger):
- Insert `vehicle_expenses`: `expense_type='damage'`, `amount=actual_cost`, `vehicle_id`, `booking_id` (from claim), `expense_date=resolved_date::date`, `notes=description`, `source_module='damage_claim'`, `source_ref={damage_claim_id}`, `is_reimbursable=true` if insurance_claim_number present, `reimbursed_amount=0` initially
- `status='confirmed'` (already human-reviewed in claims flow — no double-review)
- Idempotent on `source_ref->>'damage_claim_id'`

When claim later updated with insurance payout amount → bump `reimbursed_amount` on the linked expense.

---

## E2E Tests (run after build)

Use Playwright with existing `data-testid` patterns. Add testids where missing.

**Test plan** (`tests/margin-bigpush.spec.ts`):

1. **Smart routing happy path** — upload receipt with clear vendor + plate → AI parses → vehicle auto-matched → confidence > 0.85 → card shows "Ready" → approve → expense lands `confirmed` on correct vehicle.
2. **Smart routing flagged** — upload old-dated receipt → card shows "Old date" badge → edit date → approve → confirmed.
3. **Admin gate** — manager attempts approve of $10k expense → blocked with toast; owner can approve.
4. **Per-rental assignment** — approve expense with booking picker → booking detail "Costs" section shows row + total.
5. **Maintenance auto-link** — complete a work order with cost → Review tab shows pre-filled card → approve → P&L updated for that vehicle.
6. **Recurring** — create monthly template with `next_run_at=today` → invoke `generate-recurring-expenses` directly → pending_review row appears → run twice → no duplicate.
7. **Stripe fees** — simulate `payment_intent.succeeded` webhook with known fee → confirmed expense appears with `processing_fee` type on correct booking → re-fire same event → no duplicate.
8. **Damage claim** — resolve a claim with cost → confirmed damage expense appears on vehicle + booking.
9. **Per-vehicle P&L math** — verify Total Expenses on Margin Overview = sum of approved rows in range, including new types.
10. **Realtime** — second tab open on Review tab updates without refresh when new pending row inserts.

Also: targeted unit tests for the match cascade and recurring date math.

---

## Technical notes

- **Migrations** (single batch): new columns on `vehicle_expenses`, new index `idx_vehicle_expenses_booking_id`, new index on `(source_module, (source_ref->>'work_order_id'))`, `recurring_expense_templates` table + RLS + GRANTs, trigger fns for work_order + damage_claim, pg_cron schedule.
- **RLS**: recurring templates scoped to team_id with `is_team_member_of_record`; admins write, members read.
- **GRANTs**: `recurring_expense_templates` → SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`.
- **`useMarginData`**: add `processing_fee` to type-aware breakdown; no math change needed (still sums approved).
- **New hook**: `useBookingExpenses(bookingId)` for the Costs section.
- **Feature flag**: keep `featureFlags.margin` master; add `featureFlags.marginRecurring`, `marginAutoLinks`, `marginPerRental` for staged rollout.
- **Edge function deploys**: `parse-expense-receipt` (update), `generate-recurring-expenses` (new), `stripe-webhook` (update).
- **No schema changes to `bookings`, `damage_claims`, `maintenance_schedules`** — only triggers added.

## Out of scope (parked for next project)

- ROI / payback view (H)
- Budgets vs actual (I)
- Tax-ready export (J)
- Plaid bank feed (K)
- Cash vs accrual toggle (G)
- Mileage/fuel reconciliation auto-flow (D) — partially covered by inspection module already

---

## Build order in one session

1. Migration (schema + recurring table + triggers + grants + cron)
2. Edge fn updates: parse-expense-receipt match cascade, stripe-webhook fees, generate-recurring-expenses
3. Frontend: Review tab grouping + inline edit + booking picker, booking-detail Costs section, recurring sub-tab, toast deep-link
4. Playwright E2E + unit tests
5. Run tests, fix, repeat until green

Ready to switch to build mode and ship.
