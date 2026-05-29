# Margin Module — Status

All five phases shipped. See `docs/margin/INTERNAL_MARGIN_WORKFLOWS.md` and `docs/margin/MARGIN_USER_GUIDE.md` for the canonical references.

| Phase | Scope | Status |
|---|---|---|
| 1 | Payout lifecycle (Mark Paid, Void w/ reason, Re-open, per-row actions, SECURITY DEFINER `fn_transition_payout`) | ✅ tests green |
| 2 | Per-partner statement drawer wired from Partners tab; aggregator with date-range filter | ✅ tests green |
| 3 | CSV export + Print/PDF (branded HTML statement opens browser print dialog) | ✅ |
| 4 | Reconciliation: booking edits flag paid/voided rows, recompute action on pending only | ✅ |
| 5 | Overview tooltips on every KPI + dashed empty state when no activity | ✅ |

## Test gate

```bash
bunx vitest run src/lib/payoutTransitions.test.ts src/lib/partnerStatement.test.ts
# 13/13 passing
```

## Files of interest

- DB: `fn_generate_partner_payout`, `fn_transition_payout` (now supports `recompute`), `partner_payouts.reconcile_flag`.
- UI: `MarginOverview.tsx`, `PartnerPayoutsTab.tsx`, `PartnersTab.tsx`, `PartnerStatementDrawer.tsx`.
- Logic: `src/lib/payoutTransitions.ts`, `src/lib/partnerStatement.ts`, `src/lib/statementExport.ts`.
- Docs: `docs/margin/INTERNAL_MARGIN_WORKFLOWS.md`, `docs/margin/MARGIN_USER_GUIDE.md`.
