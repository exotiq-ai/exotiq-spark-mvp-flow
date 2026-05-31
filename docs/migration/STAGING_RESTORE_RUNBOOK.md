# Staging Restore Runbook

Use this only after the export package is received and validated. Production
must remain pointed at Lovable Supabase during this runbook.

## Phase 1: Pre-Restore Safety

- Confirm target is a direct Supabase staging project, not production.
- Confirm Netlify production env vars are unchanged.
- Store service-role credentials outside the repo.
- Confirm artifact validation passed or each fallback is explicitly approved.

## Phase 2: Restore Order

1. Restore the full Postgres dump into staging.
2. Import auth users with password hashes and identities.
3. Upload storage objects with original bucket names and object paths.
4. Apply Edge Function secrets in staging.
5. Deploy Edge Functions from GitHub `main`.
6. Recreate cron jobs with staging URLs and staging anon JWTs.
7. Point Netlify staging/preview env vars at staging Supabase.

## Phase 3: Integrity Checks

- Compare table row counts against `raw/tables.csv`.
- Compare auth user count against the support export.
- Compare storage object counts and byte totals against
  `raw/storage_objects_summary.csv`.
- Spot-check vehicles, bookings, customers, payments, documents, vehicle photos,
  team members, role audit logs, and user activity logs.
- Confirm migration history includes the canonical merged migrations.

## Phase 4: Security And App Smoke

- Team A cannot access Team B customer documents, message attachments, customer
  PII, invitations, roles, profiles, messages, comments, activity logs, or audit
  logs.
- Same-team owner/admin/manager workflows still work.
- Dashboard, bookings, fleet, vault, CRM, Rari, notifications, and team messages
  load from Netlify staging.
- Stripe checks use test mode only.

## Stop Conditions

Stop and document before proceeding if:

- The DB dump is partial or fails restore.
- Auth users cannot be imported and password-reset fallback has not been
  approved.
- Storage object paths cannot be preserved.
- Same-team workflows are blocked by RLS.
- Cross-team negative tests fail.
- Any cron job points to production by mistake.

