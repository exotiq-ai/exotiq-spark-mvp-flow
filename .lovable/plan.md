# Margin Big Push — Phase 1 Completion

Backend foundations from the last pass are live (smart routing on `parse-expense-receipt`, recurring template table + `generate_recurring_expenses()`, `review_expense` RPC, Stripe fee logging in `stripe-webhook`, new columns on `vehicle_expenses`). This plan closes the remaining gaps so the loop actually works end-to-end.

---

## 1. Booking picker in Review tab approval
- `ReviewTab.tsx`: when a card has a `vehicle_id`, show a "Assign to rental" combobox filtered to bookings on that vehicle whose date range contains `expense_date` (±1 day buffer).
- Persist via extended `review_expense` RPC payload (`booking_id`).
- Show "Linked to rental BK-XXXXX" pill once assigned.

## 2. Booking detail "Costs" section
- New hook `useBookingExpenses(bookingId)` — selects approved + pending expenses where `booking_id = $1`, joined to vehicle name.
- New `BookingCostsSection.tsx` rendered inside `EnhancedBookingDialog` under the existing payment block: list rows (date, type badge, vendor, amount, source), running total, link "Open in Margin".
- Read-only for non-managers; manager+ can click row to deep-link to Margin with highlight.

## 3. Recurring expenses UI
- New "Recurring" sub-tab in `ExpensesTab` (segmented control at top: Expenses | Recurring).
- `RecurringTemplatesTab.tsx`: table of templates (name, vehicle, type, amount, cadence, next run, status), with Create / Edit / Pause / Delete.
- `RecurringTemplateDialog.tsx`: form (vehicle optional, type, amount, vendor, cadence monthly/quarterly/annual, day_of_month 1–28, start date).
- Surfaces the existing `recurring_expense_templates` table — no new schema.

## 4. Schedule the cron
- Insert (not migrate, since it carries URL + anon key) a `pg_cron` job that calls `generate_recurring_expenses()` daily at 03:00 UTC via `pg_net.http_post` to a new tiny edge function `generate-recurring-expenses` (just calls the SQL function and returns count).
- Idempotency already enforced by the SQL function.

## 5. Damage claim → expense trigger
- The previous migration touched `fn_log_damage_expense` but did not attach a trigger on `damage_claims` for `claim_status → resolved` with `actual_cost > 0`. Add the `AFTER UPDATE` trigger + idempotency on `source_ref->>'damage_claim_id'`.
- Update `reimbursed_amount` on linked expense when insurance payout fields change.

## 6. Toast deep-link + highlight
- On approve in Review tab, toast action "View" routes to `/dashboard/margin?tab=expenses&highlight=<id>`.
- `ExpensesTab` reads `?highlight` and applies a brief ring + scroll-into-view on that row.

## 7. E2E + unit tests (`tests/margin-bigpush.spec.ts`)
- 10 scenarios from the original plan (routing happy/flagged, admin gate, per-rental, maintenance auto-link, recurring, Stripe fees, damage claim, P&L math, realtime).
- Unit tests for the match cascade scoring and recurring `next_run_at` advancement (monthly across month-end edge, quarterly, annual leap-year).
- Add `data-testid` attributes where missing on Review cards, recurring template rows, and booking Costs section.

---

## Technical notes

- **Migration (single batch):** `damage_claims` AFTER UPDATE trigger + reimbursement sync trigger.
- **`supabase/insert`:** schedule the daily cron (carries anon key, so insert not migration).
- **New edge function:** `generate-recurring-expenses/index.ts` — thin wrapper calling the SQL function; `verify_jwt = false` via config block.
- **No changes to:** `vehicle_expenses` schema, `parse-expense-receipt`, `stripe-webhook`, `review_expense` (already extended last round — will verify it accepts `booking_id` and add if missing).
- **Feature flags:** gate Recurring sub-tab behind `featureFlags.marginRecurring` (default on in dev, off in prod until tests pass).

## Build order
1. Verify `review_expense` accepts `booking_id`; patch if not.
2. Migration: damage trigger.
3. Edge function `generate-recurring-expenses` + cron insert.
4. Frontend: booking picker, Recurring tab, BookingCostsSection, highlight param.
5. Playwright + unit tests; iterate until green.

## Out of scope (next project)
ROI/payback, Budgets, Tax export, Plaid, cash vs accrual, mileage/fuel auto-flow.

Ready to switch to build mode.