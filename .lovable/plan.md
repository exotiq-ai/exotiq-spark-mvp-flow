# Margin Expense Tracking — Auto-Sync, Receipts, AI Capture & Review Queue

Bring expenses into Margin from where they already happen, let users drop receipts/invoices for AI parsing, and route anything that affects deposits or payouts through a human-in-the-loop **Review Queue**. Ship all three layers together behind a feature flag.

## Decisions locked in

1. **Maintenance → Margin**: sync only when a work order is marked **completed** with an actual cost. No "estimated" phantoms.
2. **Damage claims → Margin**: pulled automatically the moment a damage claim is logged, but lands in **Review Queue** as `pending_owner_confirm`. Owner must approve before it hits P&L. Tracks the full chain: claim → expense → deposit recovery → reimbursement.
3. **AI receipt parsing**: ship in v1. Same Review Queue handles low-confidence AI parses, so we get one consistent approval surface instead of three.

## The Review Queue — central to all three layers

A new tab in Margin: **Review** (sits between Expenses and Partners). Any expense in `pending_review` status:
- Does **not** appear in P&L totals, charts, or vehicle margin yet.
- Shows in the Review tab with a clear reason ("AI-parsed receipt — confirm vehicle", "Damage claim — confirm cost & deposit deduction", "Maintenance over $X — confirm actual cost").
- One-click **Approve** flips status → `confirmed`, joins the books. **Reject** archives with reason.
- Bulk approve for trusted sources (e.g. "Approve all 12 fuel receipts").

This is the "expense approval workflow" you asked for — kept lightweight (single-step approval by Owner/Admin), not a multi-stage corporate flow.

## Schema changes (one migration)

```
maintenance_schedules:
  + actual_cost numeric(12,2)
  + completed_at timestamptz

vehicle_expenses:
  + status text default 'confirmed'
      check (status in ('pending_review','confirmed','rejected'))
  + review_reason text
  + reviewed_by uuid
  + reviewed_at timestamptz
  + ai_confidence numeric(3,2)        -- 0.00–1.00, null if not AI-sourced
  + ai_parsed_fields jsonb            -- what AI extracted, for audit
  + linked_damage_claim_id uuid       -- for damage-sourced expenses
  + approval_threshold_applied numeric(12,2)  -- threshold that triggered review

  source_module check: add 'maintenance', 'damage', 'ai_receipt'
```

Index on `(team_id, status)` for fast Review tab loads.

`team_settings` (or `user_settings` per existing pattern):
- `expense_auto_approve_under` numeric default 100 — fuel/toll/parking under this auto-confirm, above goes to review.
- `expense_review_required_types` text[] default `{'damage','partner_payout','maintenance'}` — always review regardless of amount.

## Layer 1 — Maintenance → Margin (completed only)

- "Mark complete" action in Maintenance prompts for `actual_cost` (default = `estimated_cost`).
- DB trigger `BEFORE UPDATE` on `maintenance_schedules` with `WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' AND COALESCE(NEW.actual_cost, NEW.estimated_cost) IS NOT NULL)`:
  - Upsert into `vehicle_expenses` keyed on `(source_module='maintenance', source_record_id=maintenance_schedules.id)`.
  - `status = 'pending_review'` if amount > settings.expense_auto_approve_under OR type is in always-review list. Else `'confirmed'`.
- Margin Expenses shows "From Maintenance" badge with backlink. Edits to amount in Margin write back to `actual_cost` so both views stay aligned. Delete in Margin only unlinks, never deletes the work order.
- Re-completing the same work order (status flips to in-progress and back) updates the existing expense — no duplicates.

## Layer 2 — Damage claims → Margin (owner-confirmed)

Per memory `operations/damage-claims-flow` damage already links to booking + inspection. We extend that flow:

- When a damage claim is created with `estimated_cost > 0`, a `vehicle_expenses` row is created with `source_module='damage'`, `linked_damage_claim_id`, `status='pending_review'`, `review_reason='Damage claim awaiting owner confirmation'`.
- Review card shows: photos of damage (from inspection), booking + renter, estimated repair, **deposit on file**, suggested deduction.
- Owner Approve flow has three actions in one card:
  1. Confirm final cost (editable from estimate).
  2. Apply deposit deduction (creates matching row in `deposit_ledger` — already exists per `DepositLedgerTab`).
  3. Mark as reimbursable from renter (flips `is_reimbursable=true`).
- Once approved, the expense joins P&L. The damage claim, the expense, the deposit deduction, and the reimbursement record are all linked — viewable from any of the four screens.
- Reject = the expense is archived; damage claim remains for tracking but doesn't hit margin.

## Layer 3 — Receipt upload + AI parsing

### Storage
- Private bucket `expense-receipts`, RLS scoped to `(storage.foldername(name))[1] = team_id`.
- Path `{team_id}/{expense_id_or_draft_uuid}/{filename}`. Max 10MB, accept `image/*` and `application/pdf`.

