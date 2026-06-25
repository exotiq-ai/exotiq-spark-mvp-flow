## Health audit — findings

Ran a full sweep across cron, notifications, onboarding, invitations, edge functions, and DB health. Here's what's actually wrong, ranked by impact.

### A. Notification fan-out is the single biggest problem
- 19,801 notifications total in `notifications`; **7,562 written in the last 7 days alone**.
- On 2026‑06‑25 the cron-equivalent path produced bursts like **304 `pending_pickup`** and **282 `late_return`** notifications to a single user in the *same second* (and again at 16:53, 05:05, 04:13, 01:06).
- Root causes in `supabase/functions/check-fleet-alerts/index.ts`:
  1. **No date floor on the booking queries.** `lateBookings` matches everything with `status IN ('active','confirmed') AND end_date < now()`. The DB currently holds **215 such bookings older than 30 days** (Denver alone has 50+ from March 2026 that were never marked completed). Same for `pendingPickups` — **218 stale "confirmed" rows** with `start_date < now() - 30d`. Each run multiplies these by every active team member.
  2. **Race-condition dedup.** `existingRefs` is read once at the top of the function. If two members open the app within a few seconds of each other, both invocations see "no notifications yet" and both insert the full set. No DB-side uniqueness enforces dedup.
  3. **Trigger is per-session, per-tab.** `useNotifications.ts` calls the function on every fresh sessionStorage. Multi-tab or multi-device users multiply runs.
  4. **No `team_id` on notifications** — every notification row stores `data.ref` only, so we can't add a proper unique index unless we promote `ref` to a real column or use an expression index.

### B. Duplicate / misconfigured cron jobs
- Two pg_cron jobs (`purge-old-notifications` and `purge-old-notifications-daily`) both call `public.purge_old_notifications()` at `0 3 * * *`. Harmless but it's duplicate work and confusing.
- There is **no pg_cron entry for `check-fleet-alerts`** — it only fires from the client. Once we fix the function, this should move to pg_cron (one run per team per hour) and stop firing from `useNotifications.ts`.

### C. Onboarding state drift
- `profiles.onboarding_completed` and `onboarding_progress.completed_at` are independent. J Davidson is `profiles.onboarding_completed = true` (so login routes him correctly to `/dashboard`) but his `onboarding_progress` is stuck at step 1. That mismatch is cosmetic for him.
- **Five other users are actually stuck:**
  - `info@exoticsbythebay.co` — at step 4, 1 booking already created, but `onboarding_completed=false` → gets redirected to `/onboarding` every login.
  - `gregoryringler@gmail.com`, `ottoexotics@exotiq.ai`, `saucy@exotiq.ai`, `test.onboarding.jan31.2026@exotiq.io` — all `current_step=1`, `onboarding_completed=false`, no activity since March-June.
- Root cause: nothing reconciles `onboarding_progress.completed_at` ⇄ `profiles.onboarding_completed`. If `markComplete()` partially fails (or the user closes the tab between the two writes), they're stuck forever.

### D. Two expired invitations on Denver still in `pending`
- `mariamedinadesigns@gmail.com` (admin) and `aronnovoseletsky@yahoo.com` (viewer), both `expires_at = 2026‑05‑26`. The `mark_expired_invitations()` function exists but **isn't on the cron schedule**, so expired rows linger as "pending" in the UI and confuse owners.

### E. DB-level signal
- `db_health`: 8% mem, 5% disk, 20/240 connections — plenty of headroom.
- **306,407 rolled-back transactions since boot.** Most likely RLS-violating inserts from the client + the existing `prevent_*` immutability triggers. Not urgent, but worth a tracking ticket once we instrument which table is the source.

### F. Auth/edge function logs
- 7-day auth log scan: no failed logins for Denver users, no error-level rows for any tenant.
- 7-day edge-function log scan: no 4xx/5xx responses.

---

## Plan

Two phases. Phase 1 is the production-safety fix (gets the noise to zero, fixes stuck users). Phase 2 is small follow-ups.

### Phase 1 — ship-now fixes

#### 1. Cap and de-dupe `check-fleet-alerts`
Edit `supabase/functions/check-fleet-alerts/index.ts`:

- Add date floors to every booking query so ancient garbage data can't fan out:
  - `late_return`: only bookings with `end_date >= now() - 14 days`.
  - `pending_pickup`: only bookings with `start_date >= now() - 7 days AND start_date <= now() + 1 day`.
  - `payment_overdue`: only bookings with `start_date >= now() - 30 days`.
  - `deposit_due`: keep the existing 2-day window.
  - `maintenance_due`: cap to `scheduled_date >= now() - 30 days`.
