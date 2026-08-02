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
        WHERE vp.vehicle_id = veh.id AND vp.is_visible IS NOT FALSE) AS photo_count,
      (SELECT count(*) FROM public.vehicle_photos vp
        WHERE vp.vehicle_id = veh.id AND vp.is_visible IS NOT FALSE
          AND vp.photo_type = 'hero') AS hero_count,
      (SELECT count(*) FROM public.vehicle_photos vp
        WHERE vp.vehicle_id = veh.id AND vp.is_visible IS NOT FALSE
          AND vp.photo_type = 'hero'
          AND vp.detected_angle = 'front_quarter') AS hero_front_quarter_count
      FROM public.vehicles veh
     WHERE veh.team_id = p_team_id
       AND veh.archived_at IS NULL
       AND veh.trashed_at IS NULL
  ),
  scored AS (
    SELECT
      v.*,
      jsonb_build_object(
        'hero_photo_set', (v.hero_count > 0 OR v.photo_count > 0),
        'rate_set',     (v.current_rate IS NOT NULL AND v.current_rate > 0),
        'location_set', (v.location_id IS NOT NULL),
        'status_available', (v.status = 'available'),
        'not_archived', true
      ) AS checks,
      jsonb_build_object(
        'hero_angle_front_quarter', (v.hero_front_quarter_count > 0)
      ) AS suggestions
    FROM v
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'label', concat_ws(' ', year::text, make, model),
        'marketplace_visible', marketplace_visible,
        'checks', checks,
        'suggestions', suggestions,
        'photo_count', photo_count,
        'hero_count', hero_count,
        'ready', (
          (checks->>'hero_photo_set')::boolean
          AND (checks->>'rate_set')::boolean
          AND (checks->>'location_set')::boolean
          AND (checks->>'status_available')::boolean
        )
      )
      ORDER BY make, model
    ),
    count(*) FILTER (
      WHERE marketplace_visible
        AND (checks->>'hero_photo_set')::boolean
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