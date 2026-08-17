-- Jurisdiction-aware state fee in the public quote + timezone on booking lookup.
DROP FUNCTION IF EXISTS public.public_vehicle_quote(text, text, date, date, jsonb);

CREATE FUNCTION public.public_vehicle_quote(
  _team_slug text,
  _vehicle_slug text,
  _start_date date,
  _end_date date,
  _options jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  currency text, rental_days integer, daily_rate_cents bigint,
  rental_subtotal_cents bigint, deposit_cents bigint, operator_total_cents bigint,
  platform_fee_percent numeric, platform_fee_cents bigint, protection_tier text,
  protection_daily_cents bigint, protection_total_cents bigint,
  state_fee_cents bigint, processing_fee_cents bigint,
  exotiq_total_cents bigint, grand_total_cents bigint,
  state_code text, state_fee_label text, state_fee_daily_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- State rental fee is jurisdiction-aware as of 2026-08-17: resolved from the
  -- operator's default pickup location state (falling back to their business
  -- address region) against public.state_rental_fees. Unknown state => 0, and
  -- the renter app hides the line when the value is 0.
  --
  -- Processing fee: renter covers Stripe's fee on the EXOTIQ leg only
  -- (Gregory's ruling, 2026-07-28). Estimated once at Stripe standard card
  -- pricing (2.9% + $0.30) — no gross-up.
  WITH target AS (
    SELECT v.id AS vehicle_id,
           v.current_rate,
           t.id AS team_id,
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
  totals AS (
    SELECT p.*,
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
            + w.take_2pct + w.stripe_fee_cents) AS grand_total_cents,
         w.state_code,
         coalesce((SELECT f.label FROM public.state_rental_fees f WHERE f.state_code = w.state_code),
                  'State rental fee') AS state_fee_label,
         w.state_fee_daily_cents
  FROM with_fee w;
$function$;

GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text, text, date, date, jsonb) TO anon, authenticated, service_role;

-- Confirmation page resilience: return the operator timezone with the booking.
DROP FUNCTION IF EXISTS public.public_booking_by_ref(text, uuid);

CREATE FUNCTION public.public_booking_by_ref(_booking_ref text, _token uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  booking_ref text, status text, team_slug text, team_name text, vehicle_slug text,
  vehicle_name text, start_at timestamp with time zone, end_at timestamp with time zone,
  total_cents bigint, currency text, authorized boolean,
  payment_due_at timestamp with time zone, paid_at timestamp with time zone,
  protection_tier text, platform_fee_cents bigint, protection_total_cents bigint,
  identity_verified boolean, state_fee_cents bigint, processing_fee_cents bigint,
  timezone text
)
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
    t.timezone
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$function$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon, authenticated, service_role;