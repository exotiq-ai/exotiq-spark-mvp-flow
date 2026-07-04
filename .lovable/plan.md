# Dashboard Ship-Readiness Pass

Goal: every number on the dashboard is defensible, every line of copy earns its space, and the Today + Week views feel like one product — not three teams stitched together.

Scope is **frontend + the two supporting edge functions only** (`daily-brief-narrative`, `weekly-intelligence-digest`). No schema or module changes.

---

## 1. Number truth — the non-negotiable fixes

Reading the actual code, the brief renders **four different definitions of the same concepts** across three components. This is what a sharp advisor will catch first.

### 1a. "On rent / Out" — one filter, everywhere
- `useDailyBrief.onRent` uses `['active','confirmed']`
- `HeroKpiRail` yesterday-comparison includes `completed` too
- `PulseStrip.fleet.out` uses `isBlockingBooking()` (includes `pending`)
- `TodaySnapshot` uses `status==='confirmed'` only

**Fix:** extract one helper `isOnRentAt(booking, at)` in `src/lib/fleetMetrics.ts` (client mirror of the edge function's blocking set), and route all four call sites through it. Same set: `confirmed | active`. `completed` and `pending` never count as "out."

### 1b. "Revenue today" vs "Collected today"
`HeroKpiRail` labels the cell **"Collected"** but the value passed in is `facts.revenueToday`, which is the sum of **booking `total_value` for pickups today** — that's *booked*, not *collected*. `TodaySnapshot` correctly reads `payments.transaction_date`.

**Fix:** rename the concept everywhere:
- `booked_today` = Σ `total_value` of pickups starting today (leading indicator)
- `collected_today` = Σ `payments.amount` where `transaction_date` is today (lagging, cash)

The KPI rail shows **Collected** and must read from payments. The narrative payload sends both under distinct keys so Rari never conflates them.

### 1c. `revenueMonth` is mislabeled
`useDailyBrief.revenueMonth` sums `total_value` of all confirmed/active/completed bookings **with no date filter** — it's lifetime revenue, not this month. Currently unused in UI but shipped to the narrative fn.

**Fix:** either compute a real MTD figure (overlap-weighted, matching the weekly digest's `overlapWeightedRevenue`) or drop the field from the narrative payload. Recommend drop — Today doesn't need MTD.

### 1d. Yesterday deltas in `HeroKpiRail`
Yesterday's `pickups` and `returns` filters include `completed`; today's don't. Deltas skew negative every day as bookings complete.

**Fix:** yesterday filters must match today's exactly (share the helper from 1a).

### 1e. Weekly digest ↔ Daily brief parity
Weekly uses overlap-weighted revenue and a blocking set of `confirmed|active|completed`. Daily uses booking `total_value` on pickup day. That's fine as long as **the KPI rail cell that carries over to the weekly strip uses the same math as the weekly card** — currently the "Week" strip shows `wir.revenue` (overlap-weighted) next to a today "Collected" value from a different pipeline. Add a one-line footnote in the digest dialog: `Revenue is overlap-weighted across the week.` No math change; disclose the model.

**Acceptance:** open Today → note four numbers. Open Week → same four concepts reconcile within rounding. No cell shows a definition that another cell contradicts.

---

## 2. Copy pass — "every pixel counts"

Line-by-line audit of user-facing strings:

| Location | Current | Proposed |
|---|---|---|
| `BriefHeader` | `Good morning, Alex. Saturday, July 4 · Exotiq Motors` | Keep greeting + name on line 1 (18px semibold). Move `Saturday, July 4 · Exotiq Motors` to a 12px muted line below. Two lines read faster than one long wrap. |
| `AllClear` | `All clear — nothing needs you right now.` | `All clear. Nothing needs you.` (kill filler) |
| `TieredPunchList` view-all | `View all 12 →` | `See 7 more` (avoid the arrow char + "all" — user already sees 5) |
| `WeeklyDigestCard` strip empty | `Generate this week's digest` | `Summarize this week` |
| `WeeklyDigestCard` card sources footer | `bookings · vehicles · no city set` | Hide `no city set` entirely — exposing null state is technical noise. Show sources only when non-empty. |
| `WeeklyDigestCard` dialog | `Next week outlook` header | `Next week` (the KPI rail already implies "outlook") |
| `useDailyBrief` issue titles | `3 bookings await confirmation`, `2 bookings with a balance due` | `3 bookings need confirming`, `2 balances outstanding · $12,400` (front-load the number, verb, then amount) |
| Overdue tasks | `1 overdue task` | `1 task overdue` (verb-final reads as status, not noun) |
| Pricing opp | `Pricing opportunity: Lamborghini Huracán +12%` | `Raise Huracán rate 12% · ~$4,200/mo` (imperative + value in one line) |

Also: kill the 👋 emoji on the empty-state welcome (line 382) — it's the only emoji in the whole surface and reads inconsistent with the rest of the editorial voice.

---

## 3. Cohesion / visual register

Small, cheap unification moves so Today, Week, and the strips below feel like one page:

- **One divider style.** HeroKpiRail uses `divide-border/50`, PulseStrip uses card borders, WeeklyDigest uses `border-border/60`. Standardize on `border-border/50` hairlines, no card chrome inside the brief band.
- **One number font treatment.** KPI numerals should be identical in HeroKpiRail and WeeklyDigest KpiCell: `text-[2rem] font-semibold tracking-tight tabular-nums`. Currently rail is `text-[2.25rem]`, weekly is `text-[22px]` — visibly different.
- **One uppercase label style.** Rail uses `tracking-[0.18em]`, digest uses `tracking-[0.16em]`. Pick `0.16em` and apply to both plus PulseStrip section labels.
- **One delta chip.** `DeltaChip` in HeroKpiRail vs the inline `TrendingUp/Down` spans in WeeklyDigest strip are visually different treatments of the same idea. Extract `<DeltaChip delta={n} unit="%" />` and reuse.
- **Motion budget.** Rail cells stagger at 60ms, PulseStrip has none, DailyBriefCard issue rows stagger at 30ms. Cap total stagger at ~250ms end-to-end so the fold settles fast; drop the punch-list `motion.li` stagger (it delays the first paint the user reads).
- **Ordering.** Current order on Today is: greeting → KPI rail → narrative → punch list → weekly strip → PulseStrip → LiveActivity/QuickJump. The punch list is the "why I'm here" — it should sit **above** the narrative, not below. Move narrative to a single italic line **under** the KPI rail label row, not its own band.

---

## 4. Recommended pre-ship improvements

Ranked, non-blocking unless flagged 🚨:

1. 🚨 **Number-truth fixes (§1)** — blocker. Advisor demo will hit this.
2. 🚨 **`revenueMonth` mislabel (§1c)** — blocker if the narrative fn ever surfaces it.
3. **Narrative freshness.** Cache key is `date + role`. If the fleet changes at 2pm (new booking, overdue clears), the narrative stays stale until midnight. Add issue-count hash to the cache key so it regenerates on material change.
4. **Loading skeleton parity.** Skeleton shows 4 rows at `h-14`; real punch list rows are 44px critical / 36px heads-up. Update skeleton to match to avoid the layout jump.
5. **`WeeklyDigestCard` first-load.** If no digest exists, we show a "Generate" button silently. Auto-generate once on first mount for the week if `!digest && !generating`; keep the manual regenerate.
6. **Empty-fleet dashboard (lines 380–418)** still uses the emoji greeting and a 260px CTA. Align its typography with the new BriefHeader so the empty state doesn't look like a different product.
7. **A11y.** Punch-list rows are `<button>` inside `<li>` — good. But the KPI rail cells are non-interactive `<div>`s with no landmark. Wrap in `<dl>`/`<dt>`/`<dd>` so screen readers announce label + value pairs.
8. **Tabular fonts.** Confirm `tabular-nums` is applied wherever a number can change — currently missing in `TodaySnapshot` metric values and the digest dialog's outlook event date column (it *is* on the column but the width is `w-16` which crops long dates like "Nov 12" + weekday). Widen to `w-20` or drop weekday.
9. **PulseStrip vs KPI rail overlap.** Both show "out." Consider dropping the fleet tile from PulseStrip on Today (it duplicates the rail) and keeping it only when the user is scrolled past the rail — or replace with a new "utilization trend" tile.
10. **Route the "See 7 more" affordance somewhere real.** Today it just expands the list inline — fine — but if there are >20 issues it becomes a wall. Cap at 12 inline, then link to a `/dashboard/issues` list (out of scope for this pass; flag for Phase 2).

---

## Technical section (for the implementer)

**New file:** `src/lib/fleetMetrics.ts`
```ts
export const ON_RENT_STATUSES = ['confirmed', 'active'] as const;
export const PICKUP_STATUSES  = ['confirmed', 'pending', 'active'] as const;
export const RETURN_STATUSES  = ['confirmed', 'active'] as const;

export const isOnRentAt = (b, at: Date) =>
  ON_RENT_STATUSES.includes(b.status) &&
  new Date(b.start_date) <= at && new Date(b.end_date) >= at;

export const sumCollectedOnDay = (payments, day: Date) => { /* … */ };
export const sumBookedForPickupsOn = (bookings, day: Date) => { /* … */ };
```
All four consumers (`useDailyBrief`, `HeroKpiRail`, `PulseStrip`, `TodaySnapshot`) import from here. Zero inline status filtering.

**New shared component:** `src/components/dashboard/widgets/DeltaChip.tsx` — used by rail + digest strip + digest KpiCell.

**Edge functions:**
- `daily-brief-narrative`: drop `revenueMonth` from `counts`, add `bookedToday` and `collectedToday` so Rari can distinguish. Update the prompt template accordingly.
- `weekly-intelligence-digest`: no math changes; append a one-line `revenue_model: 'overlap_weighted'` note in `summary_json.coverage` so the UI can render the disclosure.

**Files touched:**
- `src/hooks/useDailyBrief.ts` (metric definitions + drop revenueMonth)
- `src/components/dashboard/DailyBriefCard.tsx` (copy, header split, ordering, narrative placement)
- `src/components/dashboard/widgets/HeroKpiRail.tsx` (helper import, DeltaChip extract, Collected reads from payments)
- `src/components/dashboard/WeeklyDigestCard.tsx` (copy, hide null city, shared KpiCell tokens, DeltaChip, disclosure line)
- `src/components/dashboard/PulseStrip.tsx` (helper import, remove fleet-out duplicate on Today or gate by scroll)
- `src/components/dashboard/pulse/TodaySnapshot.tsx` (helper import)
- `src/components/dashboard/DashboardOverviewEnhanced.tsx` (empty-state typography alignment; kill 👋)
- `supabase/functions/daily-brief-narrative/index.ts` (payload keys + prompt)
- `supabase/functions/weekly-intelligence-digest/index.ts` (coverage disclosure)

**Verification:**
1. `tsgo` on touched files.
2. Playwright: Today view, screenshot → assert one "out" value; switch to Week → same fleet-out number in the strip.
3. Manual: create a payment today, refresh — Collected increments; create a booking with pickup today but no payment — Booked (if we surface it) increments, Collected does not.

---

## Out of scope for this pass
- `/dashboard/issues` full-list route (item 10)
- Any change to Pulse, MotorIQ, CRM, Vault below-the-fold cards
- Any schema, RLS, or new tables
- Marketing/landing copy
