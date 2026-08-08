CREATE OR REPLACE FUNCTION public.get_active_support_session()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  team_name text,
  reason text,
  granted_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.is_super_admin(_uid) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.support_access_grants sg
    WHERE sg.admin_user_id = _uid AND sg.revoked_at IS NULL AND sg.expires_at <= now()
  ) THEN
    PERFORM public.end_support_session(NULL, 'expired');
  END IF;

  RETURN QUERY
  SELECT g.id, g.team_id, t.name, g.reason, g.granted_at, g.expires_at
  FROM public.support_access_grants g
  JOIN public.teams t ON t.id = g.team_id
  WHERE g.admin_user_id = _uid AND g.revoked_at IS NULL AND g.expires_at > now()
  ORDER BY g.granted_at DESC
  LIMIT 1;
END;
$$;