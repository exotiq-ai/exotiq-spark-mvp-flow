-- Protect kill switch: single source of truth for quotes and bookings.
CREATE OR REPLACE FUNCTION public.protect_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT true $$;
GRANT EXECUTE ON FUNCTION public.protect_enabled() TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_depend WHERE refobjid = 'public.public_vehicle_quote(text,text,date,date,jsonb)'::regprocedure AND deptype = 'n') THEN
    RAISE EXCEPTION 'public_vehicle_quote has dependents; aborting';
  END IF;
END $$;

DROP FUNCTION public.public_vehicle_quote(text, text, date, date, jsonb);

CREATE FUNCTION public.public_vehicle_quote(_team_slug text, _vehicle_slug text, _start_date date, _end_date date, _options jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(currency text, rental_days integer, daily_rate_cents bigint, rental_subtotal_cents bigint, deposit_cents bigint, operator_total_cents bigint, platform_fee_percent numeric, platform_fee_cents bigint, protection_tier text, protection_daily_cents bigint, protection_total_cents bigint, state_fee_cents bigint, processing_fee_cents bigint, exotiq_total_cents bigint, grand_total_cents bigint, state_code text, state_fee_label text, state_fee_daily_cents bigint, operator_tax_rate numeric, operator_tax_label text, operator_tax_cents bigint,
   tax_lines jsonb, service_fee_cents bigint, deposit_hold_cents bigint, fuel_type text, protect_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id,
           v.current_rate,
           v.fuel_type,
           coalesce(v.deposit_override_cents, t.default_deposit_cents)::bigint AS deposit_hold_cents,
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
  opt AS (
    SELECT CASE WHEN public.protect_enabled()
                THEN lower(coalesce(_options->>'protection', 'premium'))
                ELSE 'decline' END AS tier
  ),
  calc AS (
    SELECT tg.currency, tg.fuel_type, tg.deposit_hold_cents,
           (_end_date - _start_date)::int AS rental_days,
           round(tg.current_rate * 100)::bigint AS daily_rate_cents,
           tg.fee_pct, tg.tax_pct, tg.tax_label, tg.tax_inclusive,
           public.team_state_code(tg.team_id) AS state_code,
           public.team_state_fee_daily_cents(tg.team_id) AS state_fee_daily_cents,
           CASE o.tier
             WHEN 'premium'  THEN 28900::bigint
             WHEN 'standard' THEN  8900::bigint
             ELSE 0::bigint
           END AS protection_daily_cents,
           o.tier AS protection_tier
    FROM target tg CROSS JOIN opt o
  ),
  pieces AS (
    SELECT c.*,
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
               (p.rental_subtotal_cents - round(p.rental_subtotal_cents / (1 + p.tax_pct / 100.0)))::bigint
             ELSE round(p.rental_subtotal_cents * p.tax_pct / 100.0)::bigint
           END AS operator_tax_cents
    FROM pieces p
  ),
  totals AS (
    SELECT t.*, round(0.02 * t.rental_subtotal_cents)::bigint AS take_2pct FROM taxed t
  ),
  with_fee AS (
    SELECT t.*,
           (round(0.029 * (t.platform_fee_cents + t.protection_total_cents + t.state_fee_cents + t.take_2pct))::bigint + 30::bigint) AS stripe_fee_cents
    FROM totals t
  )
  SELECT w.currency, w.rental_days, w.daily_rate_cents, w.rental_subtotal_cents,
         0::bigint AS deposit_cents,
         (w.rental_subtotal_cents + CASE WHEN w.tax_inclusive THEN 0 ELSE w.operator_tax_cents END) AS operator_total_cents,
         w.fee_pct AS platform_fee_percent,
         w.platform_fee_cents, w.protection_tier, w.protection_daily_cents, w.protection_total_cents,
         w.state_fee_cents,
         (w.take_2pct + w.stripe_fee_cents) AS processing_fee_cents,
         (w.platform_fee_cents + w.protection_total_cents + w.state_fee_cents + w.take_2pct + w.stripe_fee_cents) AS exotiq_total_cents,
         (w.rental_subtotal_cents + CASE WHEN w.tax_inclusive THEN 0 ELSE w.operator_tax_cents END
            + w.platform_fee_cents + w.protection_total_cents + w.state_fee_cents + w.take_2pct + w.stripe_fee_cents) AS grand_total_cents,
         w.state_code,
         coalesce((SELECT f.label FROM public.state_rental_fees f WHERE f.state_code = w.state_code), 'State rental fee') AS state_fee_label,
         w.state_fee_daily_cents,
         w.tax_pct AS operator_tax_rate,
         w.tax_label AS operator_tax_label,
         w.operator_tax_cents,
         -- v2 display fields (informational until the fee model v2 release)
         (
           CASE WHEN w.tax_pct > 0 THEN jsonb_build_array(jsonb_build_object(
             'label', w.tax_label, 'kind', 'percent', 'rate', w.tax_pct,
             'inclusive', w.tax_inclusive, 'amount_cents', w.operator_tax_cents))
           ELSE '[]'::jsonb END
           ||
           CASE WHEN w.state_fee_cents > 0 THEN jsonb_build_array(jsonb_build_object(
             'label', coalesce((SELECT f.label FROM public.state_rental_fees f WHERE f.state_code = w.state_code), 'State rental fee'),
             'kind', 'per_day', 'daily_cents', w.state_fee_daily_cents,
             'inclusive', false, 'amount_cents', w.state_fee_cents))
           ELSE '[]'::jsonb END
         ) AS tax_lines,
         -- Exact gross-up on the Exotiq charge only: (fee + 0.30) / (1 - 0.029)
         ceil((w.platform_fee_cents + 30) / (1 - 0.029))::bigint AS service_fee_cents,
         w.deposit_hold_cents,
         w.fuel_type,
         public.protect_enabled() AS protect_enabled
  FROM with_fee w;
$function$;

REVOKE ALL ON FUNCTION public.public_vehicle_quote(text,text,date,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text,text,date,date,jsonb) TO PUBLIC, anon, authenticated, service_role;