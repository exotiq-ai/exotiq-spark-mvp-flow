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

REVOKE ALL ON FUNCTION public.guard_marketplace_booking_blocked_dates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_marketplace_blocked_dates ON public.bookings;
CREATE TRIGGER trg_guard_marketplace_blocked_dates
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_booking_blocked_dates();