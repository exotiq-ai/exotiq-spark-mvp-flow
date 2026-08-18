-- 1) Tenant carryover fields
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS cancellation_policy text;

-- 2) Single source of the enforced cancellation policy text
CREATE OR REPLACE FUNCTION public.cancellation_policy_text()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT 'Free cancellation until 72 hours before your scheduled pickup. Within 72 hours of your scheduled pickup, the booking is non-refundable and payment is forfeited.'::text
$function$;

-- 3) Pickup resolution: vehicle location row first, team default as fallback
CREATE OR REPLACE FUNCTION public.resolve_pickup_address(_team_id uuid, _vehicle_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (
      SELECT nullif(btrim(concat_ws(', ',
        nullif(btrim(loc.address), ''),
        nullif(btrim(loc.city), ''),
        nullif(btrim(loc.state), ''),
        nullif(btrim(loc.zip_code), '')
      )), '')
      FROM public.vehicles v
      JOIN public.locations loc ON loc.id = v.location_id
      WHERE v.id = _vehicle_id AND loc.team_id = _team_id
    ),
    (SELECT nullif(btrim(t.pickup_address), '') FROM public.teams t WHERE t.id = _team_id),
    (
      SELECT nullif(btrim(concat_ws(', ',
        nullif(btrim(loc.address), ''),
        nullif(btrim(loc.city), ''),
        nullif(btrim(loc.state), ''),
        nullif(btrim(loc.zip_code), '')
      )), '')
      FROM public.locations loc
      WHERE loc.team_id = _team_id AND coalesce(loc.is_active, true)
      ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
      LIMIT 1
    )
  )
$function$;

-- 4) Snapshot pickup, mileage and policy text at booking creation
CREATE OR REPLACE FUNCTION public.create_marketplace_booking(_team_slug text, _vehicle_slug text, _start_date date, _end_date date, _pickup_time text, _customer_name text, _customer_email text, _customer_phone text, _daily_rate numeric, _total_value numeric, _initial_status text, _protection_tier text, _platform_fee_cents bigint, _protection_total_cents bigint, _state_fee_cents bigint DEFAULT 0, _processing_fee_cents bigint DEFAULT 0, _operator_tax_cents bigint DEFAULT 0)
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
    state_fee_cents, processing_fee_cents, operator_tax_cents
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
    coalesce(_operator_tax_cents, 0)
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

-- 5) Public RPCs expose operator contact + pickup + terms (additive columns)
DROP FUNCTION IF EXISTS public.public_team_by_slug(text);
CREATE FUNCTION public.public_team_by_slug(_team_slug text)
 RETURNS TABLE(slug text, name text, logo_url text, public_description text, city text, state text, timezone text, currency text, support_email text, support_phone text, pickup_address text, pickup_instructions text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.slug, t.name, t.logo_url, t.public_description,
         l.city, l.state, t.timezone, t.currency,
         nullif(btrim(t.support_email), ''),
         nullif(btrim(t.support_phone), ''),
         public.resolve_pickup_address(t.id, NULL),
         nullif(btrim(t.pickup_instructions), '')
  FROM public.teams t
  LEFT JOIN LATERAL (
    SELECT loc.city, loc.state
    FROM public.locations loc
    WHERE loc.team_id = t.id AND coalesce(loc.is_active, true)
    ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
    LIMIT 1
  ) l ON true
  WHERE t.slug = _team_slug
    AND public.is_marketplace_team(t.id)
$function$;
GRANT EXECUTE ON FUNCTION public.public_team_by_slug(text) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.public_booking_by_ref(text, uuid);
CREATE FUNCTION public.public_booking_by_ref(_booking_ref text, _token uuid DEFAULT NULL::uuid)
 RETURNS TABLE(booking_ref text, status text, team_slug text, team_name text, vehicle_slug text, vehicle_name text, start_at timestamp with time zone, end_at timestamp with time zone, total_cents bigint, currency text, authorized boolean, payment_due_at timestamp with time zone, paid_at timestamp with time zone, protection_tier text, platform_fee_cents bigint, protection_total_cents bigint, identity_verified boolean, state_fee_cents bigint, processing_fee_cents bigint, timezone text, operator_tax_cents bigint, operator_tax_label text, support_email text, support_phone text, pickup_address text, pickup_instructions text, mileage_limit_per_day integer, mileage_overage_rate numeric, cancellation_policy text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.booking_ref,
    b.status,
    t.slug,
    t.name,
    v.slug,
    v.name,
    b.start_date,
    b.end_date,
    round(b.total_value * 100)::bigint,
    t.currency,
    true,
    b.payment_due_at,
    b.paid_at,
    b.protection_tier,
    b.platform_fee_cents,
    b.protection_total_cents,
    EXISTS (
      SELECT 1
      FROM public.identity_verifications iv
      JOIN public.customers c ON c.id = iv.customer_id
      WHERE c.team_id = b.team_id
        AND lower(c.email) = lower(b.customer_email)
        AND iv.status = 'verified'
    ) AS identity_verified,
    b.state_fee_cents,
    b.processing_fee_cents,
    t.timezone,
    coalesce(b.operator_tax_cents, 0),
    'Tax'::text,
    nullif(btrim(t.support_email), ''),
    nullif(btrim(t.support_phone), ''),
    coalesce(nullif(btrim(b.pickup_address), ''), public.resolve_pickup_address(t.id, b.vehicle_id)),
    nullif(btrim(coalesce(b.pickup_instructions, t.pickup_instructions)), ''),
    coalesce(b.mileage_limit, v.default_mileage_limit, t.default_mileage_limit),
    coalesce(b.mileage_overage_fee, v.mileage_overage_rate, t.default_mileage_overage_rate),
    coalesce(nullif(btrim(b.cancellation_policy), ''), public.cancellation_policy_text())
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$function$;
GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon, authenticated, service_role;