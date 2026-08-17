-- 1) Historical (back-filled) bookings must not affect renter availability
CREATE OR REPLACE FUNCTION public.public_vehicle_availability(_team_slug text, _vehicle_slug text, _range_start date, _range_end date)
 RETURNS TABLE(busy_start date, busy_end date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id, coalesce(t.rental_buffer_minutes, 60) AS buffer_minutes
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
  )
  SELECT (b.start_date - make_interval(mins => tg.buffer_minutes))::date AS busy_start,
         (b.end_date + make_interval(mins => tg.buffer_minutes))::date AS busy_end
  FROM public.bookings b
  JOIN target tg ON tg.vehicle_id = b.vehicle_id
  WHERE b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
    AND coalesce(b.is_historical, false) = false
    AND b.end_date >= _range_start::timestamptz
    AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ORDER BY 1
$function$;

-- 2) Same rule in the booking-creation overlap guard
CREATE OR REPLACE FUNCTION public.create_marketplace_booking(_team_slug text, _vehicle_slug text, _start_date date, _end_date date, _pickup_time text, _customer_name text, _customer_email text, _customer_phone text, _daily_rate numeric, _total_value numeric, _initial_status text, _protection_tier text, _platform_fee_cents bigint, _protection_total_cents bigint, _state_fee_cents bigint DEFAULT 0, _processing_fee_cents bigint DEFAULT 0)
 RETURNS TABLE(booking_id uuid, booking_ref text, confirmation_token uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team public.teams%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF _initial_status NOT IN ('requested', 'pending_documents') THEN
    RAISE EXCEPTION 'invalid_initial_status';
  END IF;

  IF _platform_fee_cents IS NULL OR _protection_total_cents IS NULL THEN
    RAISE EXCEPTION 'platform_fee_cents and protection_total_cents are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT t.* INTO v_team FROM public.teams t WHERE t.slug = _team_slug;
  IF NOT FOUND OR NOT public.is_marketplace_team(v_team.id) THEN
    RAISE EXCEPTION 'team_not_available';
  END IF;

  SELECT v.* INTO v_vehicle
  FROM public.vehicles v
  WHERE v.team_id = v_team.id AND v.slug = _vehicle_slug;
  IF NOT FOUND OR NOT public.is_marketplace_vehicle(v_vehicle.id) THEN
    RAISE EXCEPTION 'vehicle_not_available';
  END IF;

  v_start := ((_start_date::text || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  v_end   := ((_end_date::text   || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = v_vehicle.id
      AND b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
      AND coalesce(b.is_historical, false) = false
      AND tstzrange(b.start_date, b.end_date, '[)') && tstzrange(v_start, v_end, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.team_id = v_team.id AND lower(c.email) = lower(_customer_email)
  ORDER BY c.created_at
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, team_id, email, full_name, phone)
    VALUES (v_team.owner_id, v_team.id, lower(_customer_email), _customer_name, _customer_phone)
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.bookings (
    user_id, team_id, vehicle_id, customer_id,
    customer_name, customer_email, customer_phone,
    start_date, end_date,
    pickup_location,
    daily_rate, total_value,
    status, booking_source,
    protection_tier, platform_fee_cents, protection_total_cents,
    state_fee_cents, processing_fee_cents
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
    _daily_rate, _total_value,
    _initial_status, 'marketplace',
    _protection_tier, _platform_fee_cents, _protection_total_cents,
    coalesce(_state_fee_cents, 0), coalesce(_processing_fee_cents, 0)
  )
  RETURNING * INTO v_booking;

  BEGIN
    INSERT INTO public.user_activity_log (user_id, team_id, activity_type, entity_type, entity_id, metadata)
    VALUES (
      v_team.owner_id, v_team.id, 'marketplace_booking_created', 'booking', v_booking.id,
      jsonb_build_object('booking_ref', v_booking.booking_ref, 'vehicle_slug', _vehicle_slug, 'source', 'rent-create-booking')
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN QUERY SELECT v_booking.id, v_booking.booking_ref, v_booking.confirmation_token, v_booking.status;
END;
$function$;

-- 3) Readiness: surface trashed-but-marketplace-flagged vehicles as a warning
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
  v_trashed_visible int;
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

  SELECT count(*) INTO v_trashed_visible
    FROM public.vehicles
   WHERE team_id = p_team_id
     AND trashed_at IS NOT NULL
     AND archived_at IS NULL
     AND marketplace_visible IS TRUE;

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
    'trashed_marketplace_visible_count', COALESCE(v_trashed_visible, 0),
    'checked_at', now()
  );
END;
$function$;