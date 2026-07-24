-- M6b — Renter payment: fee snapshot at creation + payment-aware public read
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS protection_tier text,
  ADD COLUMN IF NOT EXISTS platform_fee_cents bigint,
  ADD COLUMN IF NOT EXISTS protection_total_cents bigint;

COMMENT ON COLUMN public.bookings.protection_tier IS
  'premium | standard | decline — renter''s choice at booking (D5). Snapshot; later catalog changes never reprice an existing booking.';
COMMENT ON COLUMN public.bookings.platform_fee_cents IS
  'Exotiq booking fee snapshot at creation (D1/D9: % of rental subtotal only).';
COMMENT ON COLUMN public.bookings.protection_total_cents IS
  'Protection plan total snapshot at creation (D5 rates × rental days).';

DROP FUNCTION IF EXISTS public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text);

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
  _protection_tier text DEFAULT 'premium',
  _platform_fee_cents bigint DEFAULT 0,
  _protection_total_cents bigint DEFAULT 0
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

  IF _protection_tier NOT IN ('premium', 'standard', 'decline') THEN
    RAISE EXCEPTION 'invalid_protection_tier';
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
  v_end   := ((_end_date::text || ' ' || coalesce(_pickup_time, '10:00 AM'))::timestamp)
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = v_vehicle.id
      AND b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
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
    protection_tier, platform_fee_cents, protection_total_cents,
    status, booking_source
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
    _daily_rate, _total_value,
    _protection_tier, _platform_fee_cents, _protection_total_cents,
    _initial_status, 'marketplace'
  )
  RETURNING * INTO v_booking;

  BEGIN
    INSERT INTO public.user_activity_log (user_id, team_id, action, details)
    VALUES (
      v_team.owner_id, v_team.id, 'marketplace_booking_created',
      jsonb_build_object('booking_ref', v_booking.booking_ref, 'vehicle_slug', _vehicle_slug, 'source', 'rent-create-booking')
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN QUERY SELECT v_booking.id, v_booking.booking_ref, v_booking.confirmation_token, v_booking.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint) FROM authenticated;

DROP FUNCTION IF EXISTS public.public_booking_by_ref(text, uuid);

CREATE FUNCTION public.public_booking_by_ref(_booking_ref text, _token uuid DEFAULT NULL)
RETURNS TABLE (
  booking_ref text,
  status text,
  team_slug text,
  team_name text,
  vehicle_slug text,
  vehicle_name text,
  start_at timestamptz,
  end_at timestamptz,
  total_cents bigint,
  currency text,
  authorized boolean,
  payment_due_at timestamptz,
  paid_at timestamptz,
  protection_tier text,
  platform_fee_cents bigint,
  protection_total_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.booking_ref,
    b.status,
    CASE WHEN b.confirmation_token = _token THEN t.slug END AS team_slug,
    CASE WHEN b.confirmation_token = _token THEN t.name END AS team_name,
    CASE WHEN b.confirmation_token = _token THEN v.slug END AS vehicle_slug,
    CASE WHEN b.confirmation_token = _token THEN v.name END AS vehicle_name,
    CASE WHEN b.confirmation_token = _token THEN b.start_date END AS start_at,
    CASE WHEN b.confirmation_token = _token THEN b.end_date END AS end_at,
    CASE WHEN b.confirmation_token = _token THEN round(b.total_value * 100)::bigint END AS total_cents,
    t.currency,
    (b.confirmation_token = _token) AS authorized,
    CASE WHEN b.confirmation_token = _token THEN b.payment_due_at END AS payment_due_at,
    CASE WHEN b.confirmation_token = _token THEN b.paid_at END AS paid_at,
    CASE WHEN b.confirmation_token = _token THEN b.protection_tier END AS protection_tier,
    CASE WHEN b.confirmation_token = _token THEN b.platform_fee_cents END AS platform_fee_cents,
    CASE WHEN b.confirmation_token = _token THEN b.protection_total_cents END AS protection_total_cents
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
$$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO authenticated;