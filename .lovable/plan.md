## Recommendation

Best-in-class here is **inline row expansion** — not a modal, not a redirect. Financial power users (think Stripe's dashboard, QuickBooks' P&L drilldowns, Ramp's expense reports) all expand the row in place. Reasons:

- Keeps context: user can compare the vehicle they just clicked against neighbors above/below without losing scroll position or filters.
- No modal fatigue: the vehicle card dialog is heavy (photos, specs, timeline tabs) and answers "what is this car" — the wrong question when you're in Margin.
- Drill-down matches the mental model: click a row → see what drove the number (bookings + expenses + payouts that summed to Operator Net).
- The full vehicle card stays one click away as a secondary action for anyone who wants it.

The current behavior (jumping to Fleet, and then not even opening the card — bug in the query param: table pushes `/dashboard?module=fleet&vehicle=…` but Fleet reads route params) is the worst of both worlds.

## Plan

**1. Fix the broken jump first**
`VehiclePnLTable` uses `/dashboard?module=fleet&vehicle=…`. The Fleet route is `/dashboard/fleet` and reads `?vehicle=` (see current URL). Replace the ad-hoc navigate with a correct path — but this becomes the secondary "Open in Fleet" action, not the row default.

**2. Make row click expand inline**
Row click toggles an expanded panel underneath (single-open accordion behavior; clicking another row collapses the current). Chevron affordance in the Vehicle cell so it's discoverable.

**3. Expanded panel contents** — Margin-native, respects current filters (date range, source, location):
- **Header strip:** vehicle name, thumbnail, quick stats (Gross / Net / Operator Net / Margin %), and two buttons: `Open in Fleet` and `Export vehicle CSV`.
- **Bookings breakdown** (compact table): ref, dates, customer, source badge, gross, platform fee, partner payout, net contribution. Click a row → deep-link to booking (uses existing `useModuleNavigation.goToBookingDetails`).
- **Expenses breakdown** (compact table): date, type, amount, reimbursed, source module. Click → open expense in Expenses tab.
- **Partner payouts** (only if vehicle has a partner split): date, status chip, gross split, net to partner. Click → Payouts tab.
- **Mini trend:** monthly Operator Net sparkline for the filtered window (reuses same data already in `useMarginData`).

**4. Data source**
No new fetches. Everything needed is already loaded by `useMarginData` (bookings, expenses, payouts for the filtered window). Filtering to a single `vehicle_id` is a client-side slice.

**5. Mobile**
On mobile, expanded panel stacks vertically; sub-tables become card lists (same pattern used elsewhere in Margin). Row height stays tap-friendly; chevron rotates on open.

**6. Empty states**
If a section has no rows (e.g., vehicle has bookings but no expenses this period), render a subtle "No expenses in this period" line rather than hiding — so users trust the drilldown is complete.

## Technical Details

- **File touched:** `src/components/margin/VehiclePnLTable.tsx` (row → button + expanded `<TableRow>` beneath).
- **New component:** `src/components/margin/VehiclePnLRowDetail.tsx` — takes `vehicleId` + slices of `bookings/expenses/payouts` already in context, plus vehicle name/thumbnail.
- **Navigation:**
  - Booking rows → `useModuleNavigation().goToBookingDetails(id)`.
  - "Open in Fleet" → `moduleIdToPath('fleet', { vehicle: id })` (fixes the current broken URL).
  - Expense row → `moduleIdToPath('margin', { tab: 'expenses', expenseId })` (Margin tab switcher already keyed by `tab` state; wire a small effect to read it).
- **State:** single `expandedVehicleId` in `VehiclePnLTable`; row click toggles.
- **Accessibility:** row becomes `<button>`-role with `aria-expanded` / `aria-controls`; keyboard Enter/Space toggles.
- **No backend changes. No new queries. No RLS impact.**

## Out of scope

- Vehicle profitability trend beyond the current filter window (would need a separate query).
- Editing expenses/payouts inline (kept as navigation to their canonical tabs).
