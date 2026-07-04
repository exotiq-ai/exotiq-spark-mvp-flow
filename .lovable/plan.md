## Margin module — E2E findings + improvement plan

### E2E run summary (This month range, live data, admin session)

All six tabs render — no crashes. But three real defects surfaced:

1. **`Collected` KPI shows $0.00 while `Gross Booked` = $147,787** — root cause: `useMarginData` selects `payments.payment_date` and `payments.status`, but the actual columns are `transaction_date` and `payment_status`. Every payments fetch returns **HTTP 400** (7 seen in the network log). Downstream: `Collected`, `Outstanding`, `Operator Net`, `Margin %`, and the daily overlap on the trend chart are all wrong.
2. **`Pending Payouts` KPI = $0 but the Payouts tab shows $57,420 pending obligations** — `useMarginData` filters payouts by `created_at BETWEEN start AND end`, so pre-July pending payouts vanish from the KPI. They should count regardless of when the payout row was created.
3. **React warning on Payouts tab** — `<Fragment key=…>` receives `data-lov-id` from the Lovable tagger, which Fragment rejects. Noisy console + a footgun for future dev.

Screenshots saved under `/tmp/browser/margin/shots/`; console/network dumps under `/tmp/browser/margin/`.

### Other logic inconsistencies (not crashes, but wrong-answer bugs)

4. **Bookings filtered by `start_date` only** — a booking that started in June and runs into July is invisible to July's Margin view. Should be overlap-based (`start_date <= end AND end_date >= start`), matching Weekly Digest's model. Consider showing revenue as overlap-weighted for consistency with the dashboard's disclosure line.
5. **`Gross Booked` counts pending bookings** — `sumGross` excludes only `cancelled`. A pending/quoted booking inflates gross. Should exclude `pending` and `cancelled` (align with `isOnRentAt`-style status list already defined in `fleetMetrics.ts`).
6. **Payment date range not respected** — payments are queried by `booking_id` only, so a payment made outside the filter window still counts as "collected this period." Add `transaction_date` between `start`/`end`.
7. **Deposits tab ignores the filter bar entirely** — always shows all-time deposits.
8. **Payouts summary MTD/YTD ignores the filter bar** — uses its own `startOfMonth/Year` regardless of what the operator selected above. Either drive those from filters or clearly label them "current month / current year (independent of filter)".
9. **Top/Bottom by Margin all tie at 100.0% when there are no expenses** — the ranking is meaningless in that state. Rank secondarily by gross $ and hide the pane (or switch to "Top by Gross") when every row is 100%.

### UX/UI pass ("make every pixel count")

Current dashboard has ~1000px of chrome before the tabs even appear. Compress:

