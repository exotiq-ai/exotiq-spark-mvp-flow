-- M2 security hardening (remaining 2 of 6 inventory findings).
-- Ref: docs/inventory/2026-05-30-lovable-cloud/REPORT.md §8 findings 5 and 6.
-- Findings 1-4 were fixed in 20260530203000_harden_tenant_rls_policies.sql;
-- this migration reuses the storage-path helper functions it created.

-- ---------------------------------------------------------------------
-- Finding 5: vehicle-photos bucket policies are keyed to the uploader
-- (auth.uid() = first path folder), so teammates cannot read each other's
-- photos, which forced public-URL workarounds. Objects are stored under
-- <user_id>/<folder>/<file> (src/lib/photoUpload.ts), so team access is
-- resolved through is_same_team()/is_team_member() via the shared helpers.
-- This widens SELECT to teammates and managers; it does not narrow any
-- existing access, so no frontend change is required.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own vehicle photos" ON storage.objects;

CREATE POLICY "Team members can view vehicle photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND public.can_read_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Team members can upload vehicle photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND public.can_write_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Uploaders and team managers can update vehicle photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
)
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Uploaders and team managers can delete vehicle photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
);

-- ---------------------------------------------------------------------
-- Finding 6: stripe_webhook_events has RLS enabled with zero policies.
-- Writes come from edge functions using the service role (bypasses RLS),
-- which stays unchanged. Add an explicit super-admin-only SELECT so the
-- table is inspectable for support/debugging without opening it to
-- tenant users (payloads can contain payment metadata).
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admins can view stripe webhook events" ON public.stripe_webhook_events;

CREATE POLICY "Super admins can view stripe webhook events"
ON public.stripe_webhook_events FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
