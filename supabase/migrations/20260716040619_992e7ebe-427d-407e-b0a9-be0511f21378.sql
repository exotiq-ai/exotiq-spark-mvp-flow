
-- =========================================================================
-- Marketplace readiness gate (workstream 2)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_marketplace_readiness(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_owner_email text;
  v_terms_ok boolean;
  v_vehicle_checks jsonb;
  v_ready_vehicle_count int;
  v_team_checks jsonb;
  v_all_ok boolean;
BEGIN
  SELECT id, name, logo_url, public_description, business_address, owner_id,
         stripe_charges_enabled, stripe_payouts_enabled, is_demo_account, marketplace_visible
    INTO v_team
    FROM public.teams
   WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'team_not_found');
  END IF;

  SELECT email INTO v_owner_email FROM public.profiles WHERE id = v_team.owner_id;

  SELECT EXISTS (
    SELECT 1 FROM public.terms_acceptances
     WHERE team_id = p_team_id
       AND user_id = v_team.owner_id
       AND event_type IN ('accept','accepted','acceptance')
  ) INTO v_terms_ok;

  -- Per-vehicle checks: compute for every non-archived vehicle on the team.
  WITH v AS (
    SELECT
      veh.id,
      veh.year, veh.make, veh.model,
      veh.status,
      veh.marketplace_visible,
      veh.current_rate,
      veh.location_id,
      veh.archived_at,
      veh.trashed_at,
      (SELECT count(*) FROM public.vehicle_photos vp
        WHERE vp.vehicle_id = veh.id AND vp.is_visible IS NOT FALSE) AS photo_count
      FROM public.vehicles veh
     WHERE veh.team_id = p_team_id
       AND veh.archived_at IS NULL
       AND veh.trashed_at IS NULL
  ),
  scored AS (
    SELECT
      v.*,
      jsonb_build_object(
        'photos_min_5', (v.photo_count >= 5),
        'rate_set',     (v.current_rate IS NOT NULL AND v.current_rate > 0),
        'location_set', (v.location_id IS NOT NULL),
        'status_available', (v.status = 'available'),
        'not_archived', true
      ) AS checks
    FROM v
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'label', concat_ws(' ', year::text, make, model),
        'marketplace_visible', marketplace_visible,
        'checks', checks,
        'ready', (
          (checks->>'photos_min_5')::boolean
          AND (checks->>'rate_set')::boolean
          AND (checks->>'location_set')::boolean
          AND (checks->>'status_available')::boolean
        )
      )
      ORDER BY make, model
    ),
    count(*) FILTER (
      WHERE marketplace_visible
        AND (checks->>'photos_min_5')::boolean
        AND (checks->>'rate_set')::boolean
        AND (checks->>'location_set')::boolean
        AND (checks->>'status_available')::boolean
    )
  INTO v_vehicle_checks, v_ready_vehicle_count
  FROM scored;

  v_team_checks := jsonb_build_object(
    'stripe_charges_enabled', COALESCE(v_team.stripe_charges_enabled, false),
    'stripe_payouts_enabled', COALESCE(v_team.stripe_payouts_enabled, false),
    'logo_set',               (v_team.logo_url IS NOT NULL AND length(v_team.logo_url) > 0),
    'business_name_set',      (v_team.name IS NOT NULL AND length(v_team.name) > 0),
    'business_address_set',   (v_team.business_address IS NOT NULL AND v_team.business_address <> '{}'::jsonb),
    'owner_email_set',        (v_owner_email IS NOT NULL AND length(v_owner_email) > 0),
    'terms_accepted',         COALESCE(v_terms_ok, false),
    'not_demo',               NOT COALESCE(v_team.is_demo_account, false),
    'has_ready_vehicle',      (v_ready_vehicle_count > 0)
  );

  SELECT bool_and(value::boolean) INTO v_all_ok
    FROM jsonb_each_text(v_team_checks);

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'ready', COALESCE(v_all_ok, false),
    'team_checks', v_team_checks,
    'vehicles', COALESCE(v_vehicle_checks, '[]'::jsonb),
    'ready_vehicle_count', v_ready_vehicle_count,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_readiness(uuid) TO service_role;

-- Enforcement trigger. Fires only when the session flag
-- app.marketplace_gate_enforced = 'on' is set. This lets us ship the UI
-- first and enable enforcement globally after we verify no visible team
-- would regress.
CREATE OR REPLACE FUNCTION public.enforce_marketplace_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate text;
  v_override text;
  v_readiness jsonb;
BEGIN
  -- Only care when flipping visibility ON.
  IF NEW.marketplace_visible IS NOT TRUE OR OLD.marketplace_visible IS TRUE THEN
    RETURN NEW;
  END IF;

  v_gate := current_setting('app.marketplace_gate_enforced', true);
  IF v_gate IS NULL OR v_gate <> 'on' THEN
    RETURN NEW; -- gate not enforced yet
  END IF;

  v_override := current_setting('app.marketplace_gate_override_reason', true);
  IF v_override IS NOT NULL AND length(v_override) > 0
     AND public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    -- Super admin override; readiness bypassed. The reason is expected
    -- to also be recorded via log_admin_action by the caller.
    RETURN NEW;
  END IF;

  v_readiness := public.get_marketplace_readiness(NEW.id);
  IF NOT COALESCE((v_readiness->>'ready')::boolean, false) THEN
    RAISE EXCEPTION 'Team is not ready for marketplace. Failing checks: %',
      (v_readiness->'team_checks')::text
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_marketplace_readiness ON public.teams;
CREATE TRIGGER trg_enforce_marketplace_readiness
  BEFORE UPDATE OF marketplace_visible ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_marketplace_readiness();
