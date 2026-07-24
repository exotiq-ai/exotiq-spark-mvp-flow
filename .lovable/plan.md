
## Goal

Populate the Exotiq team's Expenses tab with a believable, varied backlog so the Margin module looks lived-in — without tipping Operator Net negative. Everything lands in `vehicle_expenses` and is filterable/exportable through the existing Expenses tab and Per-Vehicle P&L.

## Sizing (keeps the fleet healthy)

- Team: Exotiq (`c1de6533-…`), 54 active vehicles, ~$6.62M gross bookings in the trailing 6 months.
- Target total new expenses: **~$900K–$1.05M** over the last 6 months (~14–16% of gross). Combined with existing partner payouts (~$135K net across SF90 + SVJ) this leaves Operator Net solidly positive across the fleet.
- Existing $84K of manual expenses stays; new rows layer on top.

## What gets seeded

All rows use `source_module = 'margin_manual'`, `status = 'confirmed'`, `currency = 'USD'`, `created_by = null`, spread across `expense_date` between `CURRENT_DATE - 180` and `CURRENT_DATE - 3`.

Per-vehicle recurring (54 vehicles × ~6 months):

| Type | Cadence | Per-row range | Vendor examples |
|---|---|---|---|
| `insurance` | monthly | $650–$1,400 (tiered by vehicle tier: Bugatti/Pagani/Koenigsegg/Valkyrie/One high) | Chubb Masterpiece, Hagerty, PURE |
| `storage` | monthly | $325–$650 | Miami Auto Vault, LA Private Garage |
| `detailing` | every ~6 wks | $180–$450 | Auto Concierge, Detail Society |
| `fuel` | 2–4×/month per vehicle w/ bookings | $80–$260 | Shell V-Power, Chevron 94 |
| `cleaning` | 1–2×/month | $95–$180 | Onsite Detail Co. |
| `maintenance` | ~1 per vehicle over 6mo | $850–$3,800 (higher for Ferrari/Lambo/Bugatti) | Marque Motors, Prestige Import Service |
| `registration` | 1 per vehicle (annualized slice) | $180–$620 | FL DHSMV, CA DMV |
| `tax` | quarterly personal property | $420–$1,100 | Miami-Dade Tax Collector |

Occasional / event-driven (sprinkled, not per-vehicle):

- `transport` × ~14 rows, $650–$2,400 (Reliable Carriers, Intercity Lines)
- `parking` × ~30 rows, $45–$220 (event valet, show parking)
- `toll` × ~40 rows, $12–$65 (SunPass, FasTrak)
- `damage` × 4 rows, $1,200–$4,800 (curb rash, stone chip PPF) — a couple flagged `is_reimbursable = true` with partial `reimbursed_amount`
- `processing_fee` × ~6 rows, $85–$340 (Stripe fees for off-platform card use)

Tenant overhead (`vehicle_id = null`), shows up in the Tenant Overhead card:

- `overhead` — monthly office/software: $1,850 (rent split), $420 (software stack), $780 (marketing) → ~18 rows total
- `insurance` overhead-level umbrella policy: $2,400/mo × 6 → 6 rows
- `tax` — one $9,500 quarterly filing

## Distribution rules

- Weight fuel/cleaning toward vehicles that actually had confirmed/completed bookings in that month (join `bookings` per vehicle_id/month) so per-vehicle P&L looks correlated with usage.
- Cap per-vehicle 6-month expense total at ~55% of that vehicle's gross so no single P&L row goes negative.
- Skew vendors + dates with `random()` seeded via `setseed(0.42)` for a stable but natural-looking spread.
- Notes column filled with one-line context ("Post-rental detail — BK-01234 return", "Q2 personal property filing", "Track day fuel top-off") on ~60% of rows.

## Execution

Single insert-tool call: one `INSERT INTO vehicle_expenses (…) SELECT …` composed of a handful of `UNION ALL` CTEs (one per pattern above). Idempotency: prefix every `notes` value with `[seed:2026-07-24]` and pre-check + delete any prior rows with that marker before insert so re-runs are safe.

## Verification (after insert)

- `SELECT expense_type, count(*), sum(amount) FROM vehicle_expenses WHERE team_id=… AND expense_date >= CURRENT_DATE - 180 GROUP BY 1` — confirm mix + totals in target band.
- Open `/dashboard/margin` → Expenses tab: rows visible, filter by type works, Tenant Overhead card shows non-empty breakdown.
- Per-Vehicle P&L: no vehicle flips to negative Operator Net; Margin Overview stays positive.

## Out of scope

- No schema changes, no new tables, no code changes.
- No touching partner_payouts, bookings, or the SF90/SVJ cleanup already done.
- Other tenants untouched (all writes scoped to Exotiq team_id).
