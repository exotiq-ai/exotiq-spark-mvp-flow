# Super Admin Dashboard — Empty Data Root Cause

## What I found

The console shows every Super Admin RPC failing with:

```
code: 25006 — "cannot execute INSERT in a read-only transaction"
```

That's why Tenant Health, Vehicle Audit, and the Platform Pulse strip all render zeros / "No tenants match" — the queries never return data.

The data itself is healthy: there are 16 teams in the DB (Natali's Fleet 105 vehicles, Liram 80, Exotiq demo 54, etc.), and running the underlying SELECTs directly returns rows.

## Why it's failing

All eight `get_super_admin_*` functions are declared `STABLE SECURITY DEFINER`. The new ones (`tenant_health`, `vehicle_audit`, `platform_pulse`, `tenant_detail`) also call `log_admin_action(...)`, which does an `INSERT` into `role_audit_log`.

PostgREST runs `STABLE` / `IMMUTABLE` RPCs inside a read-only transaction, so the audit-log INSERT aborts the whole call before any rows are returned. The legacy three (`stats`, `customers`, `audit_logs`, `billing_tenants`) work because they don't write.

## Fix

One migration that flips the four affected functions to `VOLATILE` so PostgREST opens a read-write transaction and the audit insert succeeds:

```sql
ALTER FUNCTION public.get_super_admin_platform_pulse() VOLATILE;
ALTER FUNCTION public.get_super_admin_tenant_health()  VOLATILE;
ALTER FUNCTION public.get_super_admin_vehicle_audit()  VOLATILE;
ALTER FUNCTION public.get_super_admin_tenant_detail(uuid) VOLATILE;
```

No frontend changes, no schema changes, no policy changes. `mark_tenant_seat_review` is already volatile (default).

## Verification after apply

1. Reload `/super-admin` as `hello@exotiq.ai`.
2. Pulse strip should show real Active rentals / Revenue 7d numbers.
3. Tenant Health should list all 16 teams with vehicle counts, util %, flags.
4. Vehicle Audit should surface the over-plan teams (e.g. Natali 105 vs cap 10).
5. Confirm `role_audit_log` has new `view_tenant_health` / `view_vehicle_audit` / `view_platform_pulse` entries.

## Out of scope

- No new metrics, columns, or UI changes — purely unblocking the existing build.
- Will not touch the legacy stats/customers/billing/audit RPCs.
