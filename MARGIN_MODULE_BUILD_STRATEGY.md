# Margin Module Build Strategy

## Codebase Assessment

After reviewing the brief and auditing the existing codebase, here is the current state:

| Area | Status |
|------|--------|
| **Tech Stack** | React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Framer Motion, Supabase (auth + DB + RLS), Tanstack Query |
| **Sidebar/Nav** | `DashboardSidebarEnhanced.tsx` — grouped nav with role-based filtering. Margin needs one line added to the "operations" group. |
| **Vehicles table** | Missing all ownership/partner fields (`ownership_type`, `partner_id`, `split_type`, `split_value`, `payout_method`, `acquisition_cost`, `monthly_payment`, `depreciation_method`) |
| **expense_records table** | Does not exist |
| **vehicle_partners table** | Does not exist |
| **partner_payouts table** | Does not exist |
| **Stripe integration** | Exists in `PaymentsSection`, `RecordPaymentDialog`, `IntegrationsSection` — reads from Stripe Connect data. Foundation is there. |
| **Existing financial data** | Bookings table has `total_price`, `deposit_amount`, `balance_due`, `payment_status`. Vehicles have a `revenue` field. No unified expense tracking. |
| **RLS policies** | Mature — team-based and role-based patterns already established. New tables follow the same pattern. |
| **Rari AI** | Deep integration with conversation history, insights, action items. Ready for Margin data queries in Phase 2. |

---

## Division of Labor: Loveable vs Claude Code

This is the critical strategic decision. Based on your setup (Loveable writes to DB and owns UI), here's the clean split:

### Loveable Owns (DB + UI)

1. **All Supabase migrations** — create tables, alter tables, RLS policies
2. **UI components** — the Margin dashboard pages, charts, heatmaps, expense entry forms
3. **Write hooks** — when Vault creates a claim, write to `expense_records`; when Pulse completes maintenance, write to `expense_records`
4. **Sidebar registration** — adding the Margin nav item

### Claude Code Owns (Logic + Architecture + Integration)

1. **This strategy document** — the build plan you're reading
2. **Stripe Connect revenue aggregation logic** — the query/hook layer that pulls and transforms Stripe data into per-vehicle, per-location P&L views
3. **Revenue split calculation engine** — the business logic for percentage vs flat-fee splits, platform fee deductions, partner share math
4. **Type definitions** — TypeScript types for all new tables/schemas
5. **Data validation** — ensuring expense records, partner payouts, and split calculations are mathematically correct
6. **Rari integration** (Phase 2) — connecting Margin data to Rari's query engine
7. **Code review** — reviewing Loveable's migrations and components for correctness

---

## Recommended Build Sequence (Phase 1)

### Sprint 0: Schema Foundation (Loveable, ~1-2 days)

**Goal:** Get all tables created so both Loveable and Claude Code can build against them.

| # | Task | Owner |
|---|------|-------|
| 0.1 | Create `expense_records` table with indexes on `org_id`, `vehicle_id`, `location_id`, `category`, `date` | Loveable |
| 0.2 | Create `vehicle_partners` table | Loveable |
| 0.3 | Create `partner_payouts` table | Loveable |
| 0.4 | ALTER `vehicles` to add: `ownership_type`, `partner_id`, `split_type`, `split_value`, `payout_method`, `acquisition_cost`, `monthly_payment`, `depreciation_method` | Loveable |
| 0.5 | RLS policies on all 3 new tables (follow existing team-based patterns) | Loveable |
| 0.6 | Add `premium_amount` and `billing_frequency` to insurance/policy records in Vault | Loveable |
| 0.7 | Confirm `cost` field exists on completed maintenance events in Pulse | Loveable |

### Sprint 1: Revenue Dashboard (Parallel work, ~1 week)

| # | Task | Owner |
|---|------|-------|
| 1.1 | Add "Margin" to sidebar nav in `DashboardSidebarEnhanced.tsx` under operations, after Pulse | Loveable |
| 1.2 | Create Margin page skeleton with tabs: Overview, Vehicles, Locations, Expenses | Loveable |
| 1.3 | Build Stripe Connect revenue aggregation hooks — query bookings + Stripe payment data, segment by direct vs Drive Exotiq, group by vehicle and location | Claude Code |
| 1.4 | Build real-time revenue dashboard cards: Collected / Pending / Total (MTD, QTD, YTD) | Loveable (UI) + Claude Code (data hooks) |
| 1.5 | Build per-vehicle P&L view component with revenue breakdown | Loveable (UI) + Claude Code (calculation logic) |
| 1.6 | Build per-location P&L aggregation | Loveable (UI) + Claude Code (data hooks) |
| 1.7 | Basic trending: month-over-month, quarter-over-quarter comparisons | Claude Code (logic) → Loveable (charts) |

