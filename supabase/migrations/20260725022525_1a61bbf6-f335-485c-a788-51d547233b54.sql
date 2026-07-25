
-- 1) Hard guard: marketplace bookings cannot transition directly from a
--    request status ('requested' | 'pending_documents') to 'confirmed'.
--    The confirmed transition belongs to the payment webhook, which flips
--    from 'pending_payment' to 'confirmed' after Stripe settles both legs.
CREATE OR REPLACE FUNCTION public.guard_marketplace_confirm_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND OLD.status IN ('requested', 'pending_documents')
     AND NEW.booking_source = 'marketplace' THEN
    RAISE EXCEPTION
      'Marketplace bookings cannot be confirmed directly from % — approval must go through rent-approve-booking (→ pending_payment → payment webhook → confirmed).', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_marketplace_confirm ON public.bookings;
CREATE TRIGGER trg_guard_marketplace_confirm
BEFORE UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.guard_marketplace_confirm_transition();

-- 2) Add identity_verified to public_booking_by_ref so the renter app can
--    show verified state truthfully instead of inferring from status.
--    Drop + recreate because the return signature changes.
DROP FUNCTION IF EXISTS public.public_booking_by_ref(text, uuid);

CREATE FUNCTION public.public_booking_by_ref(
  _booking_ref text,
  _token uuid DEFAULT NULL::uuid
) RETURNS TABLE(
  booking_ref text, status text, team_slug text, team_name text,
  vehicle_slug text, vehicle_name text,
  start_at timestamptz, end_at timestamptz,
  total_cents bigint, currency text, authorized boolean,
  payment_due_at timestamptz, paid_at timestamptz,
  protection_tier text, platform_fee_cents bigint, protection_total_cents bigint,
  identity_verified boolean
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
    b.protection_total_cents,
    EXISTS (
      SELECT 1
      FROM public.identity_verifications iv
      JOIN public.customers c ON c.id = iv.customer_id
      WHERE lower(c.email) = lower(b.customer_email)
        AND iv.status = 'verified'
        AND (iv.document_expiry IS NULL OR iv.document_expiry > now())
    ) AS identity_verified
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO authenticated;

-- 3) Rate limiter tuning: check the count first, then increment only when
--    the request is accepted. Previously the counter incremented on every
--    call including rejections, so a busy client could not recover inside
--    a window. Tumbling behavior is preserved; the boundary burst is a
--    known follow-up when we tune the window shape.
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
  v_current integer;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  SELECT count INTO v_current
  FROM public.rate_limit_counters
  WHERE bucket = _bucket AND window_start = v_window_start
  FOR UPDATE;

  IF v_current IS NULL THEN
    INSERT INTO public.rate_limit_counters (bucket, window_start, count)
    VALUES (_bucket, v_window_start, 1)
    ON CONFLICT (bucket, window_start)
    DO UPDATE SET count = public.rate_limit_counters.count + 1
    RETURNING count INTO v_current;
  ELSIF v_current < _limit THEN
    UPDATE public.rate_limit_counters
    SET count = count + 1
    WHERE bucket = _bucket AND window_start = v_window_start
    RETURNING count INTO v_current;
  END IF;

  -- Opportunistic janitor: purge windows older than 1 day (~1% of calls).
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_counters
     WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_current <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
