-- 1) Backfill deposit_override_cents from legacy dollar column, cents-safe.
-- Only fills where an override is not already set and legacy value is > 0.
UPDATE public.vehicles
   SET deposit_override_cents = round(default_security_deposit * 100)::bigint
 WHERE deposit_override_cents IS NULL
   AND default_security_deposit IS NOT NULL
   AND default_security_deposit > 0;

-- 2) Rewire public_vehicle_quote to source deposit_cents from resolve_deposit_cents(v.id).
-- Signature unchanged; only the deposit column derivation changes.
CREATE OR REPLACE FUNCTION public.public_vehicle_quote(
  _team_slug text, _vehicle_slug text, _start_date date, _end_date date,
  _options jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  currency text, rental_days integer, daily_rate_cents bigint,
  rental_subtotal_cents bigint, deposit_cents bigint, operator_total_cents bigint,
  platform_fee_percent numeric, platform_fee_cents bigint, protection_tier text,
  protection_daily_cents bigint, protection_total_cents bigint,
  exotiq_total_cents bigint, grand_total_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id,
           v.current_rate,
           public.resolve_deposit_cents(v.id) AS deposit_cents,
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
           coalesce(tg.deposit_cents, 0)::bigint AS deposit_cents,
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
$function$;