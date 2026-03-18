
# Fleet Management UI Truth Audit

## Status: ✅ Implemented

## What Was Changed

### 1. Ops Status: Neutral Default ✅
- **File:** `src/hooks/useVehicleOpsStatus.ts`
- Added `not_set` ops status with neutral gray styling (`CircleDashed` icon, "Not Set" label)
- `getStatusConfig()` now returns `not_set` instead of `clean_ready` for null/unknown values
- No more false "Clean & Ready" badges on vehicles that haven't been inspected

### 2. Fleet Filters: Truth-Based Status Options ✅
- **File:** `src/components/fleet/FleetFilters.tsx`
- Replaced phantom "Rented" and "Unavailable" with real DB values: `available`, `booked`, `maintenance`, `retired`
- Added `hideRetired` boolean to `FleetFiltersState` (default: `true`)
- Added "Show retired vehicles" toggle in filter popover
- Ops status filter now uses `not_set` instead of `clean_ready` for null values

### 3. Fleet Vehicle Card: Truth-Based Display ✅
- **File:** `src/components/fleet/FleetVehicleCard.tsx`
- **Status badge truth:** Derives display from real DB status + ops_status:
  - "With Renter" when `ops_status === 'renter_has'`
  - "Booked" when there's an active booking
  - "Maintenance", "Available", "Retired" from DB status
  - Removed phantom "Rented" label
- **Retired treatment:** `opacity-50 grayscale` on card, gray "Retired" badge, hides pricing/ops badge/ops actions/photo count, dropdown limited to Edit + View + Delete
- **Null ops_status:** Shows neutral "Not Set" badge instead of false "Clean & Ready"
- **AI suggestion:** Replaced raw "AI: $X" text with small `Sparkles` icon with tooltip "Rari has a pricing suggestion", clicking opens QuickPriceEditor. Shows when `suggested_rate` differs from `current_rate`
- **Wrench → Clock:** Changed `last_ops_update` icon from `Wrench` to `Clock`

### 4. Fleet Page: Retired Filtering ✅
- **File:** `src/components/fleet/FleetPageEnhanced.tsx`
- Applies `hideRetired` filter: retired vehicles excluded by default
- Ops status filter uses `not_set` for null values

### 5. Fleet Status Donut: Retired Exclusion ✅
- **File:** `src/components/charts/FleetStatusDonut.tsx`
- Filters out retired vehicles before calculating segments
- Available = activeVehicles - booked - maintenance (retired already excluded)

### 6. Fleet Status Widget: Booking-Aware Counts ✅
- **File:** `src/components/dashboard/widgets/FleetStatusWidget.tsx`
- Replaced phantom "Rented"/"Reserved"/"Unavailable" status items with booking-aware calculation
- Uses active bookings spanning today to derive "Booked" count (same logic as donut)
- Utilization % excludes retired from denominator
- Status items: Available, Booked, Maintenance, Retired (shown separately)

## Files Modified
- `src/hooks/useVehicleOpsStatus.ts` (added `not_set` ops status, fixed default)
- `src/components/fleet/FleetFilters.tsx` (real DB statuses, hideRetired toggle)
- `src/components/fleet/FleetVehicleCard.tsx` (truth-based status, retired UI, Rari indicator, Clock icon)
- `src/components/fleet/FleetPageEnhanced.tsx` (retired filtering, ops_status null handling)
- `src/components/charts/FleetStatusDonut.tsx` (retired exclusion)
- `src/components/dashboard/widgets/FleetStatusWidget.tsx` (booking-aware counts, retired exclusion)

## No Database Migration Needed
All changes are UI/logic corrections using existing DB columns and values.
