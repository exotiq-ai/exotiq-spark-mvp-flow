# Exported migrations — applied to live, missing from `supabase/migrations/`

These two migrations were applied to the live DB via the Lovable migration tool, but the corresponding SQL files were never committed to `supabase/migrations/`. Exported verbatim from `supabase_migrations.schema_migrations.statements` on 2026-05-30 for repo/live parity.

## Why they're here and not in `supabase/migrations/`

The Lovable build system refuses direct file writes under `supabase/migrations/` — that directory is owned by the migration tool, which expects each file to correspond to a tool-initiated apply. Since these versions are **already applied** to live, re-applying them via the tool would either be a no-op or create a new (different) version row.

## Cutover handoff

Before migrating to a new Supabase project, copy these two files into `supabase/migrations/` under the same filenames (the leading version timestamp matches the live `version` value, so they'll be recorded correctly on the new project):

```
cp docs/inventory/2026-05-30-lovable-cloud/exported_migrations/*.sql supabase/migrations/
```

## Files

- `20260114230555_deactivate_reactivate_team_member.sql` — adds `profiles.is_active`, defines 4-arg `deactivate_team_member`/`reactivate_team_member` (later superseded by 1-arg versions in the live DB).
- `20260319204959_backfill_demo_team_hero_image_urls.sql` — one-shot UPDATE backfilling `vehicles.image_url` for the demo team. Idempotent.
