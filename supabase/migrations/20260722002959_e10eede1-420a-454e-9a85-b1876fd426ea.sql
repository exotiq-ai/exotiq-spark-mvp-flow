
-- 1. Add flag
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS marketplace_test_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.marketplace_test_mode IS
  'Super-admin bypass. When true, get_marketplace_readiness reports ready=true and the enforce_marketplace_readiness trigger short-circuits. Real checks still render for visibility.';

-- 2. Rewrite readiness RPC to include test_mode + honor bypass
CREATE OR REPLACE FUNCTION public.get_marketplace_readiness(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team record;
  v_owner_email text;
  v_terms_ok boolean;
  v_vehicle_checks jsonb;
  v_ready_vehicle_count int;
  v_team_checks jsonb;
  v_all_ok boolean;
  v_test_mode boolean;
BEGIN
  SELECT id, name, logo_url, public_description, business_address, owner_id,
         stripe_charges_enabled, stripe_payouts_enabled, is_demo_account,
         marketplace_visible, marketplace_test_mode
    INTO v_team
    FROM public.teams
   WHERE id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'team_not_found');
  END IF;

  v_test_mode := COALESCE(v_team.marketplace_test_mode, false);

  SELECT email INTO v_owner_email FROM public.profiles WHERE id = v_team.owner_id;

  SELECT EXISTS (
    SELECT 1 FROM public.terms_acceptances
     WHERE team_id = p_team_id
       AND user_id = v_team.owner_id
       AND event_type IN ('signup','reacceptance','terms_update','order_form')
  ) INTO v_terms_ok;

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
    'ready', CASE WHEN v_test_mode THEN true ELSE COALESCE(v_all_ok, false) END,
    'test_mode', v_test_mode,
    'real_ready', COALESCE(v_all_ok, false),
    'team_checks', v_team_checks,
    'vehicles', COALESCE(v_vehicle_checks, '[]'::jsonb),
    'ready_vehicle_count', v_ready_vehicle_count,
    'checked_at', now()
  );
END;
$function$;

-- 3. Enforce trigger honors test_mode
CREATE OR REPLACE FUNCTION public.enforce_marketplace_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gate text;
  v_override text;
  v_readiness jsonb;
BEGIN
  IF NEW.marketplace_visible IS NOT TRUE OR OLD.marketplace_visible IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Super-admin per-team test bypass
  IF COALESCE(NEW.marketplace_test_mode, false) THEN
    RETURN NEW;
  END IF;

  v_gate := current_setting('app.marketplace_gate_enforced', true);
  IF v_gate IS NULL OR v_gate <> 'on' THEN
    RETURN NEW;
  END IF;

  v_override := current_setting('app.marketplace_gate_override_reason', true);
  IF v_override IS NOT NULL AND length(v_override) > 0
     AND public.has_role(auth.uid(), 'super_admin'::app_role) THEN
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
$function$;

-- 4. Super-admin RPC to toggle the flag with audit
CREATE OR REPLACE FUNCTION public.set_marketplace_test_mode(p_team_id uuid, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_name text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can toggle marketplace test mode';
  END IF;

  UPDATE public.teams
     SET marketplace_test_mode = COALESCE(p_enabled, false)
   WHERE id = p_team_id
   RETURNING name INTO v_team_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  PERFORM public.log_admin_action(
    'set_marketplace_test_mode',
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team_name, 'enabled', COALESCE(p_enabled, false))
  );

  RETURN COALESCE(p_enabled, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_marketplace_test_mode(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_marketplace_test_mode(uuid, boolean) TO authenticated;
