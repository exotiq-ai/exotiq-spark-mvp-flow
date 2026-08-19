-- 1) Precise busy windows for the renter app (additive; day-granular RPC untouched)
CREATE OR REPLACE FUNCTION public.public_vehicle_busy_windows(_team_slug text, _vehicle_slug text, _range_start date, _range_end date)
 RETURNS TABLE(busy_start_at timestamptz, busy_end_at timestamptz, timezone text, buffer_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id,
           coalesce(t.rental_buffer_minutes, 60) AS buffer_minutes,
           coalesce(t.timezone, 'UTC') AS tz
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
  )
  SELECT (b.start_date - make_interval(mins => tg.buffer_minutes)) AS busy_start_at,
         (b.end_date + make_interval(mins => tg.buffer_minutes)) AS busy_end_at,
         tg.tz AS timezone,
         tg.buffer_minutes
  FROM public.bookings b
  JOIN target tg ON tg.vehicle_id = b.vehicle_id
  WHERE b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
    AND coalesce(b.is_historical, false) = false
    AND b.end_date >= _range_start::timestamptz
    AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ORDER BY 1
$function$;

REVOKE ALL ON FUNCTION public.public_vehicle_busy_windows(text, text, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.public_vehicle_busy_windows(text, text, date, date) TO anon, authenticated, service_role;

-- 2) Retire the stale overloads so the new signature is unambiguous
DROP FUNCTION IF EXISTS public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint);
DROP FUNCTION IF EXISTS public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint, bigint, bigint);

-- 3) Return time is its own input; falls back to pickup time when omitted
CREATE OR REPLACE FUNCTION public.create_marketplace_booking(_team_slug text, _vehicle_slug text, _start_date date, _end_date date, _pickup_time text, _customer_name text, _customer_email text, _customer_phone text, _daily_rate numeric, _total_value numeric, _initial_status text, _protection_tier text, _platform_fee_cents bigint, _protection_total_cents bigint, _state_fee_cents bigint DEFAULT 0, _processing_fee_cents bigint DEFAULT 0, _operator_tax_cents bigint DEFAULT 0, _return_time text DEFAULT NULL)
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
  v_pickup_address text;
  v_pickup_instructions text;
  v_mileage_limit integer;
  v_mileage_rate numeric;
  v_pickup_time text;
  v_return_time text;
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

  -- Pickup and return are distinct wall-clock times in the team's timezone.
  -- Return defaults to the pickup time so existing callers behave as before.
  v_pickup_time := coalesce(nullif(btrim(_pickup_time), ''), '10:00 AM');
  v_return_time := coalesce(nullif(btrim(_return_time), ''), v_pickup_time);

  v_start := ((_start_date::text || ' ' || v_pickup_time)::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  v_end   := ((_end_date::text   || ' ' || v_return_time)::timestamp)
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

  v_pickup_address := public.resolve_pickup_address(v_team.id, v_vehicle.id);
  v_pickup_instructions := nullif(btrim(v_team.pickup_instructions), '');
  v_mileage_limit := coalesce(v_vehicle.default_mileage_limit, v_team.default_mileage_limit);
  v_mileage_rate := coalesce(v_vehicle.mileage_overage_rate, v_team.default_mileage_overage_rate);

  INSERT INTO public.bookings (
    user_id, team_id, vehicle_id, customer_id,
    customer_name, customer_email, customer_phone,
    start_date, end_date,
    pickup_location, pickup_address, pickup_instructions,
    mileage_limit, mileage_overage_fee, cancellation_policy,
    daily_rate, total_value,
    status, booking_source,
    protection_tier, platform_fee_cents, protection_total_cents,
    state_fee_cents, processing_fee_cents, operator_tax_cents,
    gas_fee, gas_fee_waived
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    coalesce(v_pickup_address, 'Arranged with operator'), v_pickup_address, v_pickup_instructions,
    v_mileage_limit, v_mileage_rate, public.cancellation_policy_text(),
    _daily_rate, _total_value,
    _initial_status, 'marketplace',
    _protection_tier, _platform_fee_cents, _protection_total_cents,
    coalesce(_state_fee_cents, 0), coalesce(_processing_fee_cents, 0),
    coalesce(_operator_tax_cents, 0),
    0, true
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