
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS default_security_deposit numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS exotiq_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS exotiq_charge_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operator_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_cents_snapshot bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protection_tier text,
  ADD COLUMN IF NOT EXISTS protection_cents_snapshot bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bookings_exotiq_pi_idx ON public.bookings(exotiq_payment_intent_id) WHERE exotiq_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_operator_pi_idx ON public.bookings(operator_payment_intent_id) WHERE operator_payment_intent_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.public_vehicle_quote(text, text, date, date, jsonb);
DROP FUNCTION IF EXISTS public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.public_vehicle_quote(
  _team_slug text,
  _vehicle_slug text,
  _start_date date,
  _end_date date,
  _options jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  currency text,
  rental_days integer,
  daily_rate_cents bigint,
  rental_subtotal_cents bigint,
  deposit_cents bigint,
  operator_total_cents bigint,
  platform_fee_percent numeric,
  platform_fee_cents bigint,
  protection_tier text,
  protection_daily_cents bigint,
  protection_total_cents bigint,
  exotiq_total_cents bigint,
  grand_total_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT v.current_rate,
           coalesce(v.default_security_deposit, 0) AS deposit,
           t.currency,
           coalesce(t.platform_fee_percent, 10) AS fee_pct
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
      AND _end_date > _start_date
  ),
  calc AS (
    SELECT tg.currency,
           (_end_date - _start_date)::int AS rental_days,
           round(tg.current_rate * 100)::bigint AS daily_rate_cents,
           round(tg.deposit * 100)::bigint AS deposit_cents,
           tg.fee_pct,
           CASE lower(coalesce(_options->>'protection', 'premium'))
             WHEN 'premium' THEN 28900::bigint
             WHEN 'standard' THEN 8900::bigint
             ELSE 0::bigint
           END AS protection_daily_cents,
           lower(coalesce(_options->>'protection', 'premium')) AS protection_tier
    FROM target tg
  )
  SELECT c.currency,
         c.rental_days,
         c.daily_rate_cents,
         c.daily_rate_cents * c.rental_days AS rental_subtotal_cents,
         c.deposit_cents,
         c.daily_rate_cents * c.rental_days + c.deposit_cents AS operator_total_cents,
         c.fee_pct AS platform_fee_percent,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint AS platform_fee_cents,
         c.protection_tier,
         c.protection_daily_cents,
         c.protection_daily_cents * c.rental_days AS protection_total_cents,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS exotiq_total_cents,
         (c.daily_rate_cents * c.rental_days)
           + c.deposit_cents
           + round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS grand_total_cents
  FROM calc c
$$;

CREATE OR REPLACE FUNCTION public.create_marketplace_booking(
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
  _deposit_cents bigint DEFAULT 0,
  _protection_tier text DEFAULT 'premium',
  _protection_cents bigint DEFAULT 0,
  _platform_fee_cents bigint DEFAULT 0
)
RETURNS TABLE(booking_id uuid, booking_ref text, confirmation_token uuid, status text)
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
    security_deposit_amount, deposit_amount,
    protection_tier, protection_cents_snapshot,
    deposit_cents_snapshot, exotiq_charge_cents,
    status, booking_source
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
    _daily_rate, _total_value,
    (_deposit_cents::numeric / 100), (_deposit_cents::numeric / 100),
    _protection_tier, _protection_cents,
    _deposit_cents, (_platform_fee_cents + _protection_cents),
    _initial_status, 'marketplace'
  )
  RETURNING * INTO v_booking;

  BEGIN
    INSERT INTO public.user_activity_log (user_id, team_id, activity_type, entity_type, entity_id, metadata)
    VALUES (
      v_team.owner_id, v_team.id, 'marketplace_booking_created', 'booking', v_booking.id,
      jsonb_build_object('booking_ref', v_booking.booking_ref, 'vehicle_slug', _vehicle_slug, 'source', 'rent-create-booking')
    );
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN QUERY SELECT v_booking.id, v_booking.booking_ref, v_booking.confirmation_token, v_booking.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text, text, date, date, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_marketplace_booking(text, text, date, date, text, text, text, text, numeric, numeric, text, bigint, text, bigint, bigint) TO service_role;
