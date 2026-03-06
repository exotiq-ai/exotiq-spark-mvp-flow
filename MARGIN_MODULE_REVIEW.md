# Margin Module Brief v2 — Technical Review

**Reviewer:** Claude Code
**Date:** March 6, 2026
**Document Reviewed:** `Exotiq_Margin_Module_Brief_v2.docx.md`
**Codebase:** exotiq-spark-mvp-flow (Lovable/Supabase + React)

---

## What's Already in Place

1. **`vehicle_expenses` table exists** — The enterprise schema migration (`20260108_rari_enterprise_schema.sql`) created a `vehicle_expenses` table with categories: fuel, insurance, maintenance, cleaning, storage, registration, detailing, toll, parking, other. This partially overlaps with the plan's proposed `expense_records` table.

2. **`vehicle_profit_loss` SQL view exists** — A database view already calculates per-vehicle revenue vs. expenses and margin percentage. Head start on Phase 1.

3. **Stripe integration is live** — `stripe-get-balance`, `stripe-payment-history`, and checkout session edge functions are deployed. Revenue data is being pulled from Stripe.

4. **Revenue analytics exist** — `RevenueWidget` and `PaymentsSection` components show monthly revenue, MoM trends, top vehicles, and payment status breakdowns.

5. **Team-based RLS is mature** — Helper functions (`is_team_member`, `is_team_admin`, `is_super_admin`, etc.) and policies are well-established. New tables can follow this pattern.

6. **Navigation structure is ready** — The sidebar (`DashboardSidebar.tsx`) has the Operations group where Margin would slot in below Pulse.

---

## Critical Issues & Gaps

### 1. `expense_records` vs. `vehicle_expenses` — Schema Collision

The plan proposes a new `expense_records` table, but `vehicle_expenses` already exists with overlapping purpose.

| | Plan's `expense_records` | Existing `vehicle_expenses` |
|---|---|---|
| **Scope** | Org-wide, vehicle-optional | Vehicle-specific only |
| **Categories** | 12 types incl. `partner_payout`, `damage`, `depreciation`, `loan_payment` | 10 types, missing partner/damage/depreciation/loan |
| **Source tracking** | `source_module` + `source_record_id` | None |
| **Location** | `location_id` field | None |
| **Recurring** | `recurring` + `recurrence_interval` | `recurring` + `recurring_interval` |

**Recommendation:** Don't create a second expense table. Migrate `vehicle_expenses` → `expense_records` by adding missing columns (`location_id`, `source_module`, `source_record_id`, expanded category enum, make `vehicle_id` nullable for overhead). Avoids dual-table confusion.

### 2. Stripe Connect Split Payments — Not Implemented

The plan assumes Stripe Connect can auto-split payments to partner accounts. Current Stripe integration is **platform-only** — no connected account infrastructure. Implementing Stripe Connect splits (plan item #19) requires: partner onboarding flow, connected account creation, `transfer_data` or `destination` charges. Phase 2/3 concern but the plan presents it as if the plumbing exists.

### 3. No Multi-location Revenue Tracking

The plan calls for per-location P&L (item #2). While `locations` table and `location_id` on vehicles exist, **bookings have no `location_id` field**. Revenue is tied to vehicles, not locations. Need to either derive location from the vehicle's assigned location at booking time, or add `location_id` to bookings.

### 4. "Stripe as Single Source of Truth" vs. Reality

The plan states Margin should read revenue exclusively from Stripe Connect API. But:
- `RevenueWidget` calculates revenue from the **Supabase `bookings` table** (`SUM(total_value)`)
- `PaymentsSection` blends Stripe API data with local `payments` table data

The plan's "deprecate or treat as cache" question about the local payments table needs a definitive answer before Phase 1 development — it affects every query.

### 5. Drive Exotiq Marketplace Fee Tracking — No Booking Source Field

The plan distinguishes direct bookings from Drive Exotiq marketplace bookings (with 10% host fee). There is currently **no `booking_source` field** on the bookings table. Without it, marketplace fees can't be calculated and the "direct vs. marketplace revenue" breakdown can't be shown.

### 6. Vault and Pulse Write Hooks — Don't Exist Yet

The plan assumes Vault (claims, insurance) and Pulse (maintenance) will write to the expense table on certain events. Currently:
- **Vault claims** have no financial amount field and create no expense records
- **Insurance policies** are document-only with no `premium_amount` or `billing_frequency`
- **Pulse maintenance** events may not have cost fields populated

Acknowledged in the plan's "Current App Gaps" section, but represents real pre-work before Phase 1 delivers accurate data.

---

## Structural Observations

### Strengths

- **Phased gating is realistic.** Phase 1 has zero external integrations, Phase 2 adds MotorIQ/Rari, Phase 3 adds QBO/Xero. Each phase stands alone.
- **Pricing strategy is smart.** Bundling Phase 1-2 into existing tiers for retention, with Phase 3 as upsell, is the right call.
- **"Schema now, UI later" for partner dashboard** is exactly right. The data model is the hard part.
- **Partner split model is thorough.** Supporting both percentage and flat-fee splits with manual and Stripe auto-pay covers real-world scenarios.
- **UI vision** (heatmaps, Sankey diagrams, Rari insight cards) is distinctive and differentiates from generic accounting tools.

### Concerns

- **Numbered list is inconsistent.** Items 1-6 are Phase 1 deliverables, 7-10 Phase 2, 11-15 Phase 3, 16-19 partner splits, 20-24 UI elements, 25-34 action items. Continuous numbering across unrelated sections makes referencing difficult.
- **No mention of currency handling.** Plan assumes USD only. If Exotiq expands internationally (or already has non-USD operators), this becomes a problem. Worth an explicit "USD only for Phase 1" statement.
- **Phase 3 fields in Phase 1 schema.** `depreciation_method`, `acquisition_cost`, and `monthly_payment` on vehicles are listed as Phase 3 but included in the Phase 1 schema additions. Clarify whether these should be added now (schema) but left unused, or deferred entirely.
- **Plan references "Lovable" throughout** as the development tool/partner. The action items section should be reframed for the current development workflow.

---

## Recommended Pre-Phase 1 Checklist

1. **Decide:** migrate `vehicle_expenses` → `expense_records`, or create new table and deprecate old
2. **Add `booking_source`** field to bookings table (direct vs. marketplace)
3. **Add `location_id`** to bookings (or document the vehicle-derived approach)
4. **Resolve Stripe vs. Supabase** as revenue authority — pick one, document it
5. **Add `premium_amount` and `billing_frequency`** to insurance/policy records in Vault
6. **Add cost field** to Pulse maintenance events (if missing)
7. **Clean up remaining stale demo data** (coordinate with Gregory)

---

## Key File References

| Component | Path |
|-----------|------|
| Navigation/Sidebar | `src/components/dashboard/DashboardSidebar.tsx` |
| Rari AI Assistant | `src/components/rari/RariSidebar.tsx` |
| Payments UI | `src/components/dashboard/PaymentsSection.tsx` |
| Revenue Analytics | `src/components/dashboard/widgets/RevenueWidget.tsx` |
| Type Definitions | `src/integrations/supabase/types.ts` |
| Stripe Functions | `supabase/functions/stripe-*` |
| Core Schema | `supabase/migrations/20251030004312_*.sql` |
| Enterprise Schema | `supabase/migrations/20260108_rari_enterprise_schema.sql` |
| Teams Schema | `supabase/migrations/20260103040654_*.sql` |
