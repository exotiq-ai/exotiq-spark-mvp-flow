# Lovable/Supabase Export Request

This request is for migrating Exotiq from the Lovable Cloud Supabase project
`jlgwbbqydjeokypoenoc` into a directly controlled Supabase project.

Production must remain on the Lovable project until a restore rehearsal passes.

## Required Artifacts

Please provide these artifacts without modifying the live project:

1. Full Postgres dump
   - Include schema, data, extensions, triggers, functions, policies, cron
     metadata, publication settings, and any non-public schemas required for
     restore.
   - Preferred format: compressed `pg_dump` custom format plus restore command
     notes.

2. Auth export
   - Include `auth.users.encrypted_password`, identities, provider data, MFA
     fields if present, user metadata, and timestamps.
   - State clearly if password hashes cannot be exported.

3. Storage export
   - Include object paths, metadata, content types, and binaries for every
     bucket.
   - Critical buckets: `vehicle-photos`, `customer-documents`,
     `dashboard-banners`, `user-avatars`, `expense-receipts`, `damage-photos`,
     and `message-attachments`.

4. Auth configuration snapshot
   - Site URL, redirect allowlist, JWT settings, email templates,
     SMTP/provider settings, and enabled auth providers.

5. Cron jobs
   - Include job names, schedules, active flags, SQL/HTTP commands, target
     function URLs, and required auth headers.
   - Confirm whether duplicate notification purge jobs should both survive.

6. Backup/PITR statement
   - Confirm whether a recent backup can be restored into an external Supabase
     project controlled by Exotiq.

7. Secret transfer list
   - Provide secret names and transfer secret values out of band.
   - Do not place secret values in GitHub, documents, CSV files, or chat.

## Fallback Decisions

- If auth password hashes cannot be exported, the migration fallback is email
  import plus a forced password-reset campaign.
- If bulk storage export is unavailable, the fallback is bucket-by-bucket API
  copy with object count and byte-total verification.
- If a full DB dump cannot be provided, pause the migration and escalate. Do not
  cut over production from partial CSV exports.

## Destination Context

- Frontend host remains Netlify.
- Staging restore target is the direct Supabase staging project controlled by
  Exotiq.
- Production Netlify environment variables must not change until cutover.

