# Margin Module — Comprehensive v1 Plan

Already-shipped foundation (verified): `vehicle_expenses`, `vehicle_partners`, `partner_payouts`, `deposit_ledger`, `vehicles` ownership/split fields, `bookings.booking_source` / `platform_fee_*` snapshot fields, `teams.platform_fee_percent` (default 10), triggers `fn_snapshot_platform_fee` / `fn_generate_partner_payout` / `fn_void_partner_payout` / `fn_log_maintenance_expense`, view `vehicle_profit_loss`, and the `MarginEnhanced` page wired into Dashboard (Manager+ only) with tabs for Overview, Per-Vehicle P&L, Expenses, Partner Payouts, Deposits + Revenue-by-Source card.

Decisions locked: payouts trigger on booking completion (keep), overhead stays tenant-level only (never allocated), `booking_source = 'marketplace'` stays as the canonical Drive Exotiq value, UI label reads "Drive Exotiq".

Work split into three sequential phases; each phase ships independently and is regression-safe.

---

## Phase A — Operator Polish (no schema)

Goal: take the existing Margin page from "exists" to "used daily".

1. **Global filter bar** in `MarginEnhanced`
   - Date range picker (presets: This month, Last month, QTD, YTD, Custom). Replaces hard-coded MTD.
   - Location filter (multi-select, sourced from `locations`).
   - Vehicle filter (multi-select, scoped to selected locations).
   - Booking-source filter (Direct / Drive Exotiq / Turo / Getaround / Website / Referral / Other).
   - Filters pass through to all child components via a `MarginFiltersContext`.

2. **Overview cards rebuilt** (`MarginOverview`)
   - Replace the single revenue figure with a three-stat block:
     - Gross Booked (`SUM(bookings.total_value)` for filtered set, status ≠ cancelled)
     - Collected (`SUM(payments.amount)` joined to those bookings, excluding refunds)
     - Outstanding (Gross − Collected − Refunds)
   - Platform fees (`SUM(platform_fee_amount)`), Total expenses (vehicle-scoped, excludes overhead), Net profit, Margin %, Pending partner payouts.
   - Each card shows MoM delta where date range is a single month.

3. **Charts section**
   - Revenue vs Expenses trend (daily for ≤45d range, weekly otherwise) — line/area chart.
   - Revenue by Booking Source — horizontal bar with $ + %.
   - Expense breakdown by category — donut with legend totals.
   - Top 5 / Bottom 5 vehicles by margin % — twin compact tables.

4. **Per-Vehicle P&L improvements** (`VehiclePnLTable`)
   - Use the filter context; add Margin % column; sort by any column; row click drills into the existing Vehicle Command Center.
   - Negative margins render in destructive color.

5. **Tenant overhead section** (new, on Overview only)
   - Separate card showing total overhead (`vehicle_expenses` where `vehicle_id IS NULL`) in the date range, broken down by category. Explicit copy: "Not allocated to vehicles".

6. **Empty / loading / error states** tuned across all components per minimalist design principle.

---

## Phase B — Partner CRUD + Vehicle Ownership UI (no new tables)

Goal: let operators actually set up partners and split rules so the existing `fn_generate_partner_payout` trigger has data to act on.

1. **Partners settings page** at `/dashboard?module=margin&tab=partners` (new sub-tab inside Margin)
   - List partners with name, email, # vehicles, MTD payouts, status.
   - Create / edit dialog: name, email, phone, visibility level (defaults `payouts_only`), active toggle, notes.
   - Archive (soft delete via `is_active=false`) — never hard delete; payout history preserved.

2. **Vehicle ownership section** added to Vehicle Command Center → Details tab
   - Fields: ownership_type (Owned / Partner-managed / Leased), partner (select), split_type (Percentage / Flat fee/day), split_value, payout_method, acquisition_cost, monthly_payment.
   - Inline helper text: "Split value = operator's share %. Partner receives the remainder, calculated after platform fees."
   - Only editable by Owner/Admin (financial scope).

3. **Partner Payouts tab upgrades** (`PartnerPayoutsTab`)
   - Filter by partner / vehicle / status / date.
   - Bulk "Mark as paid" with payout_method + reference + paid_at.
   - Per-row drill: booking ref, gross base, platform fee, partner share math breakdown.
   - CSV export (extend `marginCsv`).

4. **RLS verification** — confirm `vehicle_partners` and `partner_payouts` policies are team-scoped (audit, fix if missing). No partner-facing UI yet — that stays out of v1.

