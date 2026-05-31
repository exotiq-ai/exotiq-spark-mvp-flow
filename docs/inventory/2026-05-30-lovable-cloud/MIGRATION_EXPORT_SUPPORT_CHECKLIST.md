# Migration Export Support Checklist

This checklist is the support handoff for moving Exotiq from Lovable Cloud
Supabase project `jlgwbbqydjeokypoenoc` to a directly controlled Supabase
project while keeping the Netlify frontend.

Do not start production cutover from this document alone. Cutover requires a
successful restore rehearsal and staging smoke test.

## 1. Required Support Exports

Request these artifacts from Lovable/Supabase support:

- Full Postgres dump for `jlgwbbqydjeokypoenoc`, including schema, data,
  extensions, triggers, functions, policies, cron metadata, and publication
  settings.
- Auth user export including `auth.users.encrypted_password`, identities,
  provider data, MFA fields if present, and enough metadata to preserve existing
  login continuity.
- Storage export for all buckets, with object paths, metadata, content types,
  and binaries:
  - `vehicle-photos`
  - `customer-documents`
  - `dashboard-banners`
  - `user-avatars`
  - `expense-receipts`
  - `damage-photos`
  - `message-attachments`
- Auth configuration snapshot:
  - Site URL
  - Redirect allowlist
  - JWT expiry/settings
  - Email templates
  - SMTP/provider settings
  - Enabled auth providers
- Backup/PITR option:
  - Confirm whether Lovable/Supabase can restore a recent backup into a new
    external Supabase project controlled by Exotiq.
- Edge function secret transfer list:
  - Support must not commit secret values to GitHub.
  - Secret values should be transferred directly into the new Supabase project
    and Netlify environment variables.

## 2. Default Restore Path

Preferred path:

1. Create a new direct Supabase project controlled by Exotiq.
2. Restore the full DB dump into the new project.
3. Import auth users with password hashes and identities intact.
4. Upload all storage bucket objects with the same bucket names and object paths.
5. Apply secrets manually to the new project.
6. Recreate cron jobs with the new project URL and anon key.
7. Deploy edge functions from GitHub `main` after migration hygiene and function
   config PRs are merged.
8. Point a Netlify staging deploy at the new Supabase URL and anon key.
9. Run the full staging smoke test before touching production DNS or production
   Netlify environment variables.

## 3. Fallback Paths

If auth password hashes cannot be exported:

- Import users by email only.
- Send a forced password-reset campaign before cutover.
- Keep Lovable project available until the reset flow is verified.
- Warn users in advance that they may need to set a new password.

If bulk storage export is unavailable:

- Copy objects bucket-by-bucket through signed URLs or a service-role API script.
- Preserve exact object paths wherever possible.
- Compare object count and total bytes per bucket against
  `raw/storage_objects_summary.csv`.
- Spot-check customer documents, vehicle photos, dashboard banners, and avatars.

If a full DB dump cannot be provided:

- Stop the direct migration path.
- Escalate support request before attempting API/CSV table copying.
- Do not run production cutover from partial CSV exports unless product accepts
  higher downtime and data-loss risk in writing.

## 4. Rehearsal Test Gate

Run this against a new staging Supabase project before production cutover:

- Compare table counts against inventory `raw/tables.csv`.
- Compare auth user count against the inventory report.
- Compare storage object counts and bytes against
  `raw/storage_objects_summary.csv`.
- Verify key data spot checks:
  - vehicles
  - bookings
  - customers
  - payments
  - documents
  - vehicle photos
  - team members
  - role audit logs
- Run app smoke tests from a Netlify staging deploy:
  - login, logout, password reset
  - dashboard load
  - booking create, edit, cancel/conflict check
  - CRM customer create
  - document upload, preview, download
  - vehicle photo display and upload
  - Stripe test-mode checkout/connect paths
  - Rari booking lookup
  - notifications and team messaging realtime flows

## 5. Production Cutover Rules

- Schedule cutover in a low-traffic night window.
- Freeze schema and feature work during the final export/restore window.
- Keep the Lovable Supabase project untouched until the new stack passes
  production smoke.
- Rollback is Netlify environment-variable reversal:
  - Restore old `VITE_SUPABASE_URL`.
  - Restore old `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Redeploy Netlify production.
- Do not delete or disconnect Lovable Cloud immediately after cutover.
  Keep it as rollback reference until backups and monitoring on the new project
  are verified.

## 6. Open Items Before Cutover

- Migration hygiene, Edge Function config cleanup, and Security/RLS remediation
  are merged to GitHub `main` as of commit `8b23f4e`.
- Reissue cron job anon JWTs for the new Supabase project.
- Confirm all function secrets and Netlify `VITE_*` variables are set in the new
  environments.
- Receive and validate the full export package from Lovable/Supabase support.
- Complete the staging restore rehearsal against the direct Supabase project.
- Document the final go/no-go checklist after the restore rehearsal.
