# Margin Module — Internal Workflows

Audience: engineers + operations team. Covers data model, state machine, reconciliation, RLS/role gating, and the test matrix.

## 1. Data model

### `partner_payouts`
Generated when a booking with a `partnered` vehicle reaches `status='completed'`.

| Column | Notes |
|---|---|
| `booking_id` | UNIQUE — one payout per booking. |
| `vehicle_id`, `partner_id`, `team_id` | Strict tenant scoping. |
| `gross_rental_base` | From `compute_rental_base(daily_rate, start, end, duration_type)`; falls back to `total_value`. |
| `platform_fee_amount` | Snapshot of marketplace fee at completion. |
| `net_after_fee` | `gross_rental_base − platform_fee_amount`, floored at 0. |
| `net_to_partner` | Percentage: `net_after_fee × split_value/100`. Flat: `split_value × days`, capped at `net_after_fee`. |
| `split_type`, `split_value_snapshot` | Frozen at payout creation. Later vehicle edits do not retroactively change paid rows. |
| `status` | `pending` → `paid` / `voided`; `voided` → `pending` (admin re-open). |
| `payout_method`, `payout_reference` | Set on Mark Paid. |
| `void_reason`, `voided_at` | Required on Void. |
| `reconcile_flag`, `reconcile_note` | Set automatically when the source booking changes after a `paid`/`voided` payout. |

### Supporting tables
- `vehicles.ownership_type`, `partner_id`, `split_type`, `split_value` — drives generation.
- `vehicle_partners` — partner directory, soft-deactivated via `is_active`.
- `vehicle_expenses` — feeds Operator Net via `sumVehicleExpenses` (net of reimbursements).

## 2. Generator: `fn_generate_partner_payout()`

AFTER UPDATE/INSERT trigger on `bookings`. Runs when:
- booking just became `completed`, OR
- booking is already completed AND `total_value`, `daily_rate`, `start_date`, `end_date`, or `platform_fee_amount` changed.

Behaviour:
1. Compute fresh `v_base`, `v_net`, `v_partner_share`.
2. If no existing payout → INSERT pending.
3. If existing payout is `pending`/`scheduled` → safely recompute and clear `reconcile_flag`.
4. If existing payout is `paid` or `voided` → never overwrite. Set `reconcile_flag = true` with a diff `reconcile_note` if the recomputed values disagree.

## 3. State machine: `fn_transition_payout(payout_id, action, ...)`

`SECURITY DEFINER`, gated to manager+ (admin-only for `reopen`).

```text
       ┌── mark_paid ──▶ paid ──── void (reason) ──┐
pending│                                              ▶ voided
       └── void (reason) ────────────────────────────┘
                                                voided ── reopen (admin) ──▶ pending

pending ── recompute ──▶ pending  (re-pulls from booking; pending only)
```

| Action | Allowed from | Required input | Role |
|---|---|---|---|
| `mark_paid` | pending, scheduled | `p_paid_at`, `p_method`, optional `p_reference` | manager+ |
| `void` | any except already voided | `p_reason` (required) | manager+ |
| `reopen` | voided | — | owner or admin |
| `recompute` | pending, scheduled | — | manager+ |

All transitions re-check the current status server-side to prevent races. The DB raises on illegal transitions; the UI uses `allowedActions(status)` in `src/lib/payoutTransitions.ts` to disable actions client-side as a UX hint, not as security.

## 4. Reconciliation rules

| Booking change after payout exists | Pending payout | Paid payout | Voided payout |
|---|---|---|---|
| Total/dates edited | Recomputed in place | Untouched; `reconcile_flag = true` with diff note | Untouched (voided is terminal) |
| Booking cancelled | Still pending (operator should void manually) | Untouched; flagged for review | Untouched |
| Manager clicks **Recompute from booking** | Refreshes amounts, clears flag | N/A (action not allowed) | N/A |

The amber `AlertTriangle` next to a payout status in `PartnerPayoutsTab` indicates `reconcile_flag = true`. Hover shows the diff.

## 5. RLS and role gating

- `partner_payouts` SELECT: any team member.
- `partner_payouts` UPDATE: owner, admin, manager.
- `partner_payouts` DELETE: owner, admin.
- All mutations should go through `fn_transition_payout` rather than direct UPDATE so guards apply.
- Feature flag: the entire Margin tab is gated behind manager+ in `MarginEnhanced.tsx`.

## 6. Money math (operator perspective)

```text
Operator Net = Gross Booked
             − Platform Fees           (OTA only)
             − Vehicle Expenses        (net of reimbursements)
             − Partner Payouts         (pending + paid; voided excluded)

Margin %     = Operator Net / Gross Booked
Outstanding  = max(Gross − Collected − Refunds, 0)
```

Helpers live in `src/components/margin/useMarginData.ts` and are reused by Overview, charts, statements, and CSV exports — never duplicate this logic.

## 7. Test matrix

| Phase | Coverage | Location |
|---|---|---|
| 1 | Legal/illegal transition matrix; outstanding vs voided amount rules | `src/lib/payoutTransitions.test.ts` |
| 2 | Statement grouping, totals, date-range filter, voided exclusion | `src/lib/partnerStatement.test.ts` |
| 3 | CSV builder columns, totals row (covered by statement aggregator tests + manual print QA) | `src/lib/statementExport.ts` |
| 4 | DB: pending recompute, paid stays flagged-only, booking edits propagate | Manual via `supabase--read_query` after edit; covered by trigger logic |
| 5 | Overview renders tooltips and empty state | Manual / visual QA |

Run frontend tests: `bunx vitest run src/lib/payoutTransitions.test.ts src/lib/partnerStatement.test.ts`.

## 8. Files

- `src/components/margin/MarginOverview.tsx` — KPI cards with tooltips + empty state.
- `src/components/margin/PartnerPayoutsTab.tsx` — payout table, row actions, recompute, reconcile flag.
- `src/components/margin/PartnersTab.tsx` — partner directory; row click opens drawer.
- `src/components/margin/PartnerStatementDrawer.tsx` — drill-in statement, CSV + Print/PDF.
- `src/lib/payoutTransitions.ts` — state machine helpers.
- `src/lib/partnerStatement.ts` — statement aggregator.
- `src/lib/statementExport.ts` — CSV + print-friendly HTML.
- DB: `fn_generate_partner_payout`, `fn_transition_payout`, `compute_rental_base`.