### Sprint 2: Expense Tracking + Partner Splits (~1 week)

| # | Task | Owner |
|---|------|-------|
| 2.1 | Manual expense entry form (category, amount, vehicle/location tagging, recurring toggle) | Loveable |
| 2.2 | Write hooks: Vault claims → `expense_records` | Loveable |
| 2.3 | Write hooks: Vault insurance premiums → `expense_records` | Loveable |
| 2.4 | Write hooks: Pulse maintenance → `expense_records` | Loveable |
| 2.5 | Partner split calculation engine (percentage and flat-fee models) | Claude Code |
| 2.6 | Partner payout tracking (pending/paid/overdue status management) | Claude Code (logic) + Loveable (UI) |
| 2.7 | Manual payment recording via Stripe Connect out-of-band | Claude Code |
| 2.8 | Vehicle profitability heatmap component | Loveable |

### Sprint 3: Polish + Data Integrity (~3-5 days)

| # | Task | Owner |
|---|------|-------|
| 3.1 | Audit existing payment data — reconcile $583K collected vs $2.8M pending | Both |
| 3.2 | Flag and clean stale demo data (with Gregory approval) | Loveable |
| 3.3 | Cash flow Sankey diagram ("cash flow river") | Loveable |
| 3.4 | Rari insight card on Margin dashboard | Loveable (UI) + Claude Code (data query for Rari) |
| 3.5 | Location comparison cards for multi-location operators | Loveable |
| 3.6 | Mobile responsive pass on all Margin views | Loveable |
| 3.7 | End-to-end testing of full data flow: Booking → Stripe → Revenue aggregation → P&L | Both |

---

## Key Technical Decisions

### 1. Revenue Data: Stripe API vs Supabase Cache

The brief says "Stripe is the single source of truth." Practical recommendation:

- **Read from Stripe Connect API** for real-time accuracy
- **Cache aggregated results in Supabase** (a `revenue_snapshots` or similar table) for dashboard performance
- Cache refreshes on a schedule (every 15 min) and on-demand when operator opens Margin
- This avoids hammering the Stripe API on every page load while keeping data fresh

### 2. Expense Records: Write-Once Pattern

Each module writes to `expense_records` at the moment of creation. This is a **fire-and-forget insert**, not a sync. If a Vault claim estimate changes, a new `expense_record` is created (or the existing one updated via `source_record_id` lookup). This keeps the pattern simple.

### 3. Revenue Split Calculation

Splits should be calculated **at read time**, not stored. The split terms live on the vehicle record. When Margin calculates a per-vehicle P&L, it:
1. Reads the vehicle's `ownership_type`, `split_type`, `split_value`
2. For each booking: deducts platform fee if Drive Exotiq → applies split → shows operator share
3. This means changing split terms retroactively only affects future calculations (which is the correct business behavior)

Exception: `partner_payouts` records are created at payout time and are immutable — they lock in the amount that was actually paid.

### 4. Multi-Tenancy

The existing codebase uses `team_id` (via `is_my_team_member()` RLS function) for org-level data isolation. All new tables should follow this pattern. The brief calls the field `org_id` — this maps to the existing `team_id` concept.

---

## What Claude Code Should Build First

If you want me to start writing code now, the highest-value items I can deliver immediately are:

1. **TypeScript type definitions** for all new tables (`expense_records`, `vehicle_partners`, `partner_payouts`, vehicle ownership fields)
2. **Revenue aggregation hooks** — `useVehicleRevenue()`, `useLocationRevenue()`, `useRevenueDashboard()` — that query bookings + payment data and compute P&L
3. **Partner split calculation utilities** — pure functions that take booking revenue + vehicle split terms and return operator/partner shares
4. **Supabase migration SQL** — if you want me to write the migrations instead of Loveable, I can produce exact SQL for all Sprint 0 schema work

---

## Phases 2 & 3: Not Now, But Plan For

The schema design in the brief already accounts for Phase 2 (forecasting) and Phase 3 (AI CFO). No architectural changes will be needed later because:

- `expense_records` category ENUM includes Phase 3 categories (depreciation, loan_payment)
- Vehicle fields for `acquisition_cost`, `monthly_payment`, `depreciation_method` are nullable and Phase 3-only
- The `vehicle_partners` visibility settings JSONB is flexible enough for the future partner dashboard
- QuickBooks/Xero integration will map directly from `expense_records` categories

**Bottom line:** Build Phase 1 clean, and Phases 2 and 3 bolt on without refactoring.
