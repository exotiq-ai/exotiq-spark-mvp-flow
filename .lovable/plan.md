# Phase 1.5 Compliance Build — Safe & High-Impact

**Status:** THE PLAN (supersedes the ranked list in `docs/compliance/NEXT_STEPS.md` §4).
**Constraint:** zero behavior change for existing customers. Everything new is additive, owner-only, or dry-run by default. Gated behind `featureFlags.complianceEuUk` where user-visible.

---

## Why these four

From the 11 items in NEXT_STEPS §4, these are the ones that (a) close a real regulator-visible gap, (b) can ship without touching any existing user flow, and (c) don't require attorney-drafted text to be useful.

Deferred to a later pass: cookie-consent v2 (touches every page's first paint — needs design review), counsel privacy-notice rendering (waiting on the narrowing edits in NEXT_STEPS §3.5), EU/UK rep field (waiting on appointment), UAE phase 2.

---

## 1. Retention enforcement — dry-run first

**Gap:** every retention period in our privacy notice is currently a policy promise with no executor. Highest legal exposure per dev hour.

**Build:**
- New edge function `retention-sweeper` (scheduled daily at 03:00 UTC via `pg_cron` + `pg_net`).
- Reads `retention_policies`; for each `(entity, retention_days)` pair, finds rows older than the window.
- **Two modes via `retention_policies.enforcement_mode` column (new):**
  - `dry_run` (default for every existing row) — writes a `retention_sweep_log` entry showing what *would* be deleted, deletes nothing.
  - `enforce` — soft-deletes (sets `deleted_at`) on tables that have it, hard-deletes on append-only logs past their floor.
- Owner-only Settings → Legal panel surfaces the last 7 sweep reports with row counts per entity. Owner flips to `enforce` per-entity only after reviewing a dry-run report.
- Legal-floor exceptions (tax/AML/consent ledger) hard-coded as a deny-list inside the function; cannot be overridden from UI.

**Safety:** dry-run default means turning the job on deletes nothing. Enforce requires an explicit owner action per entity.

---

## 2. DSR export edge function

**Gap:** `data_subject_requests` table exists with no executor; GDPR Art. 15/20 unmet.

**Build:**
- New edge function `dsr-export` accepting `{ request_id }` from an authorized owner.
- Schema-walker: introspects `information_schema` for FKs to `customers.id` and `profiles.id`, then `SELECT *` from each table filtered by the data subject's id AND `team_id = caller.team_id` (tenant safety belt — prevents cross-tenant leak even if a FK is misconfigured).
- Pulls Storage objects from `inspection-photos`, `documents`, `vehicle-photos` buckets where the row is owned by the subject.
- Emits a single ZIP: `manifest.json` (table → row count, generated timestamp, request id), one `<table>.json` per table, `storage/<bucket>/<object>` for files.
- Uploads ZIP to a private `dsr-exports` Storage bucket, signed URL valid 7 days, link returned to requester.
- `data_subject_requests.fulfilled_at` + `export_url` columns added.
- Owner UI: existing Settings → Legal → DSR list gets a "Generate export" button per request.

**Safety:** read-only on every existing table; only writes to `data_subject_requests` (status fields) and a new bucket.

---

## 3. Read-side audit logging on renter PII

**Gap:** writes are logged across 4 tables; **reads of renter PII have no audit trail** — flagged in NEXT_STEPS §3.2.

**Build:**
- Postgres `SECURITY DEFINER` function `log_pii_read(p_entity text, p_record_id uuid, p_fields text[])` that inserts into existing `data_access_log` (no new table).
- Wrap four high-sensitivity read paths with a thin RPC: `get_customer_full`, `get_document`, `get_inspection_photo_meta`, `get_rari_message`. Existing direct-`SELECT` callers keep working — these new RPCs are opt-in, used by:
  - Anywhere we render full renter PII in a dialog (CustomerDetailsDialog, CheckInOutDialog reviewer view).
  - DSR export function (so the export action itself is logged).
- Owner-only audit viewer in Settings → Legal → "Access log" — searchable by user, entity, date range, last 90 days.

**Safety:** purely additive RPCs. No existing query is rewritten. Hooks are switched over incrementally; if a hook isn't migrated, behavior is unchanged.

---

## 4. Sub-processor registry reconciliation

**Gap:** NEXT_STEPS §3.3 — `subProcessors.ts` may be stale vs. actually-integrated vendors.

**Build (pure docs/data, zero runtime risk):**
- Grep the codebase + edge functions for outbound vendor SDK/API calls (`twilio`, `resend`, `gohighlevel`/`ghl`, telematics provider names, `elevenlabs`, etc.).
- Produce `docs/compliance/sub-processor-reconciliation.md` listing each detected vendor, the file:line where it's called, and whether it's in `subProcessors.ts` / `sub_processors` table.
- Update `SUB_PROCESSORS` registry + seed migration with any missing-but-active vendors, and mark `status: "retired"` (not delete) for any listed-but-unused vendors.
- DPA page already reads from this registry, so the public-facing list refreshes automatically.

**Safety:** registry is reference data surfaced in legal pages; not in any control flow.

---

## What stays untouched

- Existing edge functions (already instrumented with `transferGuard` last cycle — no further edits).
- All booking/fleet/messaging flows.
- `terms_acceptances` schema (consent ledger already adequate).
- Cookie banner (deferred — needs UX pass).
- Counsel-drafted privacy notice rendering (deferred — text needs narrowing per NEXT_STEPS §3.5).

---

## Technical sketch

### New migrations (one file)
- `retention_policies`: add `enforcement_mode text default 'dry_run' check (enforcement_mode in ('dry_run','enforce','disabled'))`.
- New table `retention_sweep_log` (entity, would_delete_count, deleted_count, dry_run boolean, ran_at, error). Owner-read-only via `has_role(auth.uid(),'owner')`.
- `data_subject_requests`: add `fulfilled_at timestamptz`, `export_url text`, `export_expires_at timestamptz`.
- New Storage bucket `dsr-exports` (private, owner-only read via signed URL).
- New RPCs: `get_customer_full`, `get_document`, `get_inspection_photo_meta`, `get_rari_message`, `log_pii_read`. All `SECURITY DEFINER`, all enforce `team_id = (select team_id from team_members where user_id = auth.uid())`.
- All migrations follow the public-schema GRANT rule.

### New edge functions
- `supabase/functions/retention-sweeper/index.ts` — cron-invoked, service-role only (no JWT). Deny-list inside the file.
- `supabase/functions/dsr-export/index.ts` — owner-JWT validated via `getClaims()`, calls `has_role(uid,'owner')`.

### Cron job
- Daily 03:00 UTC `retention-sweeper` via `pg_cron` + `pg_net` (uses the `supabase--insert` workflow per the scheduled-jobs rule — keeps the anon-key URL out of migrations).

### Frontend (additive only)
- `src/components/dashboard/settings/ComplianceSection.tsx` gains three accordion panels:
  - "Retention sweeps" — last 7 reports, per-entity `dry_run ↔ enforce` toggle (owner only).
  - "Data subject requests" — list with "Generate export" button.
  - "Access log" — paginated table, last 90 days.
- All gated behind `featureFlags.complianceEuUk` (already exists and currently true).

### Tests
- Deno tests for `retention-sweeper` deny-list and dry-run-by-default.
- Deno tests for `dsr-export` cross-tenant guard (synthetic two-team fixture).
- Vitest for the new owner-only panels (visibility gating).

---

## Rollout

1. Migrations + RPCs land first (no behavior change — nothing calls the new RPCs yet).
2. Edge functions deploy, both in dry-run / read-only modes.
3. Cron scheduled — first sweep populates `retention_sweep_log` with zero deletions.
4. UI panels surface — owner can inspect dry-run reports before flipping anything to enforce.
5. Sub-processor reconciliation doc + registry update lands as a separate commit (docs-only change).

No existing customer sees anything different until an owner opens Settings → Legal. Nothing is deleted until an owner explicitly flips a per-entity toggle to `enforce`.

---

## Out of scope (explicit)

- Hard-deletion executor for DSR erasure requests (need a design pass on cascade rules + Stripe-side deletion API — separate plan).
- Counsel-drafted privacy notice React pages (waiting on text narrowing).
- UAE phase 2.
- Cookie consent v2.

These remain in `NEXT_STEPS.md` and are the next plan after this one ships.