---

## Phase C — Expense Automation Triggers (schema + triggers)

Goal: make Margin numbers trustworthy without manual entry.

Single migration adds two triggers, modeled on the existing `fn_log_maintenance_expense` (idempotent via `(source_module, source_record_id)` unique constraint, which is already in place).

1. **`fn_log_damage_expense`** on `damage_claims` AFTER INSERT/UPDATE
   - Fires when `actual_cost` or `estimated_cost` is set and claim is not voided.
   - Inserts/updates `vehicle_expenses` row: `expense_type='damage'`, `amount=COALESCE(actual_cost, estimated_cost)`, `booking_id` if claim is booking-linked, `source_module='vault'`, `source_record_id=claim.id`.
   - Net of `reimbursed_amount` reflected via the existing `is_reimbursable` / `reimbursed_amount` columns.

2. **`fn_log_insurance_expense`** on `documents` AFTER INSERT/UPDATE
   - Requires: add nullable `premium_amount NUMERIC` and `billing_frequency TEXT CHECK IN ('monthly','quarterly','annually')` to `documents` (only two new columns).
   - Fires when `type='insurance'` and `premium_amount IS NOT NULL`.
   - Writes one recurring expense row per policy with `recurring=true`, `recurring_interval=billing_frequency`, `expense_type='insurance'`, `source_module='vault'`, `source_record_id=document.id`. Idempotent.
   - Vault UI gets the two new optional fields on the insurance document form.

3. **Refunds** stay out of `vehicle_expenses` — they're deducted from Collected revenue in the Overview math (Phase A), per existing payment semantics.

4. **No allocation logic** — overhead expenses (vehicle_id NULL) continue to be excluded from `vehicle_profit_loss`; surfaced only in the tenant overhead card.

---

## Out of scope for v1

- Vehicle Partner Dashboard (separate `/partner` shell)
- Stripe Connect automated splits
- QuickBooks / Xero export
- Rari financial Q&A handlers (existing Rari handlers stay)
- Forecasting / what-if scenarios
- Currency beyond USD

---

## Migration / file map

**Phase A** — UI only:
- `src/components/dashboard/MarginEnhanced.tsx` (filter bar, context)
- `src/components/margin/MarginFiltersContext.tsx` (new)
- `src/components/margin/MarginOverview.tsx` (Gross/Collected/Outstanding split, deltas)
- `src/components/margin/RevenueExpenseTrendChart.tsx` (new)
- `src/components/margin/ExpenseBreakdownChart.tsx` (new)
- `src/components/margin/TopBottomMarginVehicles.tsx` (new)
- `src/components/margin/TenantOverheadCard.tsx` (new)
- `src/components/margin/VehiclePnLTable.tsx` (filters + margin %)

**Phase B** — UI + RLS audit:
- `src/components/margin/PartnersTab.tsx` (new)
- `src/components/margin/PartnerFormDialog.tsx` (new)
- `src/components/fleet/VehicleOwnershipSection.tsx` (new, mounted in Vehicle Command Center)
- `src/components/margin/PartnerPayoutsTab.tsx` (filters, bulk mark-paid, math drill, CSV)
- Migration: RLS hardening on `vehicle_partners` / `partner_payouts` if audit finds gaps.

**Phase C** — Schema + triggers:
- Migration: `documents.premium_amount`, `documents.billing_frequency`; create `fn_log_damage_expense` + trigger; create `fn_log_insurance_expense` + trigger; ensure unique index on `vehicle_expenses(source_module, source_record_id)` exists.
- `src/components/vault/InsuranceDocumentForm.tsx` (premium fields).

---

## Acceptance criteria (cumulative across A→B→C)

- Operator can filter Margin by date range, location, vehicle, and booking source.
- Overview shows Gross / Collected / Outstanding / Platform Fees / Expenses / Net / Margin % / Pending Payouts.
- Trend, revenue-by-source, expense-category, and top/bottom margin charts render with filters.
- Per-vehicle P&L is sortable, drillable, and excludes overhead.
- Operator can create partners, assign one to a vehicle with a split, and see payout rows generate when a partner-managed booking completes.
- Operator can bulk mark payouts paid and export CSV.
- Logging an insurance premium on a Vault document or a cost on a damage claim auto-creates an expense row (idempotent), and that row flows into Margin numbers.
- Existing Stripe, booking, payment, and Rari flows are unchanged. RLS verified for all Margin tables. TypeScript build passes.

Approve to start Phase A. I'll pause for review between phases.
