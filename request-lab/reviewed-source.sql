-- Exact reviewed source bodies, partial dependencies; not deployment parity.

-- Source: 20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql
CREATE OR REPLACE FUNCTION public.is_marketplace_team(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND t.marketplace_visible = true
      AND t.marketplace_request_status = 'approved'
      AND coalesce(t.is_demo_account, false) = false
      AND coalesce(t.is_deleted, false) = false
  );
$$;

-- Source: 20260721232856_542fce1e-1f93-4fe3-9344-c363ed48f7bd.sql
CREATE OR REPLACE FUNCTION public.is_marketplace_vehicle(_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = _vehicle_id
      AND v.marketplace_visible = true
      AND v.status IN ('available', 'booked')
      AND v.archived_at IS NULL
      AND v.trashed_at IS NULL
      AND v.team_id IS NOT NULL
      AND public.is_marketplace_team(v.team_id)
  );
$$;

-- Source: 20260817223022_dc7d6780-e411-471d-a9c0-db19bf3bb109.sql
CREATE OR REPLACE FUNCTION public.team_state_code(_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT upper(nullif(btrim(coalesce(
    (SELECT loc.state
       FROM public.locations loc
      WHERE loc.team_id = _team_id
        AND coalesce(loc.is_active, true)
        AND nullif(btrim(loc.state), '') IS NOT NULL
      ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
      LIMIT 1),
    (SELECT t.business_address->>'region' FROM public.teams t WHERE t.id = _team_id)
  )), ''))
$$;

-- Source: 20260817223022_dc7d6780-e411-471d-a9c0-db19bf3bb109.sql
CREATE OR REPLACE FUNCTION public.team_state_fee_daily_cents(_team_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT f.daily_cents
       FROM public.state_rental_fees f
      WHERE f.state_code = public.team_state_code(_team_id)),
    0::bigint)
$$;

-- Source: 20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql
CREATE OR REPLACE FUNCTION public.cancellation_policy_text()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT 'Free cancellation until 72 hours before your scheduled pickup. Within 72 hours of your scheduled pickup, the booking is non-refundable and payment is forfeited.'::text
$function$;

-- Source: 20260818194350_05657977-2db5-4065-bade-cb18f5658618.sql
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

-- Source: 20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql
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

-- Source: 20260819031937_c36dd9f7-6487-41e5-b013-5b43663eb92d.sql
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

-- Source: 20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql
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
  ),
  booked AS (
    SELECT (b.start_date - make_interval(mins => tg.buffer_minutes))::date AS busy_start,
           GREATEST(
             (b.start_date - make_interval(mins => tg.buffer_minutes))::date,
             (b.end_date - interval '1 day')::date
           ) AS busy_end
    FROM public.bookings b
    JOIN target tg ON tg.vehicle_id = b.vehicle_id
    WHERE b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
      AND coalesce(b.is_historical, false) = false
      AND b.end_date >= _range_start::timestamptz
      AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ),
  blocked AS (
    SELECT d.start_date::date AS busy_start,
           GREATEST(d.start_date::date, (d.end_date - interval '1 second')::date) AS busy_end
    FROM public.vehicle_blocked_dates d
    JOIN target tg ON tg.vehicle_id = d.vehicle_id
    WHERE d.end_date >= _range_start::timestamptz
      AND d.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  )
  SELECT busy_start, busy_end FROM booked
  UNION ALL
  SELECT busy_start, busy_end FROM blocked
  ORDER BY 1
$function$;

-- Source: 20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql
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
           coalesce(l.tax_rate_percent, t.tax_rate_percent, 0)::numeric AS tax_pct,
           coalesce(nullif(btrim(l.tax_label), ''), nullif(btrim(t.tax_label), ''), 'Tax') AS tax_label,
           coalesce(l.tax_inclusive, t.tax_inclusive, false) AS tax_inclusive
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    LEFT JOIN public.locations l ON l.id = v.location_id AND l.team_id = t.id
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

-- Source: 20260901194608_e2f6eea3-4363-483c-bc1d-9cfa24d1819e.sql
CREATE OR REPLACE FUNCTION public.guard_marketplace_booking_blocked_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.booking_source IS DISTINCT FROM 'marketplace' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vehicle_blocked_dates d
    WHERE d.vehicle_id = NEW.vehicle_id
      AND tstzrange(d.start_date, d.end_date, '[)') && tstzrange(NEW.start_date, NEW.end_date, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;

  RETURN NEW;
END;
$function$;

-- Source: 20260722051127_c9a90611-18bc-46ef-aa5b-566cc51c77d0.sql
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_marketplace_overlap
EXCLUDE USING gist (
  vehicle_id WITH =,
  tstzrange(start_date, end_date, '[)') WITH &&
) WHERE (
  booking_source = 'marketplace'
  AND status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
);

REVOKE ALL ON FUNCTION public.guard_marketplace_booking_blocked_dates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_marketplace_blocked_dates ON public.bookings;
CREATE TRIGGER trg_guard_marketplace_blocked_dates
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_booking_blocked_dates();

REVOKE ALL ON FUNCTION public.public_vehicle_busy_windows(text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_vehicle_busy_windows(text,text,date,date) TO anon,authenticated,service_role;
