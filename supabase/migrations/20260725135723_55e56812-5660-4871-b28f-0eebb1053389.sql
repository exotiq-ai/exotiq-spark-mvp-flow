
-- 1) exotiq_leg_attempt for retry-with-fresh-idempotency-key (M6 handoff #9)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS exotiq_leg_attempt integer NOT NULL DEFAULT 0;

-- 2) Belt-and-braces column declarations (M6 handoff #27) — safe if already present.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS operator_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS exotiq_payment_intent_id text;

-- 3) Fix double-tz shift in payment_due_at trigger (M6 handoff #21).
--    start_date is already an instant; casting to ::timestamp then AT TIME ZONE
--    shifts it twice. Drop the cast entirely.
CREATE OR REPLACE FUNCTION public.set_payment_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_due timestamptz;
BEGIN
  IF NEW.status = 'pending_payment'
     AND (OLD.status IS DISTINCT FROM 'pending_payment')
     AND NEW.payment_due_at IS NULL THEN
    v_due := LEAST(now() + interval '48 hours', NEW.start_date - interval '2 hours');
    NEW.payment_due_at := GREATEST(v_due, now() + interval '2 hours');
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Drop DEFAULT 0 on money params of create_marketplace_booking (M6 handoff #20).
--    A stale caller that omits these must fail, not silently write $0 fees.
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
    RAISE EXCEPTION 'invalid initial status: %', _initial_status USING ERRCODE = '22023';
  END IF;
  IF _platform_fee_cents IS NULL OR _protection_total_cents IS NULL THEN
    RAISE EXCEPTION 'platform_fee_cents and protection_total_cents are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE slug = _team_slug AND marketplace_visible = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE slug = _vehicle_slug AND team_id = v_team.id AND marketplace_visible = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002'; END IF;

  v_start := (_start_date::text || ' ' || coalesce(_pickup_time, '10:00') || ':00')::timestamptz
             AT TIME ZONE coalesce(v_team.timezone, 'UTC');
  v_end := (_end_date::text || ' 10:00:00')::timestamptz
           AT TIME ZONE coalesce(v_team.timezone, 'UTC');

  IF EXISTS (
    SELECT 1 FROM public.bookings
     WHERE vehicle_id = v_vehicle.id
       AND status IN ('confirmed','pending','requested','pending_documents','pending_payment','in_progress')
       AND tstzrange(start_date, end_date, '[)') && tstzrange(v_start, v_end, '[)')
  ) THEN
    RAISE EXCEPTION 'vehicle unavailable for requested dates' USING ERRCODE = '23P01';
  END IF;

  SELECT id INTO v_customer_id FROM public.customers
    WHERE team_id = v_team.id AND lower(email) = lower(_customer_email)
    ORDER BY created_at DESC LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (team_id, name, email, phone)
    VALUES (v_team.id, _customer_name, _customer_email, _customer_phone)
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.bookings (
    team_id, vehicle_id, vehicle_name, customer_id, customer_name, customer_email, customer_phone,
    start_date, end_date, pickup_time, daily_rate, total_value, status, booking_source,
    protection_tier, platform_fee_cents, protection_total_cents
  ) VALUES (
    v_team.id, v_vehicle.id,
    coalesce(v_vehicle.year::text || ' ', '') || v_vehicle.make || ' ' || v_vehicle.model,
    v_customer_id, _customer_name, _customer_email, _customer_phone,
    v_start, v_end, _pickup_time, _daily_rate, _total_value, _initial_status, 'marketplace',
    _protection_tier, _platform_fee_cents, _protection_total_cents
  ) RETURNING * INTO v_booking;

  RETURN QUERY SELECT v_booking.id, v_booking.booking_ref, v_booking.confirmation_token, v_booking.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_marketplace_booking(
  text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_booking(
  text, text, date, date, text, text, text, text, numeric, numeric, text, text, bigint, bigint
) TO service_role;

-- 5) Platform fee default & backfill (M6 handoff #17).
ALTER TABLE public.teams
  ALTER COLUMN platform_fee_percent SET DEFAULT 10.00;

UPDATE public.teams
   SET platform_fee_percent = 10.00
 WHERE marketplace_visible = true
   AND (platform_fee_percent IS NULL OR platform_fee_percent = 0);
