-- Fix: restore create_marketplace_booking to the working 2026-07-22 body
-- and re-layer only the M6b fee-snapshot deltas. The 2026-07-25 rewrite
-- referenced columns that don't exist (bookings.pickup_time, customers.name),
-- dropped NOT NULL columns (user_id, pickup_location), failed to parse
-- 12-hour pickup times ('10:00 AM'), applied AT TIME ZONE in the wrong
-- direction, hardcoded return time, dropped the invalid_date_range guard,
-- and stopped raising the error strings rent-create-booking maps to
-- 409/404/400.

DROP FUNCTION IF EXISTS public.create_marketplace_booking(
  text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint
);

CREATE FUNCTION public.create_marketplace_booking(
  _team_slug text,
  _vehicle_slug text,
  _start_date date,
  _end_date date,
  _pickup_time text,
  _customer_name text,
  _customer_email text,
  _customer_phone text,
  _daily_rate numeric,
  _total_value numeric,
  _initial_status text,
  _protection_tier text,
  _platform_fee_cents bigint,
  _protection_total_cents bigint
)
RETURNS TABLE (booking_id uuid, booking_ref text, confirmation_token uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- M6c intent (handoff #20): a stale caller that omits fee params must fail,
  -- not silently write $0 fees.
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

  -- Same local time on pickup and return day, in the team's timezone.
  -- Cast to `timestamp` (naive wall time) FIRST, then AT TIME ZONE tz
  -- resolves it to an absolute instant. Postgres accepts '10:00 AM' inside
  -- `timestamp` but not `timestamptz`.
  v_start := ((_start_date::text || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  v_end   := ((_end_date::text   || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  -- Friendly overlap pre-check across ALL blocking bookings (operator +
  -- marketplace). The bookings_no_marketplace_overlap exclusion constraint
  -- is the concurrency-safe backstop for marketplace rows racing each other.
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = v_vehicle.id
      AND b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
      AND tstzrange(b.start_date, b.end_date, '[)') && tstzrange(v_start, v_end, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;

  -- Guest checkout (D6): attach to the team's CRM by email, create if new.
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
    protection_tier, platform_fee_cents, protection_total_cents
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
    _daily_rate, _total_value,
    _initial_status, 'marketplace',
    _protection_tier, _platform_fee_cents, _protection_total_cents
  )
  RETURNING * INTO v_booking;

  -- Best-effort audit trail; never fail the booking over it.
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(
  text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_booking(
  text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint
) TO service_role;