

# Push Proactive Tenant Notifications for Key Business Events

## Problem

Currently, notifications only fire when something is **created or updated** (new booking, status change, payment recorded, damage claim). There are no notifications for **time-based events** that the tenant needs to act on:

- A car is late being returned
- A deposit or balance payment is due/overdue
- A booking needs approval (pending pickup today)
- Maintenance is due or overdue
- Customer documents (license/insurance) are expiring

These alerts exist visually in the "Attention Required" widget, but they never push as actual notifications to the bell icon or database.

## Solution

### 1. Create a `check-fleet-alerts` Edge Function

A new backend function that scans the tenant's bookings, payments, maintenance, and customers for actionable conditions and inserts notifications into the `notifications` table. It avoids duplicates by checking if a notification with the same `type` and reference ID was already sent today.

**Alert types it will generate:**

| Alert | Condition | Type |
|-------|-----------|------|
| Late Return | Active/confirmed booking with `end_date` in the past | `late_return` |
| Pending Pickup | Confirmed booking with `start_date` today or past, not yet active | `pending_pickup` |
| Payment Overdue | Booking with `payment_status` = unpaid/partial and `start_date` in the past | `payment_overdue` |
| Deposit Due | Booking with `deposit_amount` > 0, `payment_status` not paid/deposit_paid, `start_date` within 2 days | `deposit_due` |
| Maintenance Due | Maintenance scheduled today or overdue, not completed | `maintenance_due` |

### 2. Update Notification Triggers for Team-Wide Delivery

The existing triggers only notify the single `user_id` on the booking. For a multi-tenant setup, all team members should receive notifications. Update the trigger functions to look up team members and insert a notification row per member.

### 3. Deduplicate Logic

Each proactive notification includes a unique key in the `data` JSONB field (e.g., `{"ref": "late_return_<booking_id>", "date": "2026-02-08"}`). Before inserting, the function checks if a notification with that ref+date already exists, preventing duplicate alerts on repeated runs.

### 4. Invoke on Dashboard Load

Call the `check-fleet-alerts` function when the dashboard loads (debounced, max once per session) so tenants see fresh alerts immediately. This avoids needing a cron job while still being proactive.

## Technical Details

### New File: `supabase/functions/check-fleet-alerts/index.ts`

- Accepts authenticated requests (uses auth token to identify user and team)
- Queries `bookings`, `payments`, `maintenance_schedules`, and `team_members` tables
- For each alert condition met, inserts a notification for every team member (deduplicated by ref+date)
- Returns count of new notifications created

### Modified: Existing DB Trigger Functions (SQL Migration)

Update `notify_new_booking`, `notify_new_payment`, `notify_booking_status_change`, and `notify_new_damage_claim` to:
- Look up the `team_id` from the record
- Query all user IDs in that team via `team_members`
- Insert one notification per team member (not just the record creator)

### Modified: `src/hooks/useNotifications.ts`

- On mount (when user is authenticated), call `check-fleet-alerts` edge function once per session using a sessionStorage flag
- This ensures proactive alerts are generated on login/refresh without spamming

### Modified: `supabase/config.toml`

- Add `[functions.check-fleet-alerts]` with `verify_jwt = false`

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/check-fleet-alerts/index.ts` | New edge function scanning for time-based alerts |
| `supabase/config.toml` | Register new function |
| `src/hooks/useNotifications.ts` | Call check-fleet-alerts on dashboard load (once per session) |
| SQL Migration | Update trigger functions to notify all team members, not just record creator |

