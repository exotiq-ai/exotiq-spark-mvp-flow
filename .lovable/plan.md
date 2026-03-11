

# Fleet Management UI Truth Audit — Final Plan

## Summary

6 files modified, 0 new files, 0 migrations. All changes are UI/logic corrections — no schema changes needed.

## One Addition to Previous Plan

**FleetStatusWidget is worse than the donut.** Line 26 calculates utilization from `statusCounts["rented"]` — which is always 0 (no vehicle ever has `status = 'rented'`). Lines 31-34 also count "Rented", "Reserved", and "Unavailable" — all phantom statuses. This widget shows 0% utilization and zeros for 3 of 5 rows. It needs the same booking-aware logic the donut already has, plus retired handling.

The previous plan is solid. No cuts needed.

---

## Build Order

### 1. `src/hooks/useVehicleOpsStatus.ts`
- Add `not_set` entry to `OPS_STATUS_CONFIG` — neutral gray, label "Not Set", no next states
- `getStatusConfig` returns `not_set` config when status is null instead of `clean_ready`

### 2. `src/components/fleet/FleetFilters.tsx`
- Replace `BOOKING_STATUS_OPTIONS` with: `available`, `booked`, `maintenance`, `retired`
- Add `hideRetired: boolean` to `FleetFiltersState` (default `true`)
- Add toggle in filter popover: "Show retired vehicles"

### 3. `src/components/fleet/FleetVehicleCard.tsx`
- **Status badge truth:** Replace phantom `isRented` logic. Derive from: `vehicle.status` for DB state (`available`/`booked`/`maintenance`/`retired`), show "With Renter" only when `ops_status === 'renter_has'`
- **Retired treatment:** When `status === 'retired'`: add `opacity-50 grayscale` to card, show gray "Retired" badge, hide pricing block, hide ops status badge, hide ops quick actions, limit dropdown to Edit + Delete only
- **Null ops_status:** Use `not_set` config instead of false `clean_ready` default
- **AI suggestion:** Replace raw "AI: $X" text with small sparkle icon (Sparkles from lucide). Tooltip: "Rari has a pricing suggestion". Clicking opens QuickPriceEditor. Only show when `suggested_rate` exists and differs from `current_rate`
- **Wrench icon:** Change to `Clock` icon for `last_ops_update` timestamp

### 4. `src/components/fleet/FleetPageEnhanced.tsx`
- Apply `hideRetired` filter: when true, exclude `status === 'retired'` from `filteredVehicles`
- Fix ops_status filter default: use `not_set` instead of `clean_ready` for null values

### 5. `src/components/charts/FleetStatusDonut.tsx`
- Filter out `retired` vehicles before calculating segments
- Available = total - booked - maintenance (retired already excluded)

### 6. `src/components/dashboard/widgets/FleetStatusWidget.tsx`
- Replace phantom status list with booking-aware calculation (same logic as donut: use active bookings to derive "booked" count)
- Filter out retired from total and utilization denominator
- Status items: Available, Booked (from bookings), Maintenance, Retired (shown separately as info, not in utilization %)

