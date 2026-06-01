## Goal

1. Convert the majority of demo `[DEMO-6MO-FWD]` pending bookings to confirmed so the demo account looks like a healthy, mostly-booked operation.
2. Make the Pulse dashboard render believable real numbers (today's revenue, vs-yesterday delta, 7-day totals) instead of a single artificial spike.

Scoped strictly to team `c1de6533-ab44-4973-a123-007a8007b5ba` (hello@exotiq.ai). No app code changes. All writes remain rollback-safe via the `[DEMO-6MO-FWD]` tag.

## Current state (just verified)

- Demo forward bookings: **626 confirmed / 300 pending** (all tagged `[DEMO-6MO-FWD]`).
- Demo deposits inserted: **621 payments, all dated 2026-06-01** (today) → Pulse currently shows a $903K "Collected Today" spike and 0% vs yesterday. Not realistic.

## Changes

### 1. Flip pending → confirmed (~85%)

- Update **~255 of 300** `[DEMO-6MO-FWD]` pending bookings to `status = 'confirmed'`, `payment_status = 'deposit_paid'`.
- Keep **~45 pending** distributed across the forward window (mostly near-term + some far-future) so the pipeline still looks alive.
- Selection: weight toward near-term first (next 60 days flipped most aggressively); leave a thin pending tail further out.

### 2. Add deposit payments for the newly-confirmed bookings

- One `payments` row per newly-confirmed booking: `payment_type='deposit'`, `amount=deposit_amount`, `payment_status='succeeded'`, `payment_method='card'`, `notes='[DEMO-6MO-FWD]'`. No Stripe IDs, no Stripe API calls. Same pattern as the existing seed.

### 3. Spread payment `transaction_date` across the past ~90 days

- Re-date all `[DEMO-6MO-FWD]` payments (existing 621 + the new ~255) across the last **1–90 days**, weighted toward recent (more activity in last 14 days, tapering back).
- Ensures Pulse shows: a believable today number (handful of payments, not 600), a non-zero yesterday for a meaningful % delta, and a realistic 7-day and 30-day total.

### 4. Verify Pulse with real-data checks (no UI changes)

Run the same aggregations `src/components/dashboard/Pulse.tsx` performs and confirm:

- **Active Bookings** = count of `status in ('active','confirmed')` → expect ~880+.
- **Collected Today** = sum of payments where `transaction_date::date = today` → expect a realistic 4-figure / low-5-figure number.
- **Yesterday revenue** > 0 so the delta % renders meaningfully.
- **Fleet Utilization** computed from `vehicles.status` — report current value (will not be changed by this task).
- **7-day revenue** vs prior 7-day window → both > 0, plausible % delta.
- **Completed bookings this week** → from existing 138 completed rows, report count.

Spot-check 3 recent calendar days for payment counts and totals.

## Out of scope

- No changes to `vehicles.status` / `vehicles.utilization` / `vehicles.revenue` cached columns.
- No Stripe objects, no inspections, no other teams.
- No changes to Pulse component code — only verifying it renders real values from the updated data.

## Rollback

Unchanged from prior seed: delete by `notes='[DEMO-6MO-FWD]'` scoped to the demo team. The status flips are reversible by setting flipped rows back to `pending` (identifiable via the tag + current confirmed-after-seed timestamp if needed).

## Risks

- Live writes to production DB (tagged, rollback-safe).
- Re-dating payments shifts historical-looking activity; this is intentional for demo realism and only affects `[DEMO-6MO-FWD]` rows.