- Re-read `existingRefs` immediately before insert (close the race window). Pull both today's and yesterday's refs so cross-midnight runs don't double-fire.
- Add an in-memory cap (`MAX_NEW_NOTIFICATIONS_PER_RUN = 50`) so a misconfigured tenant can never burst again.
- Swap the final `.insert(notifications)` for `.upsert(notifications, { onConflict: 'user_id,type,ref', ignoreDuplicates: true })` once the migration in step 3 lands.

#### 2. Move trigger off the client into pg_cron
- Remove the `triggerAlerts` effect from `src/hooks/useNotifications.ts` (the entire `useEffect` at lines 134–161 and the `ALERTS_SESSION_KEY` plumbing).
- Add a pg_cron entry that hits `check-fleet-alerts` **once per hour** and iterates all teams server-side. Requires a small refactor: the function changes from "use caller's team" to "loop teams (optionally filter by `?team_id=`)". Auth check changes to: accept either a valid JWT (legacy/manual trigger) OR a server-only secret header (`x-cron-token`) verified against a new `CRON_TRIGGER_TOKEN` secret. Use `secrets--add_secret` to set it.
- Schedule via `supabase--insert` (per the scheduled-jobs guide — the URL+key are tenant-specific and must not go in a migration).

#### 3. Promote `ref` to a real column + unique index
Migration:
- Add `ref text` to `notifications` (nullable).
- Backfill `ref = data->>'ref'` for existing rows.
- Create `CREATE UNIQUE INDEX CONCURRENTLY notifications_dedup ON notifications (user_id, type, ref) WHERE ref IS NOT NULL;`
- This is what makes the upsert in step 1 actually safe.

#### 4. One-time cleanup of the existing junk
A second migration that:
- Deletes notifications older than 7 days where `type IN ('late_return','pending_pickup','payment_overdue','maintenance_due')` AND `data->>'ref'` would match a stale booking (`end_date < now() - 30 days` etc.) — bounded delete, runs once.
- Tells me the row count so I can sanity-check before approving.

#### 5. Reconcile onboarding state
Migration:
- For every `profiles.onboarding_completed = true` user, set `onboarding_progress.completed_at = COALESCE(completed_at, now()), current_step = greatest(current_step, 4)` to clear the cosmetic drift for J Davidson and similar.
- For the five users whose `onboarding_progress.current_step` is 4 but `profiles.onboarding_completed = false` (currently just `info@exoticsbythebay.co`), set `onboarding_completed = true` since they reached the end of the flow.
- Leave the four step-1 zombies alone — they truly haven't done anything; if/when they log in, the existing flow takes over.

Then a one-line code change in `useOnboardingProgress.ts` `markComplete`: write `profiles.onboarding_completed = true` in the **same** mutation/transaction as `onboarding_progress.completed_at`, so a partial failure never produces drift again.

#### 6. Tiny housekeeping
- `cron.unschedule('purge-old-notifications')` so only the `…-daily` job remains (no migration needed; one `supabase--insert` call).
- Schedule `mark_expired_invitations()` via pg_cron at `*/15 * * * *` so expired invites flip out of `pending` automatically.

### Phase 2 — follow-ups (separate tickets I'll open after Phase 1 is green)
- Investigate the 306k rolled-back transactions: add a structured `pg_stat_statements` snapshot tool and identify which statement(s) are aborting. Likely candidates: client inserts into `data_access_log` or `terms_acceptances` that hit immutability triggers.
- Replace `sessionStorage`-keyed dedup throughout the app with proper React Query mutation states (separate sweep).
- Notification preferences enforcement: `notification_preferences` table exists but `check-fleet-alerts` ignores it. Should filter `memberIds` by per-type opt-in before inserting.

### What I will NOT change without explicit go-ahead
- Re-sending the two expired Denver invitations.
- Force-marking any `current_step=1, no activity` zombie users as completed.
- Mass-deleting historical notifications older than the 7-day window in step 4.

### Files touched in Phase 1
- `supabase/functions/check-fleet-alerts/index.ts` — caps, dedup, server-side loop, cron-token auth.
- `src/hooks/useNotifications.ts` — remove client-side trigger.
- `src/hooks/useOnboardingProgress.ts` — write both completion flags atomically.
- Two new migrations (notifications dedup index + onboarding reconciliation).
- Cron changes via `supabase--insert` (not migration, per platform guidance).
- One new secret (`CRON_TRIGGER_TOKEN`) via `secrets--add_secret`.

### Safety properties for current customers
- All booking-query caps only *narrow* what gets notified — no customer loses a notification that was actually timely; they only stop seeing ancient garbage.
- Onboarding reconciliation only flips users *forward* (incomplete→complete when the evidence already shows complete). Never the reverse.
- Notification unique index is added `CONCURRENTLY`, no table lock.
- Removing the client-side trigger is replaced by a server-side cron in the same change, so there's no notification gap.
