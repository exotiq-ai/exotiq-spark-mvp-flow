# Production Inventory Report — Read-Only

Build a comprehensive, read-only snapshot of the Lovable Cloud backend (project ref `jlgwbbqydjeokypoenoc`) for migration planning. No writes, no deploys, no secret values, no setting changes.

## Output

- `/mnt/documents/exotiq-inventory/REPORT.md` — human-readable master report
- `/mnt/documents/exotiq-inventory/raw/` — raw JSON/CSV per section:
  - `project.json`, `tables.csv`, `row_counts.csv`, `rls.csv`, `policies.csv`, `functions.csv`, `triggers.csv`, `enums.csv`, `extensions.csv`, `views.csv`, `realtime_publication.csv`, `cron_jobs.csv`, `applied_migrations.csv`, `repo_migrations.csv`, `migration_diff.md`, `edge_functions.csv`, `function_diff.md`, `recent_function_errors.json`, `secrets.csv`, `secret_diff.md`, `storage_buckets.csv`, `storage_objects_summary.csv`, `storage_policies.csv`, `auth_config.json`, `linter.json`, `security_scan.json`, `db_health.json`

## Sources per section

1. **Project identity** — `supabase--project_info`, `project_urls--get_urls`, `read_query` on `version()` / `current_setting('cluster_name')`.
2. **Database inventory** — `read_query` against `information_schema` + `pg_catalog` + `pg_policies` + `pg_publication_tables` + `cron.job`. Row counts via `pg_class.reltuples` (fast, no full scans) with a fallback `SELECT count(*)` for the top ~50 tables.
3. **Migration state** — `read_query` on `supabase_migrations.schema_migrations`; cross-reference filenames in `supabase/migrations/`. Produce a two-way diff.
4. **Edge Functions** — list `supabase/functions/` in repo; for each, fetch recent errors via `supabase--edge_function_logs`. JWT verification settings read from `supabase/config.toml`. (Deployment timestamps aren't directly queryable via available tools — will note as a gap.)
5. **Secrets** — `secrets--fetch_secrets` for names only. Grep edge function source for `Deno.env.get(...)` to derive required-secret set; diff against configured names to flag missing or unused.
6. **Storage** — `read_query` on `storage.buckets` and aggregate `storage.objects` (count + sum(metadata->>'size')) per bucket; policies from `pg_policies` on `storage.objects`.
7. **Auth** — config snapshot via available auth-related queries + `supabase/config.toml`; recent auth errors via `analytics_query` on `auth_logs`. (Full provider config requires `configure_auth` which is write-only; will report what's readable and flag the rest.)
8. **Health and lint** — `supabase--linter`, `security--run_security_scan` + `get_scan_results`, `supabase--db_health`, `supabase--cloud_status`.
9. **Migration blockers** — narrative section listing what cannot be exported via Lovable tools (e.g., full `pg_dump`, `auth.users` bulk export, storage object binaries, downloadable PITR backups). Note that managed Cloud projects don't expose direct `pg_dump`/restore through these tools; a full export would need Lovable support or migrating off Cloud.

## Process

Run all read-only queries and tool calls in parallel batches where possible, write raw outputs to `raw/`, then synthesize `REPORT.md` with section summaries, counts, diffs, and a final "blockers & gaps" section. Total expected: ~30–40 read-only tool calls, no mutations.

## Confirmation

I'll switch to build mode and execute on approval. Nothing will be modified in the live project.