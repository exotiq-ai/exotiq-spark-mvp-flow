# Exotiq — Lovable Cloud Production Inventory

Generated: 2026-05-30 (read-only snapshot)

This is an inventory-only report for migration planning. No live changes were made.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project ref | `jlgwbbqydjeokypoenoc` |
| Region | `aws-1-eu-west-1` (Ireland) |
| Postgres | 17.6 (aarch64) |
| Cluster TZ | UTC |
| API URL | `https://jlgwbbqydjeokypoenoc.supabase.co` |
| Pooler | `aws-1-eu-west-1.pooler.supabase.com:6543` |
| Compute | ci_xlarge |
| Created | 2026-01-27 |
| Lovable preview | `https://id-preview--40709742-522b-4267-a142-c1816d02a8a5.lovable.app` |
| Published | `https://exotiq-spark-mvp-flow.lovable.app` |
| Custom domains | `https://app.exotiq.ai`, `https://exotiq.ai` |
| Backend health | up — Database up, PgBouncer up, 7% mem, 5% disk, 23/240 conns, 37 MB DB, 144 MB WAL |

---

## 2. Database Inventory

### Tables (68 in `public`, all with RLS enabled)

| Table | Approx rows | Size | RLS | Policies | Triggers |
|---|---:|---:|:---:|:---:|:---:|
| `automated_messages` | n/a | 24.0 KB | ✓ | 4 | 0 |
| `billing_dunning_events` | n/a | 48.0 KB | ✓ | 2 | 0 |
| `bookings` | 467 | 2.4 MB | ✓ | 4 | 10 |
| `conversation_members` | n/a | 96.0 KB | ✓ | 4 | 0 |
| `customer_notes` | 15 | 64.0 KB | ✓ | 4 | 0 |
| `customers` | 178 | 1.1 MB | ✓ | 4 | 0 |
| `damage_claims` | 6 | 112.0 KB | ✓ | 4 | 3 |
| `data_backups` | n/a | 16.0 KB | ✓ | 2 | 0 |
| `deletion_requests` | n/a | 32.0 KB | ✓ | 3 | 0 |
| `demand_intelligence_cache` | 39 | 152.0 KB | ✓ | 1 | 0 |
| `documents` | 12 | 240.0 KB | ✓ | 4 | 4 |
| `entity_comments` | n/a | 32.0 KB | ✓ | 4 | 1 |
| `import_batches` | 26 | 48.0 KB | ✓ | 3 | 0 |
| `inspection_damage_items` | n/a | 24.0 KB | ✓ | 4 | 0 |
| `inspection_photos` | n/a | 24.0 KB | ✓ | 3 | 0 |
| `integration_configs` | n/a | 24.0 KB | ✓ | 1 | 1 |
| `location_staff` | n/a | 72.0 KB | ✓ | 4 | 0 |
| `locations` | 18 | 48.0 KB | ✓ | 8 | 1 |
| `maintenance_notify_subscribers` | n/a | 32.0 KB | ✓ | 2 | 0 |
| `maintenance_schedules` | 10 | 160.0 KB | ✓ | 4 | 2 |
| `maintenance_windows` | n/a | 32.0 KB | ✓ | 4 | 1 |
| `message_read_receipts` | n/a | 16.0 KB | ✓ | 2 | 0 |
| `messages` | 6 | 80.0 KB | ✓ | 4 | 0 |
| `notification_preferences` | n/a | 24.0 KB | ✓ | 3 | 1 |
| `notifications` | 3530 | 3.2 MB | ✓ | 4 | 0 |
| `onboarding_progress` | 7 | 96.0 KB | ✓ | 1 | 1 |
| `onboarding_responses` | n/a | 16.0 KB | ✓ | 2 | 1 |
| `partner_payouts` | 13 | 104.0 KB | ✓ | 4 | 1 |
| `payment_receipts` | n/a | 16.0 KB | ✓ | 2 | 0 |
| `payments` | 534 | 1.6 MB | ✓ | 4 | 1 |
| `payouts` | n/a | 32.0 KB | ✓ | 3 | 1 |
| `photo_upload_batches` | n/a | 32.0 KB | ✓ | 3 | 0 |
| `pinned_messages` | n/a | 16.0 KB | ✓ | 3 | 0 |
| `profiles` | 10 | 96.0 KB | ✓ | 3 | 3 |
| `purged_vehicle_fingerprints` | n/a | 32.0 KB | ✓ | 1 | 0 |
| `rari_conversations` | 55 | 104.0 KB | ✓ | 4 | 0 |
| `rari_feedback` | 111 | 80.0 KB | ✓ | 2 | 0 |
| `rari_insights` | n/a | 48.0 KB | ✓ | 4 | 1 |
| `rari_messages` | 109 | 120.0 KB | ✓ | 3 | 0 |
| `recurring_expense_templates` | n/a | 32.0 KB | ✓ | 2 | 1 |
| `role_audit_log` | 38 | 72.0 KB | ✓ | 2 | 0 |
| `stripe_webhook_events` | n/a | 144.0 KB | ✓ | 0 | 0 |
| `super_admins` | 2 | 96.0 KB | ✓ | 1 | 0 |
| `team_conversations` | n/a | 48.0 KB | ✓ | 4 | 1 |
| `team_integrations` | 1 | 64.0 KB | ✓ | 4 | 1 |
| `team_members` | 7 | 120.0 KB | ✓ | 4 | 0 |
| `team_messages` | n/a | 112.0 KB | ✓ | 4 | 1 |
| `teams` | n/a | 96.0 KB | ✓ | 4 | 1 |
| `unmatched_photos` | 525 | 704.0 KB | ✓ | 4 | 0 |
| `user_activity_log` | n/a | 48.0 KB | ✓ | 2 | 0 |
| `user_dashboard_layouts` | n/a | 64.0 KB | ✓ | 3 | 1 |
| `user_dashboard_preferences` | n/a | 48.0 KB | ✓ | 3 | 1 |
| `user_invitations` | n/a | 64.0 KB | ✓ | 4 | 1 |
| `user_presence` | 7 | 64.0 KB | ✓ | 3 | 0 |
| `user_roles` | n/a | 48.0 KB | ✓ | 4 | 2 |
| `user_settings` | n/a | 48.0 KB | ✓ | 4 | 1 |
| `vehicle_billing_snapshots` | n/a | 24.0 KB | ✓ | 1 | 0 |
| `vehicle_change_log` | 124 | 112.0 KB | ✓ | 2 | 0 |
| `vehicle_expenses` | 15 | 128.0 KB | ✓ | 4 | 1 |
| `vehicle_inspections` | 3 | 200.0 KB | ✓ | 4 | 0 |
| `vehicle_partners` | n/a | 48.0 KB | ✓ | 4 | 1 |
| `vehicle_photos` | 443 | 1.1 MB | ✓ | 4 | 5 |
| `vehicle_tasks` | n/a | 96.0 KB | ✓ | 4 | 1 |
| `vehicle_transfers` | n/a | 32.0 KB | ✓ | 2 | 0 |
| `vehicles` | 396 | 512.0 KB | ✓ | 4 | 1 |
| `weekly_digests` | n/a | 32.0 KB | ✓ | 2 | 0 |
| `work_order_events` | n/a | 48.0 KB | ✓ | 2 | 0 |
| `work_orders` | n/a | 96.0 KB | ✓ | 4 | 3 |

