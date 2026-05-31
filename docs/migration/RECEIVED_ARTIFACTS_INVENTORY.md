# Received Migration Artifacts Inventory

Status: blocked until Lovable/Supabase export artifacts are received.

This document tracks the migration package received from Lovable/Supabase. It is
safe to commit artifact names, checksums, counts, and support notes here. Do not
commit secret values, raw password hashes, database dumps, storage object
binaries, or private keys.

## Source And Target

| Field | Value |
|---|---|
| Source Supabase project | `jlgwbbqydjeokypoenoc` |
| Source host | Lovable Cloud Supabase |
| Target type | Direct Supabase staging project first |
| Production cutover status | Not started |
| Rollback source | Lovable Supabase remains active |

## Artifact Checklist

| Artifact | Required | Received | Storage Location | Validation |
|---|:---:|:---:|---|---|
| Full Postgres dump | Yes | No | Not received | Blocker |
| Auth users export with password hashes | Yes | No | Not received | Blocker or password-reset fallback |
| Storage export for all buckets | Yes | No | Not received | Blocker or API-copy fallback |
| Auth configuration snapshot | Yes | No | Not received | Blocker |
| Cron job export | Yes | No | Not received | Blocker |
| Backup/PITR statement | Yes | No | Not received | Blocker |
| Secret names | Yes | Inventory exists | `docs/inventory/2026-05-30-lovable-cloud/raw/secrets.csv` | Names only |
| Secret values | Yes | No | Out-of-band only | Must not be committed |

## Expected Count Baselines

Use these existing inventory files as the first comparison baseline after
restore:

- Tables: `docs/inventory/2026-05-30-lovable-cloud/raw/tables.csv`
- Storage: `docs/inventory/2026-05-30-lovable-cloud/raw/storage_objects_summary.csv`
- Cron: `docs/inventory/2026-05-30-lovable-cloud/raw/cron_jobs.csv`
- Migrations: `docs/inventory/2026-05-30-lovable-cloud/raw/migration_reconciliation.md`
- Function config: `docs/inventory/2026-05-30-lovable-cloud/raw/function_diff.md`
- Required env names: `docs/inventory/2026-05-30-lovable-cloud/raw/required_env.txt`

## Validation Notes

- Run `node scripts/migration/validate-received-artifacts.mjs --root <artifact-dir>`
  before restore work starts.
- A failing validation is expected until the export package is received.
- Any artifact containing secret values must live outside the repository.
- If support cannot provide auth password hashes, record the decision here and
  activate the forced password-reset fallback.

## Current Blockers

1. Full DB dump has not been received.
2. Auth export with password hashes has not been received.
3. Storage object binaries have not been received.
4. Auth configuration snapshot has not been received.
5. Backup/PITR availability is unknown.

