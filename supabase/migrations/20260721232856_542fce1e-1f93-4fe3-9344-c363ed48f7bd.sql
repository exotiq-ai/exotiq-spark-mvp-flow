ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS marketplace_request_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS marketplace_requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS marketplace_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS marketplace_rejection_reason text;

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_marketplace_request_status_check;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_marketplace_request_status_check
  CHECK (marketplace_request_status IN ('none', 'requested', 'approved', 'rejected'));

-- Backfill existing visible teams so they remain live after the new rule is applied.
UPDATE public.teams
SET marketplace_request_status = 'approved',
    marketplace_reviewed_at = COALESCE(marketplace_reviewed_at, now()),
    marketplace_reviewed_by = COALESCE(marketplace_reviewed_by, owner_id)
WHERE marketplace_visible = true
  AND marketplace_request_status = 'none';

-- Marketplace eligibility now requires an approved request in addition to the visible flag.
CREATE OR REPLACE FUNCTION public.is_marketplace_team(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND t.marketplace_visible = true
      AND t.marketplace_request_status = 'approved'
      AND coalesce(t.is_demo_account, false) = false
      AND coalesce(t.is_deleted, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_marketplace_vehicle(_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = _vehicle_id
      AND v.marketplace_visible = true
      AND v.status IN ('available', 'booked')
      AND v.archived_at IS NULL
      AND v.trashed_at IS NULL
      AND v.team_id IS NOT NULL
      AND public.is_marketplace_team(v.team_id)
  );
$$;

-- Tenant request: team owners/admins can request inclusion from none or rejected.
CREATE OR REPLACE FUNCTION public.request_marketplace_inclusion(_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_team_owner(auth.uid(), _team_id)
     AND NOT public.is_team_admin(auth.uid(), _team_id) THEN
    RAISE EXCEPTION 'Only team owners or admins can request marketplace inclusion';
  END IF;

  UPDATE public.teams
  SET marketplace_request_status = 'requested',
      marketplace_requested_at = now(),
      marketplace_reviewed_at = NULL,
      marketplace_reviewed_by = NULL,
      marketplace_rejection_reason = NULL
  WHERE id = _team_id
    AND marketplace_request_status IN ('none', 'rejected');

  RETURN FOUND;
END;
$$;

-- Super admin approve: optionally sets marketplace_visible at the same time.
CREATE OR REPLACE FUNCTION public.approve_marketplace_request(_team_id uuid, _visible boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can approve marketplace requests';
  END IF;

  UPDATE public.teams
  SET marketplace_request_status = 'approved',
      marketplace_reviewed_at = now(),
      marketplace_reviewed_by = auth.uid(),
      marketplace_visible = COALESCE(_visible, true)
  WHERE id = _team_id;

  RETURN FOUND;
END;
$$;

-- Super admin reject: records reason and ensures visibility is off.
CREATE OR REPLACE FUNCTION public.reject_marketplace_request(_team_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can reject marketplace requests';
  END IF;

  UPDATE public.teams
  SET marketplace_request_status = 'rejected',
      marketplace_reviewed_at = now(),
      marketplace_reviewed_by = auth.uid(),
      marketplace_rejection_reason = _reason,
      marketplace_visible = false
  WHERE id = _team_id;

  RETURN FOUND;
END;
$$;

-- Maintain broad public access to eligibility checks (already PUBLIC).
GRANT EXECUTE ON FUNCTION public.is_marketplace_team(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_marketplace_vehicle(uuid) TO PUBLIC;

-- Authenticated users can call request/approve/reject; actual authorization is enforced inside the functions.
GRANT EXECUTE ON FUNCTION public.request_marketplace_inclusion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketplace_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_marketplace_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_marketplace_inclusion(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_marketplace_request(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_marketplace_request(uuid, text) TO service_role;
