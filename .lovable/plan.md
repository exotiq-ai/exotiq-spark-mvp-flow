## Goal

Rename **Last login** → **Last activity** on the Super Admin → Tenant Health table (and the matching stat in the tenant detail drawer), and back it with a signal that reflects whether anyone on the team is actually *using* the platform — not just the last time they re-entered their password.

## Why the original signal is wrong

`auth.users.last_sign_in_at` only ticks on a fresh sign-in. Sessions on this app are long-lived, so an active customer who hasn't been kicked out in a month still shows "1mo ago" — exactly the misleading data the screenshot is highlighting.

## Activity signal — use the table we already have

The project already has `public.user_activity_log` with `user_id`, `team_id`, `activity_type`, `created_at`, indexed on `created_at DESC` and (via the hardening migration) on `team_id`. It's written to by `useTeamActivity` on real in-app actions (navigation, CRUD, etc.), which is the definition of "on the platform."

`last_activity` per team =
```sql
GREATEST(
  (SELECT max(created_at) FROM public.user_activity_log WHERE team_id = t.id),
  (SELECT max(u.last_sign_in_at) FROM auth.users u
     JOIN public.team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = t.id)
)
```

`last_sign_in_at` stays in the `GREATEST` as a floor so older tenants from before `user_activity_log` was wired up don't suddenly show "—".

## Changes

### Database — new migration

Replace two SECURITY DEFINER functions in `supabase/migrations/20260605163938_…sql`:

- `public.get_super_admin_tenant_health()` — rename returned column `last_login` → `last_activity`, compute via the `GREATEST(...)` above. All other columns / risk flags untouched.
- `public.get_super_admin_tenant_detail(team_id uuid)` — rename JSON key `last_login` → `last_activity`, same computation.

Re-`GRANT EXECUTE … TO authenticated` on both to match current grants. No table changes, no RLS changes.

### Frontend

- `src/components/super-admin/TenantHealthTab.tsx`
  - Row type field `last_login` → `last_activity`.
  - Header text "Last login" → "Last activity".
  - Cell `relTime(r.last_login)` → `relTime(r.last_activity)`.
  - Update sort key if the column is sortable.
- `src/components/super-admin/TenantDetailDrawer.tsx`
  - Detail type field `last_login` → `last_activity`.
  - `<Stat label="Last login" value={fmtDate(detail.last_login)} />` → `<Stat label="Last activity" value={fmtDate(detail.last_activity)} />`.
  - Clipboard export line `Last login: …` → `Last activity: …`.

`rg` confirms no other call sites reference these fields.

## Out of scope

- No new heartbeat/ping table — `user_activity_log` already exists and is being written to.
- No change to `profiles.last_login_at` or the auth `last_sign_in_at` column.
- Column ordering, styling, and the surrounding "30d" / "Flags" columns are unchanged.

## Verification

1. As a super admin, open Tenant Health: header reads **Last activity**; teams that were stale on "Last login" but have recent in-app actions show a much fresher relative time.
2. Open a tenant drawer: stat reads **Last activity** with the same value as the row; clipboard export shows `Last activity: …`.
3. A team with no `user_activity_log` rows still renders (falls back to `last_sign_in_at`, or "—" if both are null).
4. No new console errors; existing super-admin RPC still returns one row per team.
