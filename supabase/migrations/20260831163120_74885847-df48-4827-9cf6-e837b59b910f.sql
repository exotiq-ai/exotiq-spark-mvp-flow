
-- Helper: can this user delete a stored vehicle-photo file, based on the owning workspace
-- of the vehicle_photos / unmatched_photos record that references it?
CREATE OR REPLACE FUNCTION public.can_delete_vehicle_photo_object(_user_id uuid, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_photos vp
    WHERE vp.storage_path IS NOT NULL
      AND (vp.storage_path = _object_name
           OR regexp_replace(vp.storage_path, '\.[^.]+$', '_thumb.jpg') = _object_name)
      AND (
        vp.user_id = _user_id
        OR public.is_super_admin(_user_id)
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.user_id = _user_id
            AND tm.team_id = vp.team_id
            AND tm.is_active = true
            AND tm.role IN ('owner','admin','manager')
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.unmatched_photos up
    WHERE up.storage_path IS NOT NULL
      AND (up.storage_path = _object_name
           OR regexp_replace(up.storage_path, '\.[^.]+$', '_thumb.jpg') = _object_name)
      AND (
        up.user_id = _user_id
        OR public.is_super_admin(_user_id)
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.user_id = _user_id
            AND tm.team_id = up.team_id
            AND tm.is_active = true
            AND tm.role IN ('owner','admin','manager')
        )
      )
  );
$$;

-- vehicle_photos: team-scoped delete instead of uploader-only
DROP POLICY IF EXISTS "Users can delete own vehicle photos" ON public.vehicle_photos;

CREATE POLICY "Team managers can delete vehicle photos"
  ON public.vehicle_photos FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.team_id = vehicle_photos.team_id
        AND tm.is_active = true
        AND tm.role IN ('owner','admin','manager')
    )
  );

-- unmatched_photos: same pattern
DROP POLICY IF EXISTS "Users can delete own unmatched photos" ON public.unmatched_photos;

CREATE POLICY "Team managers can delete unmatched photos"
  ON public.unmatched_photos FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.team_id = unmatched_photos.team_id
        AND tm.is_active = true
        AND tm.role IN ('owner','admin','manager')
    )
  );

-- storage: allow deleting the underlying file when the referencing record's workspace matches
DROP POLICY IF EXISTS "Uploaders and team managers can delete vehicle photos" ON storage.objects;

CREATE POLICY "Uploaders and team managers can delete vehicle photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (
      public.can_manage_team_or_user_storage_path(auth.uid(), name)
      OR public.can_delete_vehicle_photo_object(auth.uid(), name)
    )
  );
