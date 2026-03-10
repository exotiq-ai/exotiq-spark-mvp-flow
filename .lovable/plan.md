

# Live Demo Data Tour — Implementation Plan

## Honest Assessment of Your Decisions

Your instincts are solid. A few refinements:

**"Explore on My Own" → dismissable card vs checklist**: You're right to question overcomplication. The best-in-class pattern (Linear, Notion, Figma) is a **persistent but dismissable checklist card** that stays on the dashboard until completed or manually dismissed. No separate modal, no floating overlay — just the existing `GettingStartedChecklist` component appearing after the tour ends. It already auto-hides when all steps are done. Adding a dismiss button is the only change needed. Simple wins.

**Tour re-entry in Settings**: Already partially built. `MyAccountSection.tsx` (line 324-351) has a "Restart Tour" button that resets `tour_completed` and navigates with `?startTour=true`. We just need to update it to dispatch `start-demo-tour` instead.

**Narration script**: I'll draft the demo-data-aware narration referencing specific vehicles naturally. Flag anything that sounds off.

---

## Architecture

The demo team (`c1de6533-ab44-4973-a123-007a8007b5ba`) has 50+ vehicles with bookings. The edge function will return a curated subset of 6 vehicles you picked, plus their associated bookings/revenue, as a JSON snapshot.

### Data Flow

```text
User clicks "See Exotiq in Action"
  → Orchestrator calls demo-data-snapshot edge function
  → Snapshot cached in TourDataContext
  → FleetContext reads from TourDataContext when tour is active
  → All dashboard widgets render demo data
  → Tour ends → context flips back → PostTourChoiceModal appears
  → User picks action → checklist appears (with dismiss option)
```

### Why not just sign them into the demo account?
Auth session switching is fragile — if anything fails mid-tour, they're stuck logged into the wrong account. The data overlay approach keeps their session intact and is instant to toggle.

---

## Implementation

### 1. Edge Function: `demo-data-snapshot`

New file: `supabase/functions/demo-data-snapshot/index.ts`

- Authenticated endpoint (requires valid JWT, any user)
- Uses `SUPABASE_SERVICE_ROLE_KEY` to read from demo team bypassing RLS
- Returns curated data: 6 selected vehicles (with image URLs from `vehicleImageMapping`), their recent bookings, computed revenue/metrics
- Hardcoded demo team ID — no user input controls what's read
- Cached response (same data for all callers)

Selected vehicles from your list:
- Ferrari F8 Tributo (`63feeaf7`)
- McLaren 765LT (need to confirm ID from DB)
- McLaren GT (need to confirm)
- Porsche GT3 RS (need to confirm)
- Rolls-Royce Cullinan (need to confirm)
- Lamborghini Urus (`2209f34f` — has image)

### 2. TourDataContext

New file: `src/contexts/TourDataContext.tsx`

- `tourActive: boolean` — toggles data source
- `demoSnapshot: DemoSnapshot | null` — cached edge function response
- `fetchSnapshot()` — called once on tour start
- `clearSnapshot()` — called on tour end

### 3. FleetContext Integration

Modify: `src/contexts/FleetContext.tsx`

- Import `useTourData` from TourDataContext
- When `tourActive === true`, return demo snapshot data instead of real Supabase data for: `vehicles`, `bookings`, `customers`, `revenue`
- All other functions (create, update, delete) are no-ops during tour
- This means every existing widget automatically shows demo data — zero component changes needed

### 4. Updated Empty State

Modify: `src/components/dashboard/DashboardOverviewEnhanced.tsx`

Replace the current empty state (lines 341-422) with:
- **Primary CTA**: "See Exotiq in Action" button with Play icon — dispatches tour start
- **Secondary**: "Skip, I'll set up myself" link — shows checklist immediately
- Keep the welcome greeting and personalization

### 5. PostTourChoiceModal

New file: `src/components/onboarding/PostTourChoiceModal.tsx`

Three-card layout:
- "Add Your First Vehicle" → opens AddVehicleDialog
- "Import Fleet from CSV" → opens ImportWizard
- "Explore on My Own" → dismisses modal, shows GettingStartedChecklist

Design: glass morphism card matching the existing tour aesthetic, confetti on selection.

### 6. Updated Demo Script

Modify: `src/hooks/useDemoScript.ts`

New narration referencing demo data naturally:
- Dashboard: "Here's your command center. You can see the Ferrari F8 Tributo just went out on a weekend rental, and your Lamborghini Urus is bringing in strong midweek revenue."
- Pulse: "Your fleet is running at 78% utilization this month — the McLaren 765LT has been your top earner."
- Book: "The calendar shows upcoming reservations across your fleet. Notice the Rolls-Royce Cullinan is booked solid through the weekend."
- (Full script will be drafted in implementation — will flag anything that needs your review)

### 7. Orchestrator Updates

Modify: `src/hooks/useDemoOrchestrator.ts`

- Add `onBeforeStart` phase: fetch demo snapshot, wait for it, then activate tour
- On complete: clear snapshot, show PostTourChoiceModal
- Remove duplicate "Rari" pronunciation fix (edge function already handles it)

### 8. Tour Conflicts

Modify: `src/pages/Dashboard.tsx`

- When demo tour starts, dispatch `stop-tour` event to kill InteractiveModuleTour
- Only one tour can be active at a time

### 9. Settings Integration

Modify: `src/components/dashboard/settings/MyAccountSection.tsx`

- Update "Restart Tour" button to dispatch `start-demo-tour` event instead of navigating with query param
- Same button, just wired to the new automated tour

### 10. Checklist Dismiss

Modify: `src/components/dashboard/GettingStartedChecklist.tsx`

- Add X button to dismiss the checklist
- Persist dismissal in `localStorage` (lightweight, no DB needed)

---

## Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/demo-data-snapshot/index.ts` |
| Create | `src/contexts/TourDataContext.tsx` |
| Create | `src/components/onboarding/PostTourChoiceModal.tsx` |
| Modify | `src/contexts/FleetContext.tsx` |
| Modify | `src/components/dashboard/DashboardOverviewEnhanced.tsx` |
| Modify | `src/hooks/useDemoScript.ts` |
| Modify | `src/hooks/useDemoOrchestrator.ts` |
| Modify | `src/pages/Dashboard.tsx` |
| Modify | `src/components/dashboard/settings/MyAccountSection.tsx` |
| Modify | `src/components/dashboard/GettingStartedChecklist.tsx` |
| Config | `supabase/config.toml` (add `demo-data-snapshot` function config) |

---

## What I'll Flag for Your Review

- The full narration script after drafting — specific vehicle references need to feel natural, not forced
- If any of the 6 selected vehicles lack image URLs in the DB, I'll note which ones need photos uploaded

