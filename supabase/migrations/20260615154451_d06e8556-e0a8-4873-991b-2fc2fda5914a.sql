-- Exotiq compliance bucket: super-admin read only, service-role write only.
CREATE POLICY "Super admins read exotiq-compliance"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exotiq-compliance'
    AND public.is_super_admin(auth.uid())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated => service role only via GRANT.
