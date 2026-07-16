DROP POLICY IF EXISTS "Users can view own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders and team managers can update vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders and team managers can delete vehicle photos" ON storage.objects;

CREATE POLICY "Team members can view vehicle photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vehicle-photos' AND public.can_read_team_or_user_storage_path(auth.uid(), name));

CREATE POLICY "Team members can upload vehicle photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vehicle-photos' AND public.can_write_team_or_user_storage_path(auth.uid(), name));

CREATE POLICY "Uploaders and team managers can update vehicle photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vehicle-photos' AND public.can_manage_team_or_user_storage_path(auth.uid(), name))
WITH CHECK (bucket_id = 'vehicle-photos' AND public.can_manage_team_or_user_storage_path(auth.uid(), name));

CREATE POLICY "Uploaders and team managers can delete vehicle photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vehicle-photos' AND public.can_manage_team_or_user_storage_path(auth.uid(), name));

DROP POLICY IF EXISTS "Super admins can view stripe webhook events" ON public.stripe_webhook_events;

CREATE POLICY "Super admins can view stripe webhook events"
ON public.stripe_webhook_events FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));