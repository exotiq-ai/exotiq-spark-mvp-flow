# RLS verification harness

Behavioral verification of security/public-surface migrations on a scratch PostgreSQL — no Supabase stack or docker required.

Covers:
- **M2**: `20260715211500_vehicle_photos_team_rls_and_webhook_events_select.sql` (inventory findings 5 and 6) — `test_policies.sql`, 10 tests.
- **M3**: `20260715220000_rent_public_catalog_schema.sql` + `20260715220100_rent_public_read_rpcs.sql` (slugs, marketplace visibility, public read RPCs, availability, quote) — `test_m3_public_rpcs.sql`, 22 tests including anon base-table leak checks and RPC signature PII scan.

## Run M3

```bash
sudo -u postgres psql -c "CREATE DATABASE m3test OWNER tester;"
PGPASSWORD=tester psql -h 127.0.0.1 -U tester -d m3test <<'SQL'
\set ON_ERROR_STOP on
\i scripts/rls-verify/setup_stub.sql
\i scripts/rls-verify/setup_stub_m3.sql
SET check_function_bodies = off;
\i supabase/migrations/20260715220000_rent_public_catalog_schema.sql
\i supabase/migrations/20260715220100_rent_public_read_rpcs.sql
\i scripts/rls-verify/test_m3_public_rpcs.sql
SQL
```

Expected: 22 `PASS:` notices and `ALL M3 TESTS PASSED`.

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
