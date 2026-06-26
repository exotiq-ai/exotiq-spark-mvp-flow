## Cleanup for Denver Exotics (J Davidson's Fleet)

Tenant: `J Davidson's Fleet` · users: **J Davidson** (owner) & **Chantara/Tara** (manager).

### What the data shows

**Stale reservations (team-scoped):**
| status | count | oldest end_date | newest end_date |
|---|---|---|---|
| confirmed | 53 | 2026-02-22 | 2026-05-24 |
| completed | 11 | already closed — no action |
| cancelled | 5 | already closed — no action |

→ **53 `confirmed` rows with `end_date` more than 30 days in the past** are the stale-open reservations.

**Notifications across both users (J + Tara):**
- `pending_pickup`: 128 (114 reference bookings already past/closed)
- `late_return`: 126 (112 reference bookings already past/closed)
- `booking_update`: 56 (34 reference closed/past bookings)
- `booking`: 40 (18 reference closed/past bookings)
- `team_member_joined`: 1 — keep
- `tenant_document_sent`: 1 — keep

Every "booking-bearing" notification carries `data->>'booking_id'`, so we can safely classify each row by joining to `bookings`.

### Plan

**1. Close the 53 stale `confirmed` reservations — safe close, not delete.**
   - For `team_id = J Davidson's Fleet` AND `status = 'confirmed'` AND `end_date < now() - 30 days`:
     - `status = 'completed'`
     - `updated_at = now()`
     - `notes = coalesce(notes,'') || E'\n[auto-closed 2026-06-26: rental end date >30d past, no manual close]'`
   - **No money movement** (no refunds, no payouts touched, no payments rows altered).
   - **No vehicle state changes** — `vehicles.status` is independent.
   - **No customer-facing notifications fired** — pure backend reconciliation.
   - Wrapped in a single transaction; affects exactly 53 rows.

**2. Delete stale, booking-attached notifications for both Denver users.**
   For `user_id IN (J, Tara)` AND `data->>'booking_id'` resolves to a booking whose `status IN ('completed','cancelled')` OR `end_date < now() - 14 days`:
   - **Delete** the row (the underlying booking is closed/past, the notification is noise — including the duplicate `late_return` / `pending_pickup` burst from the pre-Phase-1 cron bug).
   - Keep all notifications tied to bookings that are still `pending` / `confirmed` / `active` AND end within the last 14 days or future.
   - Keep all non-booking notifications (`team_member_joined`, `tenant_document_sent`, anything with no `booking_id`).

   Expected removal: ~278 rows across both users. Expected to keep: ~72 rows (the ones for live/recent bookings) plus the 2 non-booking notices.

### Safety guardrails
- All writes scoped by `team_id = 'c71d6655-710a-46da-95b4-f9b0e5f91386'` (bookings) and the two specific `user_id`s (notifications). No other tenant touched.
- No schema changes. No RLS changes. No edge function or cron changes.
- We do a `SELECT count(*)` preflight to confirm the row counts before mutating, and a `SELECT count(*)` postflight to confirm landing.
- The booking close is reversible (a tenant can flip status back; row is preserved with an audit note). Notification delete is destructive but the rows are duplicates / stale and have no downstream references — `notifications` is a leaf table.
- We do **not** touch Exotiq's 161 stale rows or Zachary Schneider's 1 stale row — those are different tenants and are flagged separately to their owners.

### Out of scope
- Closing `pending` bookings (none qualify here, and `pending` may still represent a customer inquiry).
- Bulk close for any other tenant.
- Re-issuing the 2 expired Denver invitations (separate ask).
- Auto-accepting Tara's terms (she'll click through on next sign-in).

### Files / tools
- One `supabase--insert` call: UPDATE 53 bookings + DELETE stale notifications.
- No code changes. No migration.

### Email follow-up
Append to the Denver email draft: "We closed 53 stale `confirmed` reservations (rental ended >30 days ago) and trimmed ~278 obsolete notifications across both seats so your inbox reflects only current work."
