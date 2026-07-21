# Migration Decision — Lovable Cloud → Exotiq-Managed Supabase

**Date:** 2026-07-21
**Status:** Research complete — recommended path selected, execution not started
**Supersedes:** the "blocked on Lovable support" posture in
`RECEIVED_ARTIFACTS_INVENTORY.md` and `LOVABLE_SUPABASE_EXPORT_REQUEST.md`.
The staging/rehearsal/cutover runbooks in this folder remain valid and are
reused as-is; only the **artifact acquisition** step changes.

---

## TLDR

1. **We are no longer handcuffed.** Two things shipped after our last support
   exchange:
   - **Lovable MCP server** (May 7, 2026, research preview,
     `https://mcp.lovable.dev`): exposes `query_database` (arbitrary SQL,
     full read/write/schema against the Lovable Cloud Postgres) and
     `get_connection_info` (connection string **including host and
     password**) — capabilities that were explicitly unavailable before.
   - **Official export** (~July 3, 2026): Cloud tab → Overview → Advanced
     settings → **"Export project data"** produces a full `pg_dump`-style SQL
     dump — schema, data, RLS, triggers, sequences, cron rows, and **auth
     users WITH bcrypt password hashes**. Limits: 5 GB cap (we're ~37 MB),
     one export per project per 24 h, delivered as an emailed download link.
     Same menu has **Pause Cloud** and **Remove Lovable Cloud** (Remove is
     permanent — never click until weeks after a verified cutover).
2. **Recommended path:** official export as the backbone of the DB restore,
   Lovable MCP as the automation/verification layer, a token-guarded
   temporary edge function for the storage-binaries copy, manual re-entry of
   secret values. Then execute the existing staging → rehearsal → cutover
   runbooks unchanged.
3. **Downtime:** a single 1–2 h night write-freeze window at cutover; users
   keep their passwords (hashes migrate) but must log in once more (new
   project = new JWT secret). Rollback stays a Netlify env-var revert.
4. **New work item found in this research:** **10 edge functions call the
   Lovable AI Gateway** (`ai.gateway.lovable.dev` via `LOVABLE_API_KEY`).
   That dependency does NOT migrate with the database and likely dies when
   Cloud is removed. These need a provider swap (the gateway speaks the
   OpenAI-compatible chat-completions API, so it's a base-URL + key + model
   change per function).

---

## 1. What changed since the plan was written

The May 30 inventory (`docs/inventory/2026-05-30-lovable-cloud/REPORT.md`)
correctly concluded that full `pg_dump`, `auth.users` export, storage
binaries, and PITR restore were "not exportable via available Lovable tools"
and required a support escalation. Both premises are now stale:

| Date | Change | Impact |
|---|---|---|
| 2026-05-07 | **Lovable MCP server** released (research preview, OAuth 2.1, all plans) | Direct SQL + DB connection info against Lovable Cloud Postgres; project/file/deploy tools; ~27 tools total |
| ~2026-07-03 | **Official export / Pause / Remove** shipped in Cloud → Overview → Advanced settings | Self-serve full DB dump incl. auth users with password hashes; official exit path off Cloud |

Community tooling has already converged on this combination: an actively
maintained Claude Code migration skill
(`github.com/CarolMonroe22/lovable-cloud-to-supabase-migration`, v4.0.2,
tested 2026-07-06, 33 steps / 8 phases) uses official export + Lovable MCP +
Supabase MCP + `pg_restore`, and documents the traps. Dreamlit ships an open
source exporter; several guides document the pre-export edge-function
workaround.

## 2. What the Lovable MCP gives us (and what it doesn't)

Confirmed from Lovable's official repo (`github.com/lovablelabs/mcp`):

**Relevant tools**

- `query_database` — run SQL directly against the Cloud Postgres ("full
  read / write / schema"). Good for: fresh inventory counts, freeze-time row
  counts, exporting the 2 drift migrations, pre-cutover fixes (duplicate cron
  job, etc.).
  **Verified live 2026-07-21:** runs as the `postgres` role (non-superuser);
  `auth`, `storage`, `cron`, and `supabase_migrations` schemas all readable,
  including `auth.users.encrypted_password` (19/19 users have hashes). See
  [BASELINE_2026-07-21.md](./BASELINE_2026-07-21.md).
- ~~`get_connection_info` / `get_database_connection_info`~~ — **absent from
  the live server** (verified 2026-07-21: the connector exposes 39 tools, no
  connection-string tool despite the README). On-demand external `pg_dump`
  via MCP is not available; the official export is the dump source, and the
  temp edge function (`SUPABASE_DB_URL`) is the fallback.
- `get_file_tree` / `get_file_contents` / `get_diff` — verify what Lovable
  actually has deployed vs. repo `main`.
- `list_projects` / `get_project` / `check_database_status` — inventory and
  health.

**What the MCP does NOT provide**

- No storage-file download tools (bucket binaries still need the Storage API
  with a service-role credential).
- No secret-value export (edge-function secrets and Vault values are not
  readable; names only — values must be re-entered by us).
- No auth-config dump (Site URL, redirect allowlist, email templates —
  recreate from `supabase/config.toml` + function source, as already planned).
- Preview-status caveats: tool names may change; OAuth scope is the whole
  Lovable account (not per-project); treat access as highly privileged.

**Verdict:** the MCP alone is not the migration path, but it removes the two
worst blockers (no SQL access, no verification channel) and is the right
driver seat for an agent-executed migration. **Worth adding.**

## 3. Recommended path (fastest + safest)

**Backbone: official export.** It is the only Lovable-sanctioned artifact
that includes `auth.users` with bcrypt hashes, and it's exactly the "full
Postgres dump" our runbooks were waiting for. Restoring it into an
Exotiq-owned Supabase project preserves logins (same passwords) — no forced
password-reset campaign.

**Storage: temporary token-guarded edge function.** Storage binaries
(~1,400 objects / ~350 MB as of May 30) are never in the DB dump. Hosted
edge functions are auto-injected with `SUPABASE_SERVICE_ROLE_KEY` (and
`SUPABASE_DB_URL`), and Lovable auto-deploys whatever is in
`supabase/functions/` from this repo. So: deploy a temporary function that
lists every object per bucket and returns batched signed URLs (guarded by a
strong bearer token; never expose the raw service key); download externally;
re-upload to the new project preserving bucket names and object paths;
verify counts/bytes against `raw/storage_objects_summary.csv` (refresh the
baseline via MCP first — May 30 numbers are stale). Delete the function
immediately after. This is also our **fallback for everything** if the
export button disappoints: `SUPABASE_DB_URL` connects as the `postgres` role,
which can read `auth.users` including `encrypted_password` (verified against
Supabase docs).

**Secrets: manual re-entry (unchanged from plan).** All 15 secret values are
Exotiq-owned API keys recoverable from their upstream dashboards (Stripe,
ElevenLabs, Resend, PredictHQ, PhotoRoom, Google, OpenAI). `LOVABLE_API_KEY`
is the exception — see §5.

**Cutover mechanics: unchanged.** Netlify env swap
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`) + redeploy; rollback is the reverse.

### Why not the alternatives

- **Keep waiting on support:** dominated — the export button ships the same
  artifact self-serve.
- **MCP-only migration (SQL dump via `query_database`):** workable but
  hand-rolled; the official export is more complete (sequences, cron rows,
  auth schema) and less error-prone. Use MCP SQL for verification and final
  delta checks instead.
- **Zero-downtime dual-write/replication:** massive overkill for a 37 MB DB
  with 17 users, and adds real correctness risk. A 1–2 h night freeze is the
  safer "smoothest" transition.

## 4. Execution plan

**Phase 0 — Prep (no user impact)**
1. Add Lovable MCP (+ keep Supabase MCP) to the working environment.
2. Fresh inventory via MCP: row counts per table, storage object
   counts/bytes, cron jobs, auth user count. Commit as a July baseline next
   to the May 30 one.
3. Export the two drift migrations if still unmerged; confirm repo `main` ==
   deployed functions (via `get_file_tree`/`get_diff`).
4. Trigger **export #1**; measure request→email latency (this sizes the
   cutover window); validate contents against
   `scripts/migration/validate-received-artifacts.mjs` expectations.

**Phase 1 — Staging restore + rehearsal (no user impact)**
5. Create Exotiq-owned Supabase project(s) (staging + production-target;
   region `eu-west-1` to match current latency profile).
6. Follow `STAGING_RESTORE_RUNBOOK.md`: restore dump, storage copy via the
   temp function route, secrets, deploy functions from `main`, recreate cron
   with new URLs/JWTs, point a Netlify preview at staging.
7. Run the full rehearsal gate from `MIGRATION_EXPORT_SUPPORT_CHECKLIST.md`
   §4 + RLS negative tests. Test one imported user's real login (password
   hash survival) explicitly.
8. Fix the Lovable AI Gateway dependency (§5) and merge to `main` behind an
   env-driven base URL so the same code runs pre- and post-cutover.

**Phase 2 — Cutover (one night window, 1–2 h)**
9. Freeze: announce, stop writes (17 users; in-app + team-chat notice).
10. Capture freeze-time row counts via MCP `query_database`.
11. Take **export #2** (mind the 1/24 h cadence when scheduling rehearsal
    vs. cutover; fallback for the final snapshot: direct `pg_dump` via
    `get_connection_info` if externally reachable, else MCP SQL delta check
    against export #2).
12. Restore fresh into the production-target project; final storage delta
    copy; verify counts vs. step 10.
13. Flip Netlify env vars, redeploy, run `PRODUCTION_CUTOVER_GO_NO_GO.md`
    smoke list. Update external pointers: Stripe webhooks, ElevenLabs tool
    URLs (`elevenlabs-tools-config.json` has 32 references to the old
    project), Google OAuth redirect (gcal-callback), Rari MCP consumers.
14. Unfreeze. Users re-login once (sessions invalidated by new JWT secret;
    passwords unchanged).

**Phase 3 — Decommission (weeks later)**
15. Days 1–7: monitor; leave Lovable Cloud untouched (rollback target).
16. Week 2+: **Pause Cloud** (stops drift, keeps rollback possible).
17. Day 30+: **Remove Lovable Cloud** (permanent). Optionally then use
    Lovable's "connect your own Supabase" so Lovable keeps building UI
    against the new project — **governance decision required**: that hands
    Lovable write access to our production DB again. Alternative: connect
    Lovable to a staging project/branch only, schema changes flow through
    repo migrations.

## 5. New/updated work items surfaced by this research

| Item | Detail | When |
|---|---|---|
| **Lovable AI Gateway dependency** | 10 functions (`fleet-copilot-chat`, `ai-pricing`, `ai-demand-forecast`, `ai-event-intelligence`, `identify-vehicle`, `parse-expense-receipt`, `generate-report`, `generate-hero-image`, `daily-brief-narrative`, `weekly-intelligence-digest`) call `ai.gateway.lovable.dev` with `LOVABLE_API_KEY`. Gateway access is tied to Cloud billing — assume it dies with Cloud removal. Swap to direct Gemini (OpenAI-compatible endpoint) or OpenAI; make base URL + key env-driven. | Before cutover |
| **Hardcoded old project refs** | `supabase/functions/rari-mcp-server/index.ts:585`; cron migration `20260410211848_….sql:19`; `.env`; `supabase/config.toml`; `elevenlabs-tools-config.json` (32×) | Cutover checklist |
| **JWT secret / sessions** | New project invalidates all sessions; verify `staleBuildRecovery` + auth error handling produce a clean re-login, not a broken state | Rehearsal |
| **Export cadence** | 1 export / 24 h / project — schedule rehearsal export and cutover export on separate days | Planning |
| **Remove Cloud is irreversible** | Never remove until production has been stable on the new project ≥ 30 days | Phase 3 |
| **Stale baselines** | May 30 counts (37 MB DB, 1,395 objects) predate ~7 weeks of prod usage and the identity-verification feature; refresh via MCP before restore verification | Phase 0 |
| **MCP is a research preview** | Tool names/shapes may change without notice; account-wide OAuth scope — connect from a trusted environment only | Ongoing |

## 6. Sources

- Lovable MCP official repo (tool list, credit model, transport):
  `https://github.com/lovablelabs/mcp` (README.md, commands/db.md, server.json)
- Lovable docs (indexed): `https://docs.lovable.dev/integrations/lovable-mcp-server`,
  `https://docs.lovable.dev/integrations/cloud`, `https://docs.lovable.dev/changelog`,
  `https://docs.lovable.dev/integrations/supabase`
- Release announcement: `https://x.com/Lovable/status/2052418950118650358` (2026-05-07)
- Migration skill (export contents, 24 h cadence, traps):
  `https://github.com/CarolMonroe22/lovable-cloud-to-supabase-migration` (v4.0.2, tested 2026-07-06)
- Historical lockout baseline: `https://supabase.com/docs/guides/troubleshooting/cant-access-supabase-project-lovable-cloud`
- Edge-function injected secrets incl. `SUPABASE_DB_URL`:
  `https://supabase.com/docs/guides/functions/secrets`,
  `https://supabase.com/docs/guides/functions/connect-to-postgres`,
  `https://supabase.com/docs/guides/functions/limits`
- Auth hash portability / import:
  `https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects`,
  `https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0`
  (`admin.createUser({ password_hash })`, bcrypt/Argon2 supported; known
  historical bug `supabase/auth#1678` — test-import one user first)
- Vault/realtime/cron not carried by logical dumps:
  `https://supabase.com/docs/guides/database/vault`,
  `https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore`
- Community exporters/guides: `https://github.com/dreamlit-ai/lovable-cloud-to-supabase-exporter`,
  `https://www.staticbot.dev/deployment-guides/ai-tools/lovable-supabase-migration`,
  `https://dzone.com/articles/migration-from-lovable-cloud-to-supabase-1`

**Unverified items to confirm hands-on (first MCP session):** the live MCP
tool list (`https://mcp.lovable.dev/skill.md`), whether the
`get_connection_info` connection string accepts external `pg_dump`
connections, actual export generation latency, and exact export contents for
THIS project (validate before trusting).
