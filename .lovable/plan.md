# Margin Module — Plan v3 (Build-Ready)

Incorporating your answers. Locked decisions in **bold**, open items called out at the bottom.

---

## Locked Decisions

1. **Platform fee = 10% of rental base only.** Rental base = `daily_rate × billable_days` (or hourly equivalent for `rental_duration_type='hourly'`). **Excludes** `gas_fee`, `delivery_fee`, `mileage_overage_fee`, `security_deposit_amount`, and `discount_amount` (discount reduces operator's net, not the broker fee base — operator absorbs their own discounts).
2. **Backfill = 0.** All historical bookings get `platform_fee_percent_snapshot = 0`, `platform_fee_amount = 0`. No retroactive fees. Fees only apply to bookings created after Margin launch AND `booking_source IN ('drive_exotiq','marketplace')`.
3. **Deposits are NOT revenue.** Tracked separately. Withheld deposits go to **operator only** (never split with partner).
4. **Refunds/voids handled explicitly.** No double-counting. Status transitions reversible.
5. **Per-vehicle P&L = SQL function**, not a view (date-bounded, timezone-aware).
6. **Access = role gate only** (owner/admin/manager). No `view_financials` permission in v1.
7. **Cut from v1 schema:** `recurring`, `monthly_payment`, `depreciation_method`, `acquisition_cost`. Defer to Phase 3.
8. **Feature flag:** `featureFlags.margin = false` by default. Enable per-tenant for testing.
9. **Demo seeding:** `hello@exotiq.ai` gets seeded expenses, partners, and payouts so the module renders meaningful demo content.
10. **CSV export** for P&L tables (per-vehicle, per-location, payouts).

---

## Phase 1 Scope (Data Foundation + Operator MVP)

### Schema Changes

**`bookings` — add columns:**
- `platform_fee_percent_snapshot NUMERIC(5,2) DEFAULT 0`
- `platform_fee_amount NUMERIC(10,2) DEFAULT 0`
- `platform_fee_base NUMERIC(10,2) DEFAULT 0` (the rental base used for the calc — auditability)

**Trigger `fn_snapshot_platform_fee`** (BEFORE INSERT/UPDATE on bookings):
```
IF NEW.booking_source IN ('drive_exotiq','marketplace') THEN
  NEW.platform_fee_base := compute_rental_base(NEW); -- daily_rate * days or hourly equiv
  NEW.platform_fee_percent_snapshot := COALESCE(teams.platform_fee_percent, 10);
  NEW.platform_fee_amount := ROUND(base * pct / 100, 2);
ELSE
  NEW.platform_fee_amount := 0;
END IF;
```
Snapshot is frozen once `status='completed'` to prevent retroactive drift if tenant changes their fee %.

**`vehicle_expenses` (NEW):**
- `id, team_id, vehicle_id (nullable), booking_id (nullable), location_id (nullable)`
- `expense_type` (fuel, insurance, maintenance, cleaning, damage, partner_payout, transport, tax, overhead, other)
- `amount, currency, expense_date, vendor, notes, receipt_url`
- `source_module` (margin_manual, vault, pulse, bookings, motoriq), `source_record_id`
- Unique `(source_module, source_record_id)` for idempotent trigger inserts
- RLS: team-scoped, manager+ to write, owner/admin/manager to read

**`vehicle_partners` (NEW):**
- `id, team_id, name, email, phone, payout_method, stripe_connect_account_id, notes`

**`partner_payouts` (NEW):**
- `id, team_id, booking_id, vehicle_id, partner_id`
- `gross_rental_base, platform_fee_amount, operator_adjustments, deposit_withholdings, net_to_partner`
- `split_type` (percentage, flat), `split_value_snapshot`
- `status` (pending, scheduled, paid, voided)
- `created_at, paid_at, voided_at, void_reason`

**`vehicles` — add minimal ownership fields:**
- `ownership_type` (owned, partnered) DEFAULT 'owned'
- `partner_id` (nullable FK)
- `split_type` (percentage, flat), `split_value` (operator's share)

### Critical Math — Partner Payout

Computed at booking completion, written to `partner_payouts`:

```
rental_base        = daily_rate * billable_days (or hourly equiv)
platform_fee       = bookings.platform_fee_amount (snapshot)
net_after_fee      = rental_base - platform_fee
operator_share     = net_after_fee * (1 - split_value)   [if percentage]
partner_share      = net_after_fee * split_value
gas/delivery/mileage → 100% to operator (pass-through, not split)
deposits           → tracked separately, never in payout calc
withheld_deposits  → 100% to operator (covers damages/overages)
```

### Triggers (Idempotent)

| Trigger | Fires | Action |
|---|---|---|
| `fn_snapshot_platform_fee` | BEFORE INS/UPD on bookings | Freezes fee snapshot |
| `fn_generate_partner_payout` | AFTER UPD on bookings (status→completed, vehicle has partner) | Insert pending payout row |
| `fn_void_partner_payout` | AFTER UPD on bookings (completed→cancelled) | Mark payout `voided`, never delete |
| `fn_recalc_partner_payout` | AFTER UPD on bookings (total_value changes while completed) | Update payout if status='pending', flag if 'paid' |
| `fn_log_damage_expense` | AFTER INS/UPD on damage_claims | Upsert into vehicle_expenses (idempotent by source_record_id) |
| `fn_log_maintenance_expense` | AFTER UPD on maintenance_schedules (status='completed') | Upsert expense |

### Deposit Handling (Explicit)

- `security_deposit_amount` is **never** added to gross revenue.
- A new view `deposit_ledger` shows: collected → held → released-to-customer OR withheld-to-operator-as-expense-offset.
- When a deposit is withheld for damages: create a `vehicle_expenses` row with `expense_type='damage'` AND a corresponding negative-cost offset (or a `deposit_recoveries` line) so the damage net cost reflects what the operator actually ate.
- **Deposit returns to customer reduce neither revenue nor operator margin.**

### Refund Handling (Explicit)

- `payments.refund_amount` reduces **collected revenue only** (in `booking_payment_summary`).
- Gross booked revenue stays at `bookings.total_value`.
- If a booking is fully refunded → status moves to `cancelled` → payout voided via trigger.

### Per-Vehicle P&L — SQL Function

```
fn_vehicle_pnl(p_team_id uuid, p_start date, p_end date, p_tz text)
RETURNS TABLE(vehicle_id, gross_revenue, platform_fees, net_revenue,
              total_expenses, partner_payouts, operator_net, margin_pct)
```
Timezone conversion uses `teams.timezone` so monthly buckets line up with operator local time.

### Views (Date-Agnostic Only)

- `booking_payment_summary` — collected vs outstanding vs refunded per booking
- `revenue_by_source` — direct vs drive_exotiq vs OTA breakdown
- `deposit_ledger` — deposit lifecycle

All `security_invoker = true` (PG15+ confirmed available).

---

## UI (behind `featureFlags.margin`)

New route `/margin` with tabs:
- **Overview** — KPI cards: Gross, Platform Fees, Net Revenue, Total Expenses, Operator Net, Margin %
- **Per-Vehicle P&L** — sortable table, CSV export
- **Per-Location P&L** — grouped table, CSV export
- **Expenses** — list + AddExpenseDialog (manual entry, receipt upload to `expense-receipts` bucket)
- **Partner Payouts** — list, status filters, mark-as-paid action, CSV export
- **Deposits** — ledger view

Sidebar gating: visible only to owner/admin/manager AND `featureFlags.margin` enabled.

---

## Demo Account Seeding (`hello@exotiq.ai`)

One-time seed script populates:
- 3 partnered vehicles with realistic splits (70/30, 80/20, flat $200/day)
- ~20 expense rows across categories
- ~10 completed bookings with payouts in mixed statuses
- A withheld deposit example showing damage offset

Runs only if `teams.is_demo_account = true` AND no margin data exists yet.

---

## Migration Order

1. Create `vehicle_expenses`, `vehicle_partners`, `partner_payouts` + RLS
2. Add columns to `bookings` and `vehicles`
3. Create `compute_rental_base()` helper + `fn_snapshot_platform_fee` trigger
4. Create payout triggers (generate, void, recalc)
5. Create expense logging triggers (damage, maintenance)
6. Create views + `fn_vehicle_pnl`
7. Backfill snapshots to 0 for existing bookings
8. Seed demo account

---

## File Touch Map

- `supabase/migrations/` — 7 sequential migrations
- `src/lib/featureFlags.ts` — add `margin: false`
- `src/pages/Margin.tsx` — new route
- `src/components/margin/` — MarginOverview, VehiclePnLTable, LocationPnLTable, ExpensesTab, PartnerPayoutsTab, DepositLedgerTab, AddExpenseDialog, MarkPaidDialog
- `src/components/dashboard/DashboardSidebarEnhanced.tsx` — nav entry (role + flag gated)
- `src/lib/marginCsv.ts` — CSV export helpers
- `scripts/seed_demo_margin.sql` — demo seeding

---

## Open Items / Improvements to Flag

- **(8) PG15+ — not an issue.** Lovable Cloud is on PG15+, `security_invoker` views work. Mentioned for completeness only.
- **Renter-side booking app plan** — yes, I'd like to see it before we wire `booking_source='marketplace'` so the fee snapshot path matches what your checkout will actually send.
- **Multi-currency** — explicitly USD-only in v1; `currency` column exists for future, defaulted to 'USD'.
- **Stripe Connect for partner payouts** — schema has `stripe_connect_account_id` but actual payout execution is Phase 2. v1 = manual "mark as paid" with audit trail.
- **Overhead expenses** (vehicle_id NULL) — included in tenant/location P&L, **excluded** from per-vehicle margin to avoid arbitrary allocation. Documented in tooltip.

Approve and I'll start with migration 1, or push back on anything above.