- **KPI rail: 8 → 5 cards.** Merge `Gross Booked` + `Collected` into one card with a segmented value ($147,787 booked / $0 collected). Merge `Outstanding` and `Refunds` into one. Drop `Margin %` as its own card and inline it under `Operator Net` as `+100.0% margin` (like HeroKpiRail's DeltaChip). Result: single row of 5 tiles instead of two rows of 4.
- **Kill the empty `Expense Breakdown` card** when there are zero vehicle expenses — collapse to a 1-line empty state, or hide the card and expand the trend chart to full width. Same for `Revenue by Source` when a single source dominates >90%.
- **Header:** drop the subtitle sentence; the filter chips already communicate scope. Recover ~40px.
- **Tabs:** move `Deposits` and `Review` into a `⋯ More` overflow — the primary workflow is Per-Vehicle P&L / Expenses / Partners / Payouts.
- **Filter bar:** show the resolved date range beside the preset chip in muted micro-copy (already partially done), and add a **"Save view"** action so operators don't re-pick location + vehicle every visit.
- **Per-Vehicle P&L table:** add a sticky header, a totals footer row, and a search box. Right-align $ columns (already done) but use `tabular-nums` and monospace zero-suppression (— instead of $0.00) to reduce noise.
- **Payouts tab summary cards:** re-label to "Pending Obligations · Paid This Month · Paid This Year" so it's clear they're independent of the top filter; or tie them to the filter.
- **DeltaChip usage:** show period-over-period delta on `Gross Booked`, `Collected`, `Operator Net`, and `Margin %` — reusing `src/components/dashboard/widgets/DeltaChip.tsx` for consistency with the Overview.

### Feature ideas that move the needle

1. **Cash vs Accrual toggle.** Operator confusion between "booked" and "collected" is the #1 issue caught by this run. A single top-right toggle (Cash / Accrual) switches every KPI, chart, and P&L cell between "revenue recognized at pickup date" (accrual) and "cash received on transaction date" (cash). Uses the shared `fleetMetrics.ts` primitives.
2. **AR aging widget.** Small card next to Outstanding: `0–30 / 31–60 / 61–90 / 90+` days, click-through to filtered bookings with unpaid balance. Turns Outstanding from a number into an action.
3. **Break-even vehicle flag.** Any row where operator_net < fixed monthly overhead allocation gets a red flag + a one-click "raise rate 10%" suggestion piped to MotorIQ (reuse the pricing suggestion pipeline).
4. **Partner statement preview from Payouts row.** The drawer exists (`PartnerStatementDrawer`) — surface it from a right-click / row menu on any partner row, not just from the Partners tab.
5. **Expense category budget vs actual.** Small horizontal bar per category on Expenses tab: budget line vs current spend for the selected period. Budgets stored per team in `user_settings`-style row.
6. **Snapshot on close.** Nightly job persists a `monthly_margin_snapshot` per team when a month closes so historical months are immutable (avoids Margin numbers drifting when a late expense is backdated). Enables reliable YoY.
7. **Export bundle.** One button that produces a zip: monthly P&L PDF + per-vehicle CSV + partner statements — enough to hand to a bookkeeper without further clicks.

### Proposed execution — phased

**Phase 1 — Truth (blockers, ship first):**
- Fix `useMarginData` payments query: `transaction_date` and `payment_status` (rename `FilteredPayment.payment_date` → `transaction_date`; `.status` → `payment_status`; update `sumCollected`/`sumRefunds` accordingly).
- Add `transaction_date` range filter on payments.
- Switch bookings query to overlap-based (`start_date <= end AND end_date >= start`) and reuse `isOnRentStatus` from `src/lib/fleetMetrics.ts` (exclude `pending`, `cancelled`).
- Pending Payouts KPI: drop the created_at window; count all `pending`/`scheduled` payouts for the team.
- Payouts tab: convert `<Fragment key>` list to `.flatMap()` returning two `<TableRow>` elements with keyed variants — Fragment leaves the tree.
- Deposits tab + Payouts summary: respect the top filter (or explicitly label as "all-time").

**Phase 2 — Density & consistency:**
- KPI rail 8→5, DeltaChip integration, header trim, empty-state collapse.
- Tabs overflow menu for `Review`/`Deposits`.
- Per-Vehicle P&L totals footer + sticky header + `—` zero-suppression.
- Consistent revenue model disclosure ("Revenue is overlap-weighted across the period.") mirroring the dashboard.

**Phase 3 — New capability (pick one to sequence):**
- Cash/Accrual toggle (highest leverage — kills the ongoing confusion).
- AR aging widget (fastest to ship, unlocks collections workflow).
- Monthly snapshot job (enables reliable YoY and stops number drift).

### Out of scope
- Redesigning `PartnerStatementDrawer`, Partners CRUD flows, or the payout state machine.
- Schema changes beyond a possible read-only `monthly_margin_snapshot` table in Phase 3.
- Any Stripe payout automation.

### Verification for Phase 1
- Playwright: re-load Margin, assert `Collected` > 0 given a payments-in-range fixture, and 0 console 400s on the payments endpoint.
- Manual: change preset from This Month → YTD; Pending Payouts KPI stays consistent (not counting `created_at` in range), while Gross reflects overlap.
- Snapshot per-vehicle totals footer matches KPI Operator Net within $1.