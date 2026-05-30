# Stale Repo Migrations Archive

These SQL files previously lived under `supabase/migrations/`, but the Lovable
Cloud production inventory from 2026-05-30 confirmed they were never applied to
the live database after a +/-10 second reconciliation against
`supabase_migrations.schema_migrations`.

They are archived here instead of deleted so future Codex, Claude, Lovable, or
human reviewers can inspect the historical intent without letting Supabase
replay them into a fresh migration target.

The two live migrations that were applied but missing from the repo were copied
back into `supabase/migrations/`:

- `20260114230555_deactivate_reactivate_team_member.sql`
- `20260319204959_backfill_demo_team_hero_image_urls.sql`

Do not move archived files back into `supabase/migrations/` unless a separate
review decides the behavior is still needed and assigns a new migration version.
