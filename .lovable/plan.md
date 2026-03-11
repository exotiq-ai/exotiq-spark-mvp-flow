

# Mobile UI Audit & Plan to 9+

## Current Rating: 6.5/10

**What's working:** Typography is solid, touch targets are good, bottom nav is clean, dark theme is polished, task creation form (screenshot 3) looks great.

**What's hurting the score — from your screenshots:**

### Issue 1: Badge Overload on Fleet Cards (Screenshot 4) — Impact: -1.5 pts
Each vehicle card shows 3-4 stacked badges: "Booked" + "Ready for Pickup" + "With Renter" on the Urus, "Booked" + "Washing" + "Clean & Ready" + "Needs Fuel" on the MC20. On mobile, this is visual noise. The vehicle status badge and ops status badge are redundant — "Booked" + "With Renter" say the same thing. And "Clean & Ready" contradicts "Needs Fuel" visually.

**Fix:** On mobile (ops mode), show only ONE primary status badge — the most operationally relevant one. Priority: ops_status > vehicle status. If `renter_has` → show "With Renter" (skip "Booked"). If `needs_fuel` → show "Needs Fuel" (skip "Clean & Ready"). The vehicle status ("Booked") becomes implicit context, not a separate badge. Keep the full badge row on desktop admin view.

**File:** `FleetVehicleCard.tsx` — lines 322-370, condense badge row when `isOpsMode`

### Issue 2: Event Data Repetition in MotorIQ (Screenshot 1) — Impact: -1.0 pts
The same events (Miami Marlins, Arsht Center) appear THREE times on a single scroll: Category Breakdown → High Impact Events → Upcoming Events. On a phone, you're scrolling through the same data 3 times.

**Fix:** On mobile, collapse the three sections into ONE unified "Events" list. Keep Category Breakdown as summary stats only (no event names). Remove the standalone "High Impact Events" card entirely — instead, badge high-impact items inline in the Upcoming Events list. Desktop keeps the current layout.

**File:** `DemandForecastCard.tsx` — lines 800-887, hide Category top-event text and High Impact section on mobile (`hidden md:block`)

### Issue 3: Fleet Card Spacing on Mobile — Impact: -0.5 pts
Cards in ops mode feel slightly cramped with `p-3` and `gap-3`. The status badges wrap awkwardly. The chevron right button takes up vertical space.

**Fix:** Increase ops mode padding to `p-4`, use `gap-1.5` for badge row, and make the chevron a smaller touch target aligned to the right edge.

**File:** `FleetVehicleCard.tsx` — padding and layout tweaks

### Issue 4: Weekly Intelligence Modal (Screenshot 2) — Minor
This actually looks good. The cards are well-spaced, the "New" badge is clear, Next Week Outlook is useful. No changes needed here.

### Issue 5: Task Creation Form (Screenshot 3) — No Issues
Your checkmark confirms this is working well. The Assign To dropdown and Notes field are clean. No changes.

---

## Build Plan (2 files, focused changes)

### 1. `src/components/fleet/FleetVehicleCard.tsx`
- In ops mode (`isOpsMode`), show only the single most relevant badge instead of all badges stacked
- Logic: pick the highest-priority status to display: ops_status label if it's actionable (not `not_set`), otherwise vehicle status label
- Keep photo count badge but move it to the thumbnail overlay (small camera icon)
- Increase mobile card padding from `p-3` to `p-4`

### 2. `src/components/dashboard/DemandForecastCard.tsx`
- Category Breakdown: hide the "Top: [event name]" subtitle on mobile (`hidden md:block`)
- High Impact Events section: hide entirely on mobile (`hidden md:block`) — the same events already appear in Upcoming Events with impact scores
- This eliminates the triple-repeat without losing any data on desktop

## Score After Changes: ~8.5/10
Remaining gap to 9+: command palette, onboarding flow, and micro-interaction polish — already on the roadmap.

