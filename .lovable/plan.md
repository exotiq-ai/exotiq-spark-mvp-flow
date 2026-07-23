# Exotiq demo polish — utilization + outstanding cleanup

Three targeted changes: seed a few extra active bookings, upgrade the utilization tile to show a 7-day average alongside today, and clean up the Exotiq outstanding-balance total so the Daily Brief reflects a healthy operation.

## 1. Seed ~10 bookings straddling today (Exotiq only)

Goal: lift today's utilization from **31% → ~50%** (27 of 54 vehicles on rent).

- Pick 10 currently-available Exotiq vehicles (not retired, not in maintenance, no active/confirmed booking overlapping today).
- Insert 10 `confirmed` bookings with:
  - `start_date` = today − random(1–3 days), `end_date` = today + random(2–5 days)
  - Realistic renter picked from existing `customers` (weighted toward repeat renters)
  - `total_value` computed from vehicle's `current_rate` × days
  - `balance_due = 0` (paid on pickup, keeps outstanding total clean)
  - `pickup_location`, `pickup_time` populated so calendar cards look real
- No Stripe writes; `stripe_*` fields left null (same pattern as prior demo seeding).

## 2. Surface 7-day average utilization on the KPI tile

Product change only — no data mutation.

- Extend `useDailyBrief` (or a small companion hook) to compute a rolling **7-day average utilization** for the current team: for each of the last 7 days, count distinct vehicles with a `confirmed`/`active` booking overlapping that day ÷ active vehicle count, then average.
- Pass `utilization7dAvg` into `HeroKpiRail`. On the Utilization card, render today's % as the primary number and add a small sub-line: `7-day avg: 48%`.
- Same treatment on `CompactMetricsBar` when space allows (fallback to today only on narrow widths).
- No changes to Rari narration or AI hooks.

## 3. Clean up outstanding balances for Exotiq demo

Current state (Exotiq only): **$3.32M outstanding across 954 bookings**
- 265 `completed` bookings totaling $1.00M (should be zero — they're paid)
- 689 future `confirmed` bookings totaling $2.32M (unrealistically all unpaid)
- 1 `cancelled` with $1.7k (residual)

Target state: **~$80k–$150k outstanding across ~40–60 bookings** — a believable AR pile.

Changes (Exotiq team only, via migration since it's an UPDATE):
- Zero `balance_due` and set `amount_paid = total_value` on all `completed` bookings.
- Zero `balance_due` on the `cancelled` booking.
- For future `confirmed` bookings: mark ~90% as paid-in-full (`balance_due = 0`, `amount_paid = total_value`); leave a realistic long tail (~60 bookings) with partial balances (deposit paid, remainder due closer to pickup).
- No Stripe writes.

Daily Brief's "balances outstanding" card will then read something like *"58 balances outstanding · $112,340"* instead of $3.3M.

## Technical notes

- Files touched:
  - `src/hooks/useDailyBrief.ts` — add `utilization7dAvg` calculation
  - `src/components/dashboard/widgets/HeroKpiRail.tsx` — render sub-line
  - `src/components/dashboard/widgets/CompactMetricsBar.tsx` — optional sub-line
  - `src/components/dashboard/DashboardOverviewEnhanced.tsx` — thread new prop
- Data changes via `supabase--migration` (updates), scoped by `team_id = 'c1de6533-ab44-4973-a123-007a8007b5ba'`.
- No changes to booking status logic, RLS, or edge functions.
- No impact on other tenants.
