ALTER TABLE public.hero_render_jobs ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_hero_render_jobs_vehicle_active ON public.hero_render_jobs(vehicle_id) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.super_admin_reset_studio_hero(_vehicle_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;
  UPDATE public.hero_render_jobs SET archived_at = now()
   WHERE vehicle_id = _vehicle_id AND archived_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.super_admin_reset_studio_hero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_reset_studio_hero(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_studio_hero_status(_team_id uuid)
RETURNS TABLE(vehicle_id uuid, label text, attempts integer, last_status text, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;
  RETURN QUERY
  SELECT v.id, trim(coalesce(v.year::text,'') || ' ' || coalesce(v.make,'') || ' ' || coalesce(v.model,'')),
         count(j.id)::int,
         (array_agg(j.status ORDER BY j.created_at DESC))[1]::text,
         max(j.created_at)
    FROM public.vehicles v
    JOIN public.hero_render_jobs j ON j.vehicle_id = v.id AND j.archived_at IS NULL
   WHERE v.team_id = _team_id
   GROUP BY v.id, v.year, v.make, v.model
   ORDER BY max(j.created_at) DESC;
END $$;
REVOKE ALL ON FUNCTION public.super_admin_studio_hero_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_studio_hero_status(uuid) TO authenticated;