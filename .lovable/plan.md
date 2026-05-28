# Margin Module — Completion Plan

Five phases. Each phase ships behind tests that must pass before the next phase starts. Documentation is written as each phase lands. No phase is "done" until its tests are green.

## Phase 1 — Payout Lifecycle Actions

Close the loop from "we owe this" to "we paid / we voided this."

**Already in place:** bulk *Mark Paid* (date + reference), `partner_payouts` columns `status`, `paid_at`, `payout_reference`, `payout_method`, `void_reason`, `voided_at`, `notes`.

**Build:**
- **Void action** — per-row + bulk. Opens a confirmation dialog requiring a reason; writes `status='voided'`, `voided_at=now()`, `void_reason`. Voided payouts are excluded from Operator Net (already handled by `sumPartnerPayouts`).
- **Un-void / re-open** — owner/admin only, returns a voided payout to `pending` and clears void fields.
- **Mark Paid hardening** — capture `payout_method` (ACH, check, wire, Stripe, other) alongside reference; block marking an already-paid/voided row.
- **Single-row actions menu** — replace the implicit "only pending rows are selectable" model with an explicit per-row dropdown (Mark Paid, Void, Re-open) so non-bulk flows are obvious.
- **Status guards** — all mutations re-check current status server-side via a DB function `fn_transition_payout(payout_id, action, ...)` (SECURITY DEFINER, manager+ only) to prevent races and enforce legal transitions: `pending → paid|voided`, `voided → pending`, `paid → voided` (with reason).

**Test gate (must pass):**
- Unit tests for a new `payoutTransitions.ts` helper: legal/illegal transition matrix, amount inclusion rules (pending counts as outstanding, paid excluded from outstanding, voided excluded everywhere).
- Edge-function/DB test: calling `fn_transition_payout` as a non-manager is rejected; illegal transition is rejected.

## Phase 2 — Per-Partner Statement View

Drill-in from the Partners tab.

**Build:**
- Make each Partners-tab row open a `PartnerStatementDrawer` (or routed `?module=margin&partner=<id>`).
- Statement shows: partner header (contact, payout method, split summary), assigned vehicles, payout history grouped by status, and running totals (lifetime paid, outstanding, voided).
- Respects the global Margin date filter.

**Test gate:**
- Unit tests for a `partnerStatement.ts` aggregator: groups payouts, computes lifetime/outstanding/voided correctly, ignores out-of-range rows.

## Phase 3 — Export & Reporting

**Build:**
- Extend `marginCsv.ts` with a per-partner statement export (CSV) scoped to active filters and a single partner.
- Add a PDF statement (reuse existing `generate-report`/PDF pattern if present, else a print-friendly HTML export) with operator + partner branding.
- "Export statement" button in the PartnerStatementDrawer.

**Test gate:**
- Unit tests for the statement CSV builder: correct columns, currency formatting, totals row, empty-state handling.

## Phase 4 — Reconciliation Safeguards

Keep payouts honest when bookings change after a payout exists.

**Build:**
- When a booking is edited/cancelled after its payout was generated, surface a **"needs review"** flag on the payout if `gross_rental_base` no longer matches the booking's computed base.
- A recompute action (manager+) that regenerates `gross_rental_base`, `net_after_fee`, `net_to_partner` for *pending* payouts only (never silently changes paid/voided).
- Trigger/extension of `fn_generate_partner_payout` to set a `reconcile_flag` instead of overwriting paid rows.

**Test gate:**
- DB/edge tests: editing a booking total flags the pending payout; recompute updates pending only; paid/voided rows are untouched.

## Phase 5 — Polish & Trust Signals

**Build:**
- Tooltips on Overview cards explaining each formula (Gross, Collected, Outstanding, Operator Net, Margin %).
- Empty states for teams with no partners / no expenses / no payouts.
- Consistent status badges + action affordances across tabs.

**Test gate:**
- Component render tests: Overview renders all 8 cards with tooltips; empty states render when data is absent.

## Documentation (delivered alongside phases)

Two audiences, written into the repo:

1. **Internal** — `docs/margin/INTERNAL_MARGIN_WORKFLOWS.md`: data model (`partner_payouts`, triggers, `compute_rental_base`, fee snapshot), payout state machine diagram, reconciliation rules, RLS/role gating, and the test matrix per phase.
2. **User training** — `docs/margin/MARGIN_USER_GUIDE.md`: how to add a partner & split, how payouts are generated, how to mark paid / void / re-open, reading a partner statement, exporting statements, and interpreting the Overview metrics. Plain, non-technical language ("encrypted cloud storage" style per project copy standards).

## Technical Notes

- All payout mutations go through a SECURITY DEFINER DB function gated to manager+ (consistent with existing `archive_vehicle` pattern); UI stays read-then-call.
- Reuse `useMarginData` sum helpers; extend rather than duplicate calculation logic so Overview and statements stay consistent.
- Feature stays under the existing `margin` feature flag (Manager+ gate already enforced in `MarginEnhanced.tsx`).
- Tests run via existing Vitest setup (`src/**/*.test.ts`) for frontend helpers and `supabase--test_edge_functions` for DB-level guards.

```text
Payout state machine
  pending ──mark paid──▶ paid
  pending ──void──────▶ voided
  paid    ──void──────▶ voided   (reason required)
  voided  ──reopen────▶ pending  (owner/admin)
```

I'll start with Phase 1 and only advance once its test gate is green.