### Upload entry points
- **Per-expense**: existing `AddExpenseDialog` already has a receipt field — keep it.
- **Bulk drop-zone**: new "Upload receipts" button in Expenses tab → drag-and-drop multiple files → each becomes a draft expense.
- **Mobile camera**: capture button on the same drop-zone.
- **Maintenance**: invoice upload on the "Mark complete" dialog — attached to the synced expense.
- **Damage**: invoice upload on the damage claim review card.

### AI parsing pipeline
Edge function `parse-expense-receipt` (verify_jwt = true):
1. Receives `{ receipt_path }`, fetches file from storage.
2. Calls Lovable AI Gateway `google/gemini-3-flash-preview` with vision + a tool-calling schema (per `connecting-to-ai-models` guidance — never raw JSON-in-prompt):
   ```
   extract_receipt({
     vendor, amount, currency, expense_date,
     expense_type (enum from existing check constraint),
     line_items[{description, amount}],
     vehicle_hint (license plate or VIN if visible),
     confidence (0..1)
   })
   ```
3. Frontend creates expense row with `source_module='ai_receipt'`, `ai_confidence`, `ai_parsed_fields`, and:
   - `status='confirmed'` if `confidence >= 0.85` AND amount ≤ auto-approve threshold AND vehicle was auto-matched.
   - `status='pending_review'` otherwise.

### Smart suggestions (server-side, cheap)
- **Vehicle match**: license-plate string → match against `vehicles.license_plate` (team-scoped). Fallback to vendor history (vendor last assigned to this vehicle → suggest same).
- **Booking match**: if expense_date falls inside a `confirmed` booking window for the matched vehicle, suggest linking + auto-flag `is_reimbursable` for fuel/toll/parking types.
- **Duplicate guard**: hash `(team_id, vendor, amount, expense_date)`. Block re-insert with toast "Looks like a duplicate of …".
- **Multi-line invoices**: if AI returns `line_items.length > 1` (e.g. monthly service bill with 4 jobs), create one expense per line sharing the same `receipt_url`.

### Bounds
- AI never auto-categorises `damage`, `partner_payout`, or `tax` — those always route to Review.
- AI errors / unparseable files → create blank draft with `receipt_url` set, status `pending_review`, reason "AI couldn't read this — fill in manually". No silent failures.

## What customers see

| Question | Answer |
|---|---|
| Made a maintenance for the 296 Ferrari — does it show in Margin? | Only after you mark it **complete** with the actual cost. Then yes, instantly, linked both ways. Big jobs (> threshold) land in Review for a quick approval; small ones go straight to the books. |
| Do I have to manually track every expense? | No. Three lanes: (1) maintenance auto-sync on completion, (2) drag-and-drop receipts/invoices with AI parse, (3) manual entry. |
| Can I assign a receipt to a rental # or vehicle? | Yes — AI suggests vehicle (plate match + vendor history) and booking (date overlap). One-tap confirm. |
| Can AI just read my pile of receipts? | Yes — drop them in, AI extracts vendor/amount/date/type, suggests vehicle & booking, you confirm in the Review tab. |
| What about damage? | Auto-pulled from the damage claim. Owner reviews the photos, confirms the cost, applies the deposit deduction, and marks reimbursable — all in one card. Nothing hits P&L until you approve. |
| What if AI gets something wrong? | You correct it. The correction is stored as feedback and biases next time's suggestions for your team (vendor → vehicle, vendor → expense type). |

## Technical notes

- **Trigger correctness**: `BEFORE UPDATE` with explicit `WHEN` clause prevents double-fires. Upsert on UNIQUE `(source_module, source_record_id)` already in schema.
- **Auto-approve threshold**: stored per-team, default $100. Owner can edit in Margin settings.
- **Realtime**: Review tab subscribes to `vehicle_expenses` where `status='pending_review'` so new AI parses and damage claims appear instantly.
- **Audit**: every approve/reject writes `reviewed_by`/`reviewed_at`. `vehicle_change_log` pattern from memory `fleet/inventory-audit` extended for expenses (already a known pattern).
- **Edge function**: `parse-expense-receipt` returns parsed JSON only — client creates the row, RLS handles auth. No service-role bypass.
- **Feature flag**: single flag `featureFlags.expenseAutoSync` gates all three layers. Default off, flip on for J Davidson + pilots first.
- **Cost guardrail**: Gemini Flash is cheap, but cap parse calls at 50/team/day to start; surface 429/402 in the Review card if the team hits the cap.
- **Backward compat**: existing `source_module='margin_manual'` expenses untouched, all default to `status='confirmed'` via column default.

## Rollout

1. Migration + trigger + Review tab scaffold (no UI behaviour change yet — feature flag off).
2. Layer 1 wired in (maintenance completion flow).
3. Layer 2 wired in (damage review card).
4. Layer 3 wired in (upload + AI parse + smart match).
5. Flip flag on for J Davidson + 2 pilot teams. Watch parse accuracy & approval times for one week.
6. Wider rollout.

## Out of scope (explicit)

- Multi-stage approvals (manager → owner → CFO) — single-step Owner/Admin approval only.
- Bank feed / Plaid.
- Multi-currency FX conversion.
- Tax/VAT classification beyond what the receipt shows.
- Historical backfill of completed maintenance — offer a one-click "Pull last 90 days" tool only if pilots ask for it.
