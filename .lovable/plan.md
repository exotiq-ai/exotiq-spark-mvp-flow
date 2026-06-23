## Root cause

The Last-activity migration assumed `public.user_activity_log` has a `team_id` column. It doesn't — the table only has `user_id`. So `get_super_admin_tenant_health()` (and `get_super_admin_tenant_detail()`) throw `column ual.team_id does not exist` at runtime. `TenantHealthTab` catches the error and renders "No tenants match"; the header KPI cards use other RPCs and keep working, which is why the page looks half-broken.

## Fix

New migration that replaces both functions and resolves activity through `team_members`:

```sql
GREATEST(
  (SELECT max(ual.created_at)
     FROM public.user_activity_log ual
     JOIN public.team_members tm ON tm.user_id = ual.user_id
    WHERE tm.team_id = t.id
      AND tm.is_active = true),
  (SELECT max(u.last_sign_in_at)
     FROM auth.users u
     JOIN public.team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = t.id
      AND tm.is_active = true)
)
```

Apply the same expression in both functions (`get_super_admin_tenant_health` for the `last_activity` column, `get_super_admin_tenant_detail` for the `last_activity` JSON field). Re-`GRANT EXECUTE ... TO authenticated`.

## Out of scope

- No table changes, no RLS changes, no frontend changes.
- Keep the `last_sign_in_at` fallback as a floor for tenants with no recorded activity.

## Verification

After the migration:
- `select * from public.get_super_admin_tenant_health()` (as a super-admin user) returns one row per non-deleted team (~16).
- The Tenant Health table populates and the "All" filter chip shows the correct count.
- `last_activity` reflects the most recent in-app action; tenants with no activity log fall back to `last_sign_in_at`.
