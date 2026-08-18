DROP FUNCTION IF EXISTS public.public_vehicle_quote(text,text,date,date,jsonb);
DROP FUNCTION IF EXISTS public.public_booking_by_ref(text,uuid);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS operator_tax_cents bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.public_vehicle_quote(_team_slug text, _vehicle_slug text, _start_date date, _end_date date, _options jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(currency text, rental_days integer, daily_rate_cents bigint, rental_subtotal_cents bigint, deposit_cents bigint, operator_total_cents bigint, platform_fee_percent numeric, platform_fee_cents bigint, protection_tier text, protection_daily_cents bigint, protection_total_cents bigint, state_fee_cents bigint, processing_fee_cents bigint, exotiq_total_cents bigint, grand_total_cents bigint, state_code text, state_fee_label text, state_fee_daily_cents bigint, operator_tax_rate numeric, operator_tax_label text, operator_tax_cents bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id,
           v.current_rate,
           t.id AS team_id,
           t.currency,
           coalesce(t.platform_fee_percent, 10) AS fee_pct,
           coalesce(t.tax_rate_percent, 0)::numeric AS tax_pct,
           coalesce(nullif(btrim(t.tax_label), ''), 'Tax') AS tax_label,
           coalesce(t.tax_inclusive, false) AS tax_inclusive
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
           tg.tax_pct,
           tg.tax_label,
           tg.tax_inclusive,
           public.team_state_code(tg.team_id) AS state_code,
           public.team_state_fee_daily_cents(tg.team_id) AS state_fee_daily_cents,
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
           c.tax_pct,
           c.tax_label,
           c.tax_inclusive,
           c.protection_tier,
           c.protection_daily_cents,
           c.state_code,
           c.state_fee_daily_cents,
           c.daily_rate_cents * c.rental_days AS rental_subtotal_cents,
           c.protection_daily_cents * c.rental_days AS protection_total_cents,
           round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint AS platform_fee_cents,
           (c.state_fee_daily_cents * c.rental_days) AS state_fee_cents
    FROM calc c
  ),
  taxed AS (
    SELECT p.*,
           CASE
             WHEN p.tax_pct <= 0 THEN 0::bigint
             WHEN p.tax_inclusive THEN
               (p.rental_subtotal_cents
                 - round(p.rental_subtotal_cents / (1 + p.tax_pct / 100.0)))::bigint
             ELSE round(p.rental_subtotal_cents * p.tax_pct / 100.0)::bigint
           END AS operator_tax_cents
    FROM pieces p
  ),
  totals AS (
    SELECT t.*, round(0.02 * t.rental_subtotal_cents)::bigint AS take_2pct
    FROM taxed t
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
         (w.rental_subtotal_cents
            + CASE WHEN w.tax_inclusive THEN 0 ELSE w.operator_tax_cents END) AS operator_total_cents,
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
            + CASE WHEN w.tax_inclusive THEN 0 ELSE w.operator_tax_cents END
            + w.platform_fee_cents + w.protection_total_cents + w.state_fee_cents
            + w.take_2pct + w.stripe_fee_cents) AS grand_total_cents,
         w.state_code,
         coalesce((SELECT f.label FROM public.state_rental_fees f WHERE f.state_code = w.state_code),
                  'State rental fee') AS state_fee_label,
         w.state_fee_daily_cents,
         w.tax_pct AS operator_tax_rate,
         w.tax_label AS operator_tax_label,
         w.operator_tax_cents
  FROM with_fee w;
$function$;

GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text,text,date,date,jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_booking_by_ref(_booking_ref text, _token uuid DEFAULT NULL::uuid)
 RETURNS TABLE(booking_ref text, status text, team_slug text, team_name text, vehicle_slug text, vehicle_name text, start_at timestamp with time zone, end_at timestamp with time zone, total_cents bigint, currency text, authorized boolean, payment_due_at timestamp with time zone, paid_at timestamp with time zone, protection_tier text, platform_fee_cents bigint, protection_total_cents bigint, identity_verified boolean, state_fee_cents bigint, processing_fee_cents bigint, timezone text, operator_tax_cents bigint, operator_tax_label text)
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
      WHERE lower(c.email) = lower(b.customer_email)
        AND iv.status = 'verified'
        AND (iv.document_expiry IS NULL OR iv.document_expiry > now())
    ) AS identity_verified,
    b.state_fee_cents,
    b.processing_fee_cents,
    t.timezone,
    coalesce(b.operator_tax_cents, 0),
    coalesce(nullif(btrim(t.tax_label), ''), 'Tax')
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$function$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text,uuid) TO anon, authenticated, service_role;

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
    state_fee_cents, processing_fee_cents, operator_tax_cents
  ) VALUES (
    v_team.owner_id, v_team.id, v_vehicle.id, v_customer_id,
    _customer_name, lower(_customer_email), _customer_phone,
    v_start, v_end,
    'Arranged with operator',
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