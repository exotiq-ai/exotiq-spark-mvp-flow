# Build plan — compact revenue chart on dashboard + SF90 payout cleanup

Two independent tracks, one turn.

## Track A — Replace the Pulse REVENUE tile with a small, useful chart

Goal: keep the current three‑card Pulse row (Revenue · Fleet · Next 4 Hours) at the same visual weight. Don't add height, don't add clutter. The card just gets smarter.

### Changes
1. **`RevenueLineChart.tsx`** — add a `compact` mode (prop or wrapper component). In compact mode:
   - No header title, no CSV button, no "See in Payments →" link, no toggle chips.
   - Hide the range switcher; force `30D`.
   - Height ~72 px (matches the current sparkline).
   - Keep: real line, dotted 7‑day moving average, subtle weekend bands, tooltip on hover.
   - Currency via `useMoney()` (already done in the full chart).
2. **`PulseStrip.tsx`** — swap the current inline SVG sparkline for `<RevenueLineChart compact />`. Keep the header row exactly as it is today:
   `REVENUE  ·  $X collected today  ·  ↗ delta vs prior 30D`
   The delta chip reuses the prior‑period series already computed in `useChartData` — no new math.
3. **Click‑through** — clicking the card navigates to `Margin` (or `Payments` filtered to 30D — pick whichever you already prefer; I'll default to Margin since that's where the deep analytics live).
4. **Cleanup** — remove the now‑orphaned `else` branch in `DashboardOverviewEnhanced.tsx` (the legacy `RevenueWidget` mount) so we don't drift again. `RevenueWidget` file itself stays for now in case `CustomizableDashboard` ever ships; only the dead mount is deleted.

### Files touched
- `src/components/charts/RevenueLineChart.tsx` — add `compact` mode.
- `src/components/dashboard/PulseStrip.tsx` — swap sparkline, keep card shell/size.
- `src/components/dashboard/DashboardOverviewEnhanced.tsx` — delete dead legacy branch.

### Out of scope
- No changes to Fleet or Next‑4‑Hours cards.
- No new backend queries.
- No changes to `RevenueWidget` internals.

### Verification
- Build + typecheck pass.
- Playwright screenshot of `/dashboard` at desktop (1280) and mobile (390): the Pulse row height should match the current screenshot within a few pixels; MA line + weekend bands visible; hover shows tooltip.

---

## Track B — Ferrari SF90 partner‑split cleanup (Operator Net −$63K)

Root cause confirmed in DB: `vehicles` row for **Ferrari SF90 Stradale** has `split_type='percentage'` and `split_value=1500` (i.e. 1500%), producing 17 pending partner payouts totaling ~$1.64M. That's what's dragging Operator Net negative on `/dashboard/margin`.

### Steps (I need your call on step 1)
1. **Correct the SF90 split.** Which is right?
   - `split_type='flat'`, `split_value=1500` (flat $1500/day), or
   - `split_type='percentage'`, `split_value=40` (match the Aventador), or
   - other value — tell me.
2. **Recompute pending payouts** — call `fn_transition_payout(id, 'recompute')` for the 17 pending SF90 rows. Amounts refresh from the corrected split.
3. **Leave paid rows alone** — the 4 `paid` rows are terminal; they'll show `reconcile_flag=true` with a diff note for your review. Standard behavior, matches `docs/margin/INTERNAL_MARGIN_WORKFLOWS.md` §4.
4. **Verify Margin numbers.** Re‑query gross / expenses / payouts / Operator Net for Exotiq. Expect Operator Net to swing from ≈ −$63K to strongly positive.
5. **Guardrail (optional, y/n).** Add a `CHECK` constraint on `vehicles`: if `split_type='percentage'` then `split_value <= 100`. Plus an inline error in the Vehicle Command Center partner form. Prevents this footgun on every tenant.

### Files touched
- No frontend files unless you say yes to step 5 (then: partner split form in `src/components/vehicles/*`).
- Migration for the CHECK constraint if approved.
- Data‑only writes for steps 1‑3 (via the existing DB functions, not raw UPDATEs).

### Rollback
- Step 1 is a single row UPDATE — reversible by re‑setting the old values.
- Step 2 only touches `pending` rows and is idempotent.
- Step 5 constraint can be dropped with a follow‑up migration.

---

## What I need from you to proceed

- **SF90 split answer** (flat $1500 / 40% / other).
- **Guardrail yes/no** for the percentage ≤ 100 check.
- Compact‑card click target: **Margin** or **Payments**? (Default: Margin.)

I'll implement Track A regardless of your Track B answers, so if you only want to answer some questions that's fine.
