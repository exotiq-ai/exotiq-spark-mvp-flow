## Root cause (confirmed from console)

```
[TenantHealth] error  code 25006  "cannot execute INSERT in a read-only transaction"
```

The migration I shipped declared both `get_super_admin_tenant_health()` and `get_super_admin_tenant_detail()` as `STABLE SECURITY DEFINER`. They each call `public.log_admin_action(...)` (an `INSERT` into the admin audit log). PostgREST runs `STABLE` RPCs inside a **read-only** transaction, so the audit insert fails with Postgres error `25006` and the request returns no rows. The header KPI cards keep working because they use a different RPC (`get_super_admin_platform_pulse`) that isn't `STABLE`.

This is a one-line attribute mistake on my part during the rename — not a problem with the activity-log join. **Remedy, don't revert.**

## Fix

New migration that re-creates both functions with `VOLATILE` (the default) instead of `STABLE`. No body or signature changes, no frontend changes:

```sql
CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_health() …
LANGUAGE plpgsql
SECURITY DEFINER          -- drop STABLE
SET search_path = public
AS $$ … $$;

CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_detail(p_team_id uuid) …
LANGUAGE plpgsql
SECURITY DEFINER          -- drop STABLE
SET search_path = public
AS $$ … $$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_tenant_health()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_tenant_detail(uuid)        TO authenticated;
```

The activity-log join through `team_members` (verified working in SQL — returns rows like `ADMIN` 2026-03-10, `G's Cars` 2026-01-17, etc.) stays as-is.

## Verification

After applying:
- `[TenantHealth] error` no longer logs.
- Tenant Health populates ~16 rows; filter chips show non-zero counts.
- Clicking a row opens the detail drawer with `last_activity` populated.
- `tenant_document_audit` (`log_admin_action` target) keeps receiving rows.
