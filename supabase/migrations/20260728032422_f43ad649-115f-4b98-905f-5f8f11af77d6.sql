-- Phase A: quote no longer rolls deposit into totals. Signature unchanged.
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
         0::bigint AS deposit_cents,
         c.daily_rate_cents * c.rental_days AS operator_total_cents,
         c.fee_pct AS platform_fee_percent,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint AS platform_fee_cents,
         c.protection_tier,
         c.protection_daily_cents,
         c.protection_daily_cents * c.rental_days AS protection_total_cents,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS exotiq_total_cents,
         (c.daily_rate_cents * c.rental_days)
           + round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS grand_total_cents
  FROM calc c
$function$;

GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text, text, date, date, jsonb) TO anon, authenticated, service_role;

-- Phase D: marketplace-readiness gate swap — deposit source -> platform fee confirmed.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS platform_fee_confirmed_at timestamptz;

COMMENT ON COLUMN public.teams.platform_fee_confirmed_at IS
  'Timestamp when an admin explicitly confirmed platform_fee_percent. Required (with fee > 0) to set marketplace_visible = true. Cleared whenever platform_fee_percent changes.';

-- Backfill: any team already live on the marketplace is grandfathered as confirmed.
UPDATE public.teams
   SET platform_fee_confirmed_at = COALESCE(platform_fee_confirmed_at, now())
 WHERE marketplace_visible = true
   AND platform_fee_percent IS NOT NULL
   AND platform_fee_percent > 0;

-- Clear the confirmation stamp any time the fee changes.
CREATE OR REPLACE FUNCTION public.clear_platform_fee_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.platform_fee_percent IS DISTINCT FROM OLD.platform_fee_percent THEN
    NEW.platform_fee_confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_platform_fee_confirmation_on_teams ON public.teams;
CREATE TRIGGER clear_platform_fee_confirmation_on_teams
  BEFORE UPDATE OF platform_fee_percent ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.clear_platform_fee_confirmation();

-- Replace the deposit-source enforcement with platform-fee enforcement.
CREATE OR REPLACE FUNCTION public.enforce_platform_fee_on_marketplace_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_confirmed_at timestamptz;
  v_fee_pct numeric;
BEGIN
  IF TG_TABLE_NAME = 'teams' THEN
    IF NEW.marketplace_visible = true
       AND (OLD.marketplace_visible IS DISTINCT FROM NEW.marketplace_visible
            OR NEW.platform_fee_confirmed_at IS NULL
            OR NEW.platform_fee_percent IS NULL
            OR NEW.platform_fee_percent <= 0)
       AND (NEW.platform_fee_confirmed_at IS NULL
            OR NEW.platform_fee_percent IS NULL
            OR NEW.platform_fee_percent <= 0) THEN
      RAISE EXCEPTION 'platform_fee_percent must be explicitly confirmed (> 0 and platform_fee_confirmed_at set) before a team can be marketplace_visible'
        USING ERRCODE = 'check_violation', HINT = 'Confirm the platform fee in Super Admin -> Marketplace Readiness.';
    END IF;
  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    IF NEW.marketplace_visible = true THEN
      SELECT t.platform_fee_confirmed_at, t.platform_fee_percent
        INTO v_confirmed_at, v_fee_pct
        FROM public.teams t
       WHERE t.id = NEW.team_id;
      IF v_confirmed_at IS NULL OR v_fee_pct IS NULL OR v_fee_pct <= 0 THEN
        RAISE EXCEPTION 'Owning team must confirm platform_fee_percent (> 0) before a vehicle can be marketplace_visible'
          USING ERRCODE = 'check_violation', HINT = 'Confirm the platform fee in Super Admin -> Marketplace Readiness.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Swap triggers: drop deposit-source, install platform-fee.
DROP TRIGGER IF EXISTS enforce_deposit_source_on_teams ON public.teams;
DROP TRIGGER IF EXISTS enforce_deposit_source_on_vehicles ON public.vehicles;

DROP TRIGGER IF EXISTS enforce_platform_fee_on_teams ON public.teams;
CREATE TRIGGER enforce_platform_fee_on_teams
  BEFORE UPDATE OF marketplace_visible, platform_fee_percent, platform_fee_confirmed_at ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_platform_fee_on_marketplace_visible();

DROP TRIGGER IF EXISTS enforce_platform_fee_on_vehicles ON public.vehicles;
CREATE TRIGGER enforce_platform_fee_on_vehicles
  BEFORE INSERT OR UPDATE OF marketplace_visible ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_platform_fee_on_marketplace_visible();