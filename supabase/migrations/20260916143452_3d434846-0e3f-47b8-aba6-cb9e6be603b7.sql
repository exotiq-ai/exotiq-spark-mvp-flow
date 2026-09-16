REVOKE EXECUTE ON FUNCTION public.publish_eligible_team_vehicles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vehicle_is_marketplace_eligible(uuid) FROM PUBLIC, anon;

-- Membership guard: a signed-in caller may only publish inside their own team.
CREATE OR REPLACE FUNCTION public.publish_eligible_team_vehicles(_team_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_count int := 0;
BEGIN
  -- Direct calls from a signed-in user must target their own team. Internal
  -- trigger calls run with auth.uid() NULL and are already scoped by the row.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
     WHERE tm.team_id = _team_id
       AND tm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  SELECT marketplace_visible, platform_fee_confirmed_at, platform_fee_percent
    INTO v_team
    FROM public.teams
   WHERE id = _team_id;

  IF NOT FOUND
     OR v_team.marketplace_visible IS NOT TRUE
     OR v_team.platform_fee_confirmed_at IS NULL
     OR COALESCE(v_team.platform_fee_percent, 0) <= 0 THEN
    RETURN 0;
  END IF;

  WITH published AS (
    UPDATE public.vehicles v
       SET marketplace_visible = true
     WHERE v.team_id = _team_id
       AND v.marketplace_visible IS FALSE
       AND v.marketplace_unlisted IS FALSE
       AND v.marketplace_visibility_set_by_tenant IS NULL
       AND public.vehicle_is_marketplace_eligible(v.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM published;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_eligible_team_vehicles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_eligible_team_vehicles(uuid) TO authenticated, service_role;