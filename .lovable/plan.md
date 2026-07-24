
## Root cause

The Ferrari SF90 Stradale (partnered to Velocity Capital Partners on the Exotiq team) has `vehicles.split_value = 1500` with `split_type = 'percentage'` — a 1500% split. Every completed booking generated a pending payout inflated by ~37×, producing 15 pending payouts totaling **$1,622,430** on top of a legitimate $159K gross base. That single row is what's wrecking Margin.

The Aventador SVJ on the same partner is correctly configured (40%, ~$64K pending across 15 bookings) and needs no math fix.

## Current Velocity payout state

| Vehicle | Paid | Pending |
|---|---|---|
| SF90 Stradale | 0 rows | 15 rows / $1,622,430 (bugged) |
| Aventador SVJ | 2 rows / $15,000 | 15 rows / $64,076 |

## Cleanup plan (all data-only, no schema)

1. **Fix the split.** Update `vehicles.split_value` for the SF90 from `1500` → `40` (matches the SVJ, sensible operator/partner split). Done via the insert tool.
2. **Recompute SF90 pending payouts.** Call `fn_transition_payout(id, 'recompute')` on each of the 15 pending SF90 rows so `net_to_partner`, `net_after_fee`, and `gross_rental_base` refresh from the booking using the corrected split. This uses the existing state machine — no bypass.
3. **Trim the pending backlog for a "healthy" demo look.** After recompute:
   - Mark the **oldest ~10 SF90 pending payouts** (Jan–Jun 2026 completed bookings) as `paid` via `fn_transition_payout(..., 'mark_paid', paid_at=end_date+3d, method='ach', reference='DEMO-…')`.
   - Do the same for the **oldest ~10 SVJ pending payouts**.
   - This leaves ~5 pending per vehicle (recent completed bookings, i.e. July–Nov 2026) — realistic AR without a wall of open items.
4. **Leave a couple of demo-friendly flags.**
   - Keep 1 SF90 pending row with `reconcile_flag = true` and a note like "Booking total edited after payout generated — review" so the amber `AlertTriangle` renders in `PartnerPayoutsTab` and gives you something to talk about.
   - Leave the existing 2 SVJ `paid` rows and Void 1 SVJ pending row (with `void_reason = 'Booking cancelled by renter — demo'`) so the Voided bucket isn't empty in the statement drawer.
5. **Verify.** Re-query `partner_payouts` grouped by vehicle/status and confirm:
   - No net_to_partner row exceeds `gross_rental_base` after fee.
   - Outstanding for Velocity lands in a believable range (~$40–70K across both vehicles).
   - `MarginOverview` Operator Net returns to a positive/near-flat number on the Exotiq team.

## Out of scope

- No code changes. All work is DB updates + SECURITY DEFINER function calls already in prod.
- Other tenants and other Exotiq vehicles are untouched.
- No booking edits — only payouts and the one vehicle split field.

## Technical notes

- Step 1 uses the insert tool (`UPDATE vehicles SET split_value=40 …`).
- Steps 2–4 use `SELECT fn_transition_payout(id, action, …)` batches via the insert tool since they mutate rows.
- Reconcile flag in step 4 is a direct `UPDATE partner_payouts SET reconcile_flag=true, reconcile_note='…'` — matches how the trigger sets it.
- Nothing here touches `bookings`, so booking history / calendar / CRM stay identical.
