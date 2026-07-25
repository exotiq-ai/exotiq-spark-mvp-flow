
-- Item #1: persistent rate limit counters (survives serverless isolate churn)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

GRANT ALL ON public.rate_limit_counters TO service_role;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (via edge functions) touches this table.

CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx
  ON public.rate_limit_counters (window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket text,
  _limit integer,
  _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.rate_limit_counters (bucket, window_start, count)
  VALUES (_bucket, v_window_start, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic janitor: purge windows older than 1 day (~1% of calls).
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_counters
     WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;


-- Item #2a: availability RPC now reports the same busy statuses that the
-- transactional overlap check blocks, so the calendar cannot show dates as
-- free that create_marketplace_booking will 409 on.
CREATE OR REPLACE FUNCTION public.public_vehicle_availability(
  _team_slug text,
  _vehicle_slug text,
  _range_start date,
  _range_end date
) RETURNS TABLE(busy_start date, busy_end date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND b.end_date >= _range_start::timestamptz
    AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ORDER BY 1
$$;


-- Item #2b: auto-expire unverified holds (requested/pending_documents) after
-- 4h with no Stripe intent attached. Mirrors expire_overdue_payment_bookings.
CREATE OR REPLACE FUNCTION public.expire_unverified_holds()
RETURNS TABLE(booking_id uuid, booking_ref text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.bookings b
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'unverified_hold_expired'
   WHERE b.status IN ('requested', 'pending_documents')
     AND b.booking_source = 'marketplace'
     AND b.created_at < now() - interval '4 hours'
     AND (b.operator_payment_intent_id IS NULL OR b.operator_payment_intent_id = '')
     AND (b.exotiq_payment_intent_id IS NULL OR b.exotiq_payment_intent_id = '')
  RETURNING b.id, b.booking_ref;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_unverified_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_unverified_holds() TO service_role;


-- Item #5: token now required for public_booking_by_ref. Without a matching
-- token we return zero rows, preventing enumeration of booking existence /
-- status across the sequential BK-#### ref space.
CREATE OR REPLACE FUNCTION public.public_booking_by_ref(
  _booking_ref text,
  _token uuid DEFAULT NULL::uuid
) RETURNS TABLE(
  booking_ref text, status text, team_slug text, team_name text,
  vehicle_slug text, vehicle_name text,
  start_at timestamptz, end_at timestamptz,
  total_cents bigint, currency text, authorized boolean,
  payment_due_at timestamptz, paid_at timestamptz,
  protection_tier text, platform_fee_cents bigint, protection_total_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    b.protection_total_cents
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$$;
