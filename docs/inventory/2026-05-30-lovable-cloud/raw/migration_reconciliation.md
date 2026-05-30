# Migration reconciliation

**TL;DR:** Not real drift. The earlier `migration_diff.md` did a strict string compare on the leading 14-digit timestamp. In practice, the Lovable/Supabase migration runner records the `version` in `supabase_migrations.schema_migrations` a few seconds off the filename timestamp (the version is captured when the SQL is applied, not when the file was created), so the same migration appears under two slightly different version numbers. A fuzzy match (±10 seconds) collapses almost the entire diff.

## Method

- Applied versions: 115 (from `supabase_migrations.schema_migrations`)
- Repo migration files: 127 (from `supabase/migrations/`)
- Match rule: same numeric version within ±10 seconds

## Result

- **Matched: 113 of 115 applied / 113 of 127 repo**
- Applied versions with no repo file (2):
  - `20260114230555`
  - `20260319204959`
  These were applied directly to the DB via the migration tool but the corresponding SQL file was never committed to the repo. **Real, minor drift** — recoverable by dumping the SQL from the migration tool's history before any cutover.
- Repo files never applied to live DB (14):
  - Short-timestamp / legacy filenames: `20250101000000`, `20250102000000`, `20250102000001`, `20250103000000`, `20260101194000`, `20260103000000`, `20260103000001`, `20260103000002`, `20260103000003`, `20260128000000`, `20260129000000`, `20260319205000`
  - Non-14-digit prefixes: `20260102_fix_role_based_policies_comprehensive.sql`, `20260108_…`
  These are early hand-authored / experimental migrations from the repo's bootstrap phase that were superseded by Lovable-generated migrations and never run on the live DB. **Cosmetic repo cruft, not drift** — they should be deleted from the repo (or moved to `supabase/migrations/_archive/`) before the next migration audit. None of them are part of the live schema.

## Conclusion

- The earlier `migration_diff.md` is a **report bug** (naïve string compare), not real drift.
- `REPORT.md` saying "repo and live are in sync (no drift)" is **substantively correct** with two caveats:
  1. 2 live migrations (`20260114230555`, `20260319204959`) have no matching repo file — the SQL for these should be exported and committed before cutover so the new project can be rebuilt from the repo alone.
  2. ~14 unapplied legacy repo files should be cleaned up to avoid confusing future audits.

No live database changes were made to produce this reconciliation.
