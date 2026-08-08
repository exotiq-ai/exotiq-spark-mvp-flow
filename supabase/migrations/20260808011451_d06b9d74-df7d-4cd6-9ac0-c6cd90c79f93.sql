CREATE TABLE public.support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  admin_email text,
  reason text NOT NULL,
  home_team_id uuid,
  created_membership boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ended_reason text
);

CREATE INDEX idx_support_grants_admin_active ON public.support_access_grants (admin_user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_support_grants_team ON public.support_access_grants (team_id, granted_at DESC);

GRANT SELECT ON public.support_access_grants TO authenticated;
GRANT ALL ON public.support_access_grants TO service_role;

ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view support grants"
ON public.support_access_grants FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Team admins can view their support history"
ON public.support_access_grants FOR SELECT TO authenticated
USING (public.is_team_admin(auth.uid(), team_id));

-- Start a time-boxed support session on a tenant
CREATE OR REPLACE FUNCTION public.start_support_session(_team_id uuid, _reason text, _hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _home_team uuid;
  _existing boolean;
  _grant_id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'Only super admins can start a support session';
  END IF;
  IF _hours NOT IN (2, 8, 24) THEN
    RAISE EXCEPTION 'Session duration must be 2, 8 or 24 hours';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required to start a support session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Close out any session already running for this admin
  PERFORM public.end_support_session(NULL, 'superseded');

  SELECT email INTO _email FROM public.super_admins WHERE user_id = _uid LIMIT 1;

  SELECT team_id INTO _home_team
  FROM public.team_members
  WHERE user_id = _uid AND is_active = true
  LIMIT 1;

  IF _home_team = _team_id THEN
    RAISE EXCEPTION 'You are already working in this account';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE user_id = _uid AND team_id = _team_id
  ) INTO _existing;

  UPDATE public.team_members SET is_active = false WHERE user_id = _uid AND is_active = true;

  INSERT INTO public.team_members (team_id, user_id, role, is_active, invited_by)
  VALUES (_team_id, _uid, 'admin', true, _uid)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET is_active = true;

  INSERT INTO public.support_access_grants
    (team_id, admin_user_id, admin_email, reason, home_team_id, created_membership, expires_at)
  VALUES
    (_team_id, _uid, _email, btrim(_reason), _home_team, NOT _existing, now() + make_interval(hours => _hours))
  RETURNING id INTO _grant_id;

  INSERT INTO public.role_audit_log (user_id, changed_by, action, team_id, metadata)
  VALUES (_uid, _uid, 'support_session_start', _team_id,
          jsonb_build_object('reason', btrim(_reason), 'hours', _hours, 'grant_id', _grant_id));

  RETURN _grant_id;
END;
$$;

-- End the caller's active support session (or a specific one)
CREATE OR REPLACE FUNCTION public.end_support_session(_grant_id uuid DEFAULT NULL, _ended_reason text DEFAULT 'manual')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _g record;
  _count integer := 0;
BEGIN
  IF _uid IS NULL OR NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'Only super admins can end a support session';
  END IF;

  FOR _g IN
    SELECT * FROM public.support_access_grants
    WHERE admin_user_id = _uid
      AND revoked_at IS NULL
      AND (_grant_id IS NULL OR id = _grant_id)
  LOOP
    IF _g.created_membership THEN
      DELETE FROM public.team_members WHERE user_id = _uid AND team_id = _g.team_id;
    ELSE
      UPDATE public.team_members SET is_active = false WHERE user_id = _uid AND team_id = _g.team_id;
    END IF;

    IF _g.home_team_id IS NOT NULL THEN
      UPDATE public.team_members SET is_active = true
      WHERE user_id = _uid AND team_id = _g.home_team_id;
    END IF;

    UPDATE public.support_access_grants
    SET revoked_at = now(), ended_reason = _ended_reason
    WHERE id = _g.id;

    INSERT INTO public.role_audit_log (user_id, changed_by, action, team_id, metadata)
    VALUES (_uid, _uid, 'support_session_end', _g.team_id,
            jsonb_build_object('grant_id', _g.id, 'ended_reason', _ended_reason));

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Current session for the caller; self-heals expired sessions
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
    SELECT 1 FROM public.support_access_grants
    WHERE admin_user_id = _uid AND revoked_at IS NULL AND expires_at <= now()
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

REVOKE ALL ON FUNCTION public.start_support_session(uuid, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.end_support_session(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.get_active_support_session() FROM public;
GRANT EXECUTE ON FUNCTION public.start_support_session(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_support_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_support_session() TO authenticated;