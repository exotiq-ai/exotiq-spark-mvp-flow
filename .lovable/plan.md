# Sequential Migration Apply + Verification Plan

No frontend code changes. Apply each migration exactly as written in the repo, verify, then move to the next. Stop and report if any verification fails.

## Step 1 — Apply `20260530203000_harden_tenant_rls_policies.sql`
Apply via migration tool (verbatim from repo file).

**Verify:**
- `pg_proc` contains: `can_read_team_or_user_storage_path`, `can_write_team_or_user_storage_path`, `can_manage_team_or_user_storage_path`, `can_access_realtime_topic`, `has_shared_team_role`, and updated `is_same_team`.
- App check: a normal team member can still open customer documents and chat attachments (verified via storage.objects policy inspection + one signed-URL read as authenticated role).

## Step 2 — Apply `20260530224500_harden_signup_team_slug_generation.sql`
**Verify:** `SELECT count(*) FROM teams WHERE slug IS NULL OR btrim(slug) = ''` returns 0.

## Step 3 — Apply `20260715211500_vehicle_photos_team_rls_and_webhook_events_select.sql`
**Verify:**
- 4 new `vehicle-photos` policies exist on `storage.objects` (SELECT/INSERT/UPDATE/DELETE, team-scoped).
- Old "Users can view own vehicle photos" (uploader-keyed) policies are gone.
- Fleet page vehicle photos still load for a normal team member (spot-check via signed-URL for a known team's photo).
- SELECT policy exists on `stripe_webhook_events` restricted to super admins.

## Step 4 — Apply `20260715220000_rent_public_catalog_schema.sql`
**Verify:**
- `SELECT count(*) FROM vehicles WHERE slug IS NULL` = 0.
- `SELECT team_id, slug, count(*) FROM vehicles GROUP BY 1,2 HAVING count(*)>1` returns 0 rows.
- `SELECT count(*) FROM vehicles WHERE marketplace_visible` = 0 and same for `teams.marketplace_visible`.
- Helper fns `is_marketplace_team`, `is_marketplace_vehicle` exist.

## Step 5 — Apply `20260715220100_rent_public_read_rpcs.sql`
**Verify with anon key (via curl against PostgREST):**
- `public_team_by_slug('anything')` → 0 rows.
- Direct `select` on `teams`, `vehicles`, `bookings` → permission denied / 0 rows for anon.
- All 5 RPCs exist with EXECUTE granted to anon.

## Step 6 — Edge function `rent-public-media`
- Confirm deployed (list functions).
- `GET /functions/v1/rent-public-media?team=x&vehicle=y` → 404.
- `GET /functions/v1/rent-public-media` (no params) → 400.

## Step 7 — Security linter
Run `supabase--linter`, report all findings (flag new ones vs pre-existing).

## Step 8 — Full app smoke test (Playwright, headless, using injected auth session)
- Login/session restore → dashboard renders.
- Create booking flow opens and can submit.
- Customer documents load.
- Fleet page vehicle photos render.
- Team chat opens and shows messages.
- Realtime notifications channel connects (no console errors).
Screenshot each step to `/tmp/browser/screenshots/`.

## Reporting
After each step: PASS/FAIL summary. At the end: consolidated report of all verifications, linter findings, and smoke-test screenshots. Halt immediately on any failure and surface the exact error before proceeding.

## Guardrails
- No frontend code changes.
- No migrations beyond these five.
- If a migration's verification fails, stop and report — do not attempt to patch the SQL.
