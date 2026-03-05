

# Demand Forecast & Dynamic Pricing — Full UI Overhaul

## Summary
Fix all fake/static data, merge Impact Analysis into Forecast tab, add post-apply UX to Dynamic Pricing, compute real utilization from bookings, and surface events inline in AI Pricing suggestions.

---

## 1. DemandForecastCard.tsx — Major Restructure

### A. Merge Impact Analysis into Forecast tab, remove 3rd tab
- Reduce tabs from 3 → 2: **Demand Forecast** | **AI Pricing**
- Move the category breakdown and high-impact events alert from the Impact tab into the bottom of the Forecast tab (below the event list)
- Move YoY/MoM cards into Forecast tab but wire them to **real booking revenue** (same pattern DynamicPricingCard already uses — compare `currentMonthRevenue` vs `lastMonthRevenue` / `lastYearSameMonthRevenue`)
- Delete the `impact` TabsContent entirely

### B. Accept `bookings` prop for real data
- Add `bookings` prop from parent (passed via `useLocationFilteredFleet`)
- Compute `avgBookingDuration` from real booking data: `avg(end_date - start_date)` across completed bookings, replacing the hardcoded `'3.2 days'`
- Compute real YoY/MoM revenue comparisons from the bookings array

### C. Show events below calendar on Forecast tab (already works)
- Keep the existing events list — it already displays Gemini-sourced events below the forecast bars
- Add a "Seasonal Context" chip when dates overlap with PEAK_SEASONS (e.g., "Miami Open Tennis • 1.25x surge")

### D. Inline events in AI Pricing tab
- When AI forecast generates pricing adjustments, show the relevant event(s) that drove each pricing suggestion inline (event name, date, impact score)
- Link each pricing adjustment reason to the event that triggers it

---

## 2. DynamicPricingCard.tsx — Post-Apply UX + Real Utilization

### A. Post-apply green checkmark
- Track `appliedVehicles: Record<string, { oldRate: number, newRate: number, appliedAt: Date }>` state
- After `handleApplyRate` succeeds, add vehicleId to `appliedVehicles`
- In the vehicle list, show a green checkmark + "Updated" badge with old → new rate for applied vehicles
- Replace the "Apply $X" button with a subtle `✓ Updated to $X` indicator
- Clear on next analysis or page refresh

### B. Fix utilization to use real booking data
- Currently `vehicle.utilization || 0` — the `utilization` field in the vehicles table may not be updated
- Compute utilization from bookings: count days with active bookings in last 30 days / 30 for each vehicle
- Pass computed utilization into the `analyzePricing` call so AI gets real data
- Display computed utilization in the pricing factors breakdown

### C. Fix `|| 70` fallbacks in elevenlabs-tools
- 71 instances of `vehicle.utilization || 70` in `elevenlabs-tools/index.ts` — this means Rari tells users vehicles have 70% utilization when they actually have 0%
- Change all `|| 70` to `|| 0` so Rari reports truthful data
- This is critical: a fleet operator asking "how's my Bugatti doing?" should not hear "70% utilized" when it has zero bookings

---

## 3. useAIPricingEnhanced.ts — Location-aware events

- Currently hardcodes `city: 'miami'` — should detect from the selected vehicle's location
- Pass vehicle location to `ai-event-intelligence` so event data matches the vehicle's market

---

## 4. Hardcoded Data Audit — Items to Fix

| Location | Issue | Fix |
|----------|-------|-----|
| `DemandForecastCard.tsx:298` | `avgBookingDuration: '3.2 days'` hardcoded | Compute from bookings |
| `DemandForecastCard.tsx:291-292` | YoY/MoM derived from `demandMultiplier` not real data | Use booking revenue comparison |
| `elevenlabs-tools/index.ts` (71 places) | `utilization \|\| 70` | Change to `\|\| 0` |
| `useAIPricingEnhanced.ts:83` | Hardcoded `city: 'miami'` | Use vehicle location |
| `DynamicPricingCard.tsx:113` | `vehicle.utilization \|\| 0` shows 0% when DB field is null | Compute from bookings |

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/dashboard/DemandForecastCard.tsx` | Remove Impact tab, merge into Forecast, accept bookings prop, compute real YoY/MoM/duration, inline events in AI Pricing |
| `src/components/dashboard/DynamicPricingCard.tsx` | Add `appliedVehicles` state, green checkmark UX, compute real utilization from bookings |
| `src/hooks/useAIPricingEnhanced.ts` | Accept vehicle location, pass to event intelligence |
| `supabase/functions/elevenlabs-tools/index.ts` | Replace all `\|\| 70` with `\|\| 0` for truthful utilization reporting |
| Parent component that renders DemandForecastCard | Pass `bookings` prop |

No database changes needed. No new edge functions.

