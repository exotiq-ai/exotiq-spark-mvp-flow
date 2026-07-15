# RLS verification harness (M2 security hardening)

Behavioral verification for `supabase/migrations/20260715211500_vehicle_photos_team_rls_and_webhook_events_select.sql` (inventory findings 5 and 6) on a scratch PostgreSQL — no Supabase stack or docker required.

## Run

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER tester SUPERUSER PASSWORD 'tester';"
sudo -u postgres psql -c "CREATE DATABASE rlstest OWNER tester;"

# helpers.sql = the function definitions (lines 1-275) from the 20260530 hardening migration
sed -n '1,275p' supabase/migrations/20260530203000_harden_tenant_rls_policies.sql > /tmp/helpers.sql

PGPASSWORD=tester psql -h 127.0.0.1 -U tester -d rlstest <<'SQL'
\set ON_ERROR_STOP on
\i scripts/rls-verify/setup_stub.sql
SET check_function_bodies = off;
\i /tmp/helpers.sql
\i supabase/migrations/20260715211500_vehicle_photos_team_rls_and_webhook_events_select.sql
\i scripts/rls-verify/test_policies.sql
SQL
```

Expected output: 10 `PASS:` notices and `ALL TESTS PASSED`. Any failure raises and aborts (`ON_ERROR_STOP`).

`setup_stub.sql` stubs the Supabase runtime (auth.uid() via a session GUC, storage schema, tenancy tables, `is_team_member`/`is_super_admin`). It intentionally mirrors — not imports — production definitions; if those helpers change materially, update the stub.
