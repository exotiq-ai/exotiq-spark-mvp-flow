## Phase B — Partner CRUD + Vehicle Ownership UI

Operator-facing surfaces so partners and ownership splits are managed without SQL. No new tables; uses existing `vehicle_partners`, `partner_payouts`, and `vehicles.owner_partner_id` / `owner_split_percent`. Existing `fn_generate_partner_payout` trigger (fires on booking completion) stays unchanged.

### 1. Partners tab (new)
- Add `partners` tab to `MarginEnhanced.tsx` → route `/dashboard?module=margin&tab=partners`.
- `PartnersTab.tsx`: table of partners (name, contact, default split %, payout method, active vehicle count, lifetime paid, outstanding pending).
- `PartnerDialog.tsx`: create/edit (name, email, phone, default_split_percent, payout_method, notes, is_active).
- Row actions: edit, deactivate, "View payouts" (jumps to Payouts tab pre-filtered to that partner).
- Manager+ only (RBAC gate consistent with rest of Margin).

### 2. Vehicle ownership UI
- `VehicleOwnershipSection.tsx` mounted inside Vehicle Command Center (Financial tab).
- Fields: `owner_partner_id` (select active partners, default "Owned by tenant"), `owner_split_percent` (0–100, prefilled from partner default).
- Saves to `vehicles`; future completed bookings auto-generate payouts via existing trigger. Historical payouts untouched.
- Read-only ownership badge on vehicle cards/list when partner-owned.

### 3. Partner Payouts tab upgrade
Enhance `PartnerPayoutsTab.tsx`:
- Summary cards: Pending total, Paid MTD, Paid YTD.
- Filters: partner, status (pending/paid/void), date range (uses `MarginFiltersContext` where overlap).
- Bulk select + "Mark as paid" (capture payout_date + reference).
- Expandable row drill: source booking, gross, fees, split %, computed payout math.
- CSV export of filtered set.

### 4. Margin overview hook-in
- Add "Partner Obligations" mini-card on `MarginOverview` (pending payout total) linking to Payouts tab.
- Verify Operator Net still correctly subtracts pending payouts.

### Files

Created:
- `src/components/margin/PartnersTab.tsx`
- `src/components/margin/PartnerDialog.tsx`
- `src/components/vehicles/VehicleOwnershipSection.tsx`
- `src/hooks/usePartners.ts` (react-query CRUD)

Edited:
- `src/components/dashboard/MarginEnhanced.tsx` (Partners tab)
- `src/components/margin/PartnerPayoutsTab.tsx` (filters, bulk, drill, CSV, summary)
- `src/components/margin/MarginOverview.tsx` (Partner Obligations card)
- Vehicle Command Center container (mount ownership section)

### Out of scope (Phase C)
- Damage/insurance expense automation triggers
- New `documents` columns
- Partner-facing external portal

### Safety
- No schema changes.
- All mutations team-scoped via existing RLS; audit `vehicle_partners` policies before shipping.
- Ownership edits never rewrite historical `partner_payouts`.
- Feature stays behind existing Margin module gating.