_Note: `approx_rows = -1` means the planner has no current statistics (table was recently created or never ANALYZEd) — these are typically small/empty._

### Views (4)

- `public.booking_payment_summary`
- `public.deposit_ledger`
- `public.revenue_by_source`
- `public.vehicle_photos_with_vehicle`

### Enums (1)

- `app_role` = {owner,admin,manager,operator,viewer}

### Extensions (7)

| Name | Version | Schema |
|---|---|---|
| `pg_cron` | 1.6.4 | pg_catalog |
| `pg_net` | 0.19.5 | extensions |
| `pg_stat_statements` | 1.11 | extensions |
| `pgcrypto` | 1.3 | extensions |
| `plpgsql` | 1.0 | pg_catalog |
| `supabase_vault` | 0.3.1 | vault |
| `uuid-ossp` | 1.1 | extensions |

### Functions (77 in `public`)

- SECURITY DEFINER: **70** of 77
- Full list: `raw/functions.csv`

### Triggers (56 in `public`)

- Full list: `raw/triggers.csv`

### Policies (242)

- Full list: `raw/policies.csv`

### Realtime publication — `supabase_realtime` (19 public tables)

- `bookings`
- `conversation_members`
- `customers`
- `damage_claims`
- `entity_comments`
- `maintenance_windows`
- `message_read_receipts`
- `notifications`
- `payments`
- `pinned_messages`
- `rari_insights`
- `team_conversations`
- `team_messages`
- `user_activity_log`
- `user_presence`
- `vehicle_inspections`
- `vehicle_tasks`
- `vehicles`
- `work_orders`

### Cron jobs (4)

| Job | Schedule | Active | Command |
|---|---|:---:|---|
| `purge-old-notifications` | `0 3 * * *` | ✓ | SELECT public.purge_old_notifications() |
| `purge-old-notifications-daily` | `0 3 * * *` | ✓ | SELECT public.purge_old_notifications() |
| `cleanup-unmatched-photos-weekly` | `0 4 * * 0` | ✓ | net.http_post -> /functions/v1/cleanup-unmatched-photos |
| `daily-generate-recurring-expenses` | `0 3 * * *` | ✓ | net.http_post -> /functions/v1/generate-recurring-expenses |

