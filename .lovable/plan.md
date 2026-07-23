
## Goal
Make the Exotiq demo tenant (`c1de6533-ab44-4973-a123-007a8007b5ba`) look like a healthy, real-world operation for customer demos. All changes are **data-only** on our database — no writes to Stripe.

## Current state (verified via SQL)
Today is 2026-07-23. On Exotiq:
- **1,128 bookings in `confirmed`**, of which **447 have `end_date < now`** — these show up as overdue returns and pollute every dashboard.
- **147 in `completed`**, and **7 of those have no `payments` row**, so historical revenue looks sparse.
- 664 upcoming confirmed, 3 `requested`, 3 `pending_documents`, 7 `cancelled`, 1 `completed` in the future (bad data).
- Overdue confirmed distribution: heavy in Jun 2026 (156) and Jul 2026 (103); a long tail in 2025 (Jan–Dec) with 1–8 per month.

## Plan

### 1. Flip past-dated confirmed bookings to `completed`
Update `bookings` where `team_id = Exotiq` AND `status = 'confirmed'` AND `end_date < now() - interval '1 day'` → set `status = 'completed'`.

**Keep a small "overdue returns" set for realism**, since operators normally have a couple lingering late returns:
- Leave the **3 most recent** overdue confirmed bookings (end_date within the last 5 days) as-is so the "overdue returns" widget still shows something plausible.
- Everything older flips to `completed`.

Expected: ~444 bookings flipped, 3 kept overdue.

### 2. Fix the future-dated `completed` record
One booking has `status='completed'` with `start_date > now()`. Flip it back to `confirmed` (or delete if it looks like test junk — will inspect first and pick).

### 3. Seed payment records for completed bookings without one
For every `completed` booking on Exotiq that has no row in `payments`, insert one row:
- `payment_type = 'rental'`
- `amount = bookings.total_value`
- `payment_status = 'completed'`
- `payment_method = 'card'`
- `transaction_date = bookings.end_date`
- `notes = 'Demo record — no Stripe charge'`
- `team_id`, `customer_id`, `booking_id`, `user_id` copied from the booking
- All `stripe_*` columns left NULL (so nothing looks tied to Stripe)

After step 1 this will cover the newly-completed ~444 plus the existing 7 gap = ~451 payment rows inserted.

### 4. Vehicle revenue rollup
Refresh `vehicles.revenue` for Exotiq from the sum of `completed` bookings' `total_value` (same pattern already documented in `DEMO_DATA_TODO.md`), so per-vehicle revenue on fleet cards reflects the new completed set.

### 5. Quick tenant hygiene sweep
While in there, verify and fix if needed (each is a small, safe check):
- Drafts / abandoned bookings older than 30 days → delete.
- Cancelled bookings with `end_date < now() - 90 days` → leave (history is fine, they don't clutter dashboards).
- Any `customers` row for Exotiq with no bookings AND no notes AND created > 90 days ago → leave (CRM depth is good for demo).
- Confirm no `work_orders` are stuck `in_progress` past their scheduled end; if any, close them.

I will report exact counts before/after each step in the build turn.

## What I will NOT touch
- No Stripe API calls of any kind.
- No schema changes.
- No changes to any other tenant.
- No changes to marketplace visibility, hero images, deposits, fees, slug, timezone — those are already set.
- Upcoming `requested` / `pending_documents` bookings stay as-is (they drive the Daily Brief demo).

## Technical notes
- All writes go through the `insert` tool (data-only, no migration needed).
- `vehicles.status` stays static per existing convention; UI computes live status from bookings.
- Payment inserts use `gen_random_uuid()` for `id` and rely on `payments` defaults for `created_at`.
