
-- 1. New snapshot columns on bookings (default 0 so existing rows/queries are unaffected).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS state_fee_cents      bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee_cents bigint NOT NULL DEFAULT 0;

-- 2. Rewrite public_vehicle_quote to include state_fee_cents + processing_fee_cents.
--    Both live in the Exotiq leg (exotiq_total_cents / grand_total_cents). Operator
--    total is unchanged. deposit_cents kept in signature but always 0 (M6d contract).
DROP FUNCTION IF EXISTS public.public_vehicle_quote(text, text, date, date, jsonb);
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
  state_fee_cents bigint,
  processing_fee_cents bigint,
  exotiq_total_cents bigint,
  grand_total_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- State rental fee: hardcoded $5.89/day (589 cents/day).
  -- TODO: per-jurisdiction rate + label; this breaks the moment an operator
  -- outside the current jurisdiction goes marketplace-visible. Move to a
  -- state_fees table keyed by pickup jurisdiction when tenant #2 lands.
  --
  -- Processing fee: renter covers Stripe's fee on the EXOTIQ leg only
  -- (Gregory's ruling, 2026-07-28). Operator continues to absorb their own
  -- share (M6-D2, unchanged). Estimated once at Stripe standard card pricing
  -- (2.9% + $0.30) — no gross-up (cents-level delta, invoice legibility wins).
  WITH target AS (
    SELECT v.id AS vehicle_id,
           v.current_rate,
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
           tg.fee_pct,
           CASE lower(coalesce(_options->>'protection', 'premium'))
             WHEN 'premium'  THEN 28900::bigint
             WHEN 'standard' THEN  8900::bigint
             ELSE 0::bigint
           END AS protection_daily_cents,
           lower(coalesce(_options->>'protection', 'premium')) AS protection_tier
    FROM target tg
  ),
  pieces AS (
    SELECT c.currency,
           c.rental_days,
           c.daily_rate_cents,
           c.fee_pct,
           c.protection_tier,
           c.protection_daily_cents,
           c.daily_rate_cents * c.rental_days AS rental_subtotal_cents,
           c.protection_daily_cents * c.rental_days AS protection_total_cents,
           round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint AS platform_fee_cents,
           (589::bigint * c.rental_days) AS state_fee_cents
    FROM calc c
  ),
  totals AS (
    SELECT p.*,
           -- 2% Exotiq take on rental subtotal, then Stripe standard-card
           -- estimate (2.9% + $0.30) on the full pre-fee Exotiq leg.
           round(0.02 * p.rental_subtotal_cents)::bigint AS take_2pct
    FROM pieces p
  ),
  with_fee AS (
    SELECT t.*,
           (round(
              0.029 * (t.platform_fee_cents + t.protection_total_cents + t.state_fee_cents + t.take_2pct)
            )::bigint + 30::bigint) AS stripe_fee_cents
    FROM totals t
  )
  SELECT w.currency,
         w.rental_days,
         w.daily_rate_cents,
         w.rental_subtotal_cents,
         0::bigint AS deposit_cents,
         w.rental_subtotal_cents AS operator_total_cents,
         w.fee_pct AS platform_fee_percent,
         w.platform_fee_cents,
         w.protection_tier,
         w.protection_daily_cents,
         w.protection_total_cents,
         w.state_fee_cents,
         (w.take_2pct + w.stripe_fee_cents) AS processing_fee_cents,
         (w.platform_fee_cents + w.protection_total_cents + w.state_fee_cents
            + w.take_2pct + w.stripe_fee_cents) AS exotiq_total_cents,
         (w.rental_subtotal_cents
            + w.platform_fee_cents + w.protection_total_cents + w.state_fee_cents
            + w.take_2pct + w.stripe_fee_cents) AS grand_total_cents
  FROM with_fee w;
$function$;

-- 3. Bump create_marketplace_booking to accept + persist the new snapshot fields.
--    Keeps every existing param + adds state_fee_cents / processing_fee_cents at the end.
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
  _protection_tier text,
  _platform_fee_cents bigint,
  _protection_total_cents bigint,
  _state_fee_cents bigint DEFAULT 0,
  _processing_fee_cents bigint DEFAULT 0
)
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