_Note: jobs 1 and 2 are duplicates (`purge-old-notifications` + `purge-old-notifications-daily` run the same SQL on the same schedule). Cron jobs 3 and 4 use the live anon JWT inline — rotate carefully on migration._


---

## 3. Migration State

- Applied to live DB: **115**
- Repo migration files: **127**
- Matched (within ±10s of version timestamp): **113**
- Applied with NO repo file (real minor drift): **2** — `20260114230555`, `20260319204959`
- Repo files NEVER applied to live (legacy/superseded bootstrap files): **14**

The earlier `raw/migration_diff.md` showed a huge diff because it did a strict string compare on filename timestamps; the migration runner records a `version` that is offset from the filename timestamp by a few seconds, so identical migrations appeared as both "in repo, not applied" and "applied, not in repo". A ±10-second fuzzy match collapses the noise.

**Bottom line:** essentially in sync. Before cutover, (a) export SQL for the 2 unmatched applied versions and commit them, and (b) clean up the 14 stale legacy files from the repo. Full breakdown: `raw/migration_reconciliation.md`. Raw lists: `raw/applied_migrations.csv`, `raw/repo_migrations.txt`, `raw/migration_diff.md` (legacy strict-compare, superseded).

---

## 4. Edge Functions

- Functions in repo (`supabase/functions/`): **57**
- Functions declared in `config.toml` (all with `verify_jwt = false`): **50**
- In repo but NOT in `config.toml` (would deploy with default `verify_jwt = true`): **8**
- In `config.toml` but NOT in repo: **1**

Direct deployed-function timestamps are not exposed via available Lovable tools — Lovable auto-deploys whatever is in `supabase/functions/`. The diff above is the best available proxy.

Full lists: `raw/repo_functions.txt`, `raw/function_diff.md`.

Recent error logs scan: a sample check of `check-subscription` showed only routine `shutdown` events (no errors). Per-function deep log review can be run on demand.

---

## 5. Secrets

15 configured (names only):

- `DEMO_PASSWORD`
- `DEMO_USER_ID`
- `ELEVENLABS_API_KEY`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_VISION_API_KEY`
- `LOVABLE_API_KEY`
- `OPENAI_API_KEY`
- `PHOTOROOM_API_KEY`
- `PREDICTHQ_API_KEY`
- `RARI_TOOL_TOKEN_SECRET`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_GOOGLE_PLACES_API_KEY`

### Required by edge function source but NOT configured

- `APP_URL` ⚠️
- `FRONTEND_URL` ⚠️
- `MCP_SECRET_TOKEN` ⚠️

### Configured but not referenced in edge function source

_These may be used by the frontend bundle (`VITE_*`), connectors, or be stale._

- `PHOTOROOM_API_KEY`
- `VITE_GOOGLE_PLACES_API_KEY`


`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by the Supabase runtime — they do not need to be set as secrets.

Full diff: `raw/secret_diff.md`.

---

## 6. Storage

### Buckets (7)

| Bucket | Public | Size limit | MIME limits | Objects | Total size |
|---|:---:|---|---|---:|---:|
| `customer-documents` | private | — | `—` | 21 | 6.0 MB |
| `damage-photos` | private | — | `—` | 0 | 0.0 B |
| `dashboard-banners` | public | — | `—` | 9 | 4.4 MB |
| `expense-receipts` | private | — | `—` | 1 | 65.3 KB |
| `message-attachments` | private | 10.0 MB | `{image/jpeg,image/png,image/gif,image…` | 0 | 0.0 B |
| `user-avatars` | public | — | `—` | 5 | 2.0 MB |
| `vehicle-photos` | private | 50.0 MB | `{image/jpeg,image/png,image/webp,imag…` | 1395 | 335.5 MB |

**Public buckets**: `dashboard-banners`, `user-avatars`. Linter flags both for `Public Bucket Allows Listing` — see §8.

Storage policies: see `raw/policies.csv` (filtered by `schemaname='storage'`).


---

## 7. Auth

- Users: 17 (all email-confirmed)
- Identities: 17 — all `email` provider
- No external OAuth providers active at the identity level (no Google sign-ins recorded)
- Storage URL / Site URL: full auth provider config (Site URL, redirect allowlist, email templates, JWT lifetimes) is **not directly queryable** via available read-only tools. The `configure_auth` tool is write-only and not used here.
- Email templates: scaffold under `supabase/functions/send-*` / Resend pipeline

---

## 8. Health and Lint

### DB health
Up — 23/240 connections, 7% memory, 5% disk, 37 MB DB, 144 MB WAL, 0 restarts since boot. 281,438 rolled-back transactions cumulative — large but not unusual for a long-running prod DB.

### Linter — 125 findings

| Severity | Count |
|---|---:|
| INFO  | 1   (RLS enabled, no policy) |
| WARN  | 124 |
|       | • 2 RLS Policy Always True (UPDATE/DELETE/INSERT) |
|       | • 2 Public Bucket Allows Listing |
|       | • ~85 Public Can Execute SECURITY DEFINER Function |
|       | • ~35 Signed-In Users Can Execute SECURITY DEFINER Function |

### Security scan — 132 findings (125 from Supabase linter + 7 from Lovable security scanner)

**Critical / high-priority Lovable scanner findings to triage before migrating:**
1. **Cross-team privilege escalation via unscoped `has_role()` checks** (level: error) — policies on `user_invitations`, `user_roles`, `profiles`, `team_messages`, `team_conversations`, `entity_comments`, `conversation_members`, `role_audit_log` use bare `has_role(auth.uid(), 'admin')` without team scoping. An admin of Team A can read/modify data in Team B.
2. **`is_same_team()` uses `assigned_by` not `team_members`** — enables cross-team customer PII access.
3. **No RLS on `realtime.messages`** — any authenticated user can subscribe to any channel topic.
4. **`user_activity_log` SELECT policy not team-scoped** — any admin/manager reads activity from all teams.
5. **Vehicle-photos bucket SELECT policy keyed to uploader** — teammates blocked, forces public-URL workarounds.
6. **`stripe_webhook_events` RLS enabled, no SELECT policy** — currently inaccessible (not a leak, but gap).

Full raw outputs: `raw/linter.txt`, `raw/security_scan.json`. **Per-policy details with verbatim USING/WITH CHECK predicates for the six priority findings: `raw/security_findings_detail.md`.**

---

## 9. Migration Blockers and Gaps

### Not exportable via available Lovable tools
- **Full `pg_dump`** of schema + data — not exposed. Possible only via Supabase support escalation or migrating off Lovable Cloud.
- **`auth.users` bulk export** with encrypted password hashes — not exposed. Without these, users would need password-reset flow on a new project.
- **Storage object binaries** (1,395 vehicle photos ≈ 352 MB + smaller buckets) — must be copied bucket-by-bucket via signed-URL or `storage_upload` pull; no bulk archive tool available.
- **PITR/backup downloads** — Lovable Cloud manages backups; restoring into a brand-new external Supabase project is not a self-serve action through these tools.
- **Auth full config** (Site URL, redirect allowlist, JWT expiry, email templates, SMTP) — readable only via `configure_auth`, which is write-only. Inferable from `supabase/config.toml` and edge function source, but not authoritatively dumpable.
- **Deployed edge function metadata** (last deployment timestamp per function, deployed version hash) — not exposed.

### Known blockers / things to fix BEFORE any migration cutover
1. Resolve the 6 Lovable-scanner findings above — especially the cross-team `has_role()` escalation (error-level).
2. Decide intent of the duplicate cron job (`purge-old-notifications` vs `purge-old-notifications-daily`) and drop one.
3. Cron jobs 3 and 4 hard-code the live anon JWT — these will need to be re-issued (or replaced with `vault.secrets` references) on the new project.
4. Three deprecated/legacy `*_OPENAI_API_KEY` / `VITE_GOOGLE_PLACES_API_KEY` should be audited for actual usage before being copied to the new project.
5. The `vehicle-photos` storage policy mismatch means hero-photo URLs may rely on public/signed-URL paths the new project will need to recreate identically.

### Confirmation request to send to Lovable support before cutover
- Can you provide a full `pg_dump` (schema + data) of project `jlgwbbqydjeokypoenoc`?
- Can you provide an `auth.users` export including `encrypted_password`, identities, and refresh tokens?
- Can you export all storage objects (or grant temporary S3-read credentials)?
- Can a recent backup be restored into a new external Supabase project we control?

---

## Raw output files

See `/mnt/documents/exotiq-inventory/raw/`:

- `tables.csv`, `policies.csv`, `functions.csv`, `triggers.csv`, `enums.csv`, `extensions.csv`, `views.csv`
- `realtime_publication.csv`, `cron_jobs.csv`
- `applied_migrations.csv`, `repo_migrations.txt`, `migration_diff.md`
- `repo_functions.txt`, `function_diff.md`, `required_env.txt`
- `secrets.csv`, `secret_diff.md`
- `storage_buckets.csv`, `storage_objects_summary.csv`
