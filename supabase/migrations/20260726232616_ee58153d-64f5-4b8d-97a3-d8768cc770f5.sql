-- 1. Bookings: fields the deposit-hold flow needs.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_hold_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operator_stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS deposit_card_requested_at timestamptz;

-- 2. Marketplace-visibility gate: require a deposit source.
CREATE OR REPLACE FUNCTION public.enforce_deposit_source_on_marketplace_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resolved bigint;
BEGIN
  IF TG_TABLE_NAME = 'teams' THEN
    IF NEW.marketplace_visible IS TRUE
       AND (OLD.marketplace_visible IS DISTINCT FROM TRUE)
       AND NEW.default_deposit_cents IS NULL THEN
      RAISE EXCEPTION 'Cannot enable marketplace visibility: teams.default_deposit_cents must be set first';
    END IF;
  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    IF NEW.marketplace_visible IS TRUE
       AND (OLD.marketplace_visible IS DISTINCT FROM TRUE) THEN
      SELECT public.resolve_deposit_cents(NEW.id) INTO _resolved;
      IF _resolved IS NULL THEN
        RAISE EXCEPTION 'Cannot enable marketplace visibility on vehicle %: no deposit source (set vehicles.deposit_override_cents or teams.default_deposit_cents)', NEW.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_deposit_source_on_teams ON public.teams;
CREATE TRIGGER enforce_deposit_source_on_teams
  BEFORE UPDATE OF marketplace_visible ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_source_on_marketplace_visible();

DROP TRIGGER IF EXISTS enforce_deposit_source_on_vehicles ON public.vehicles;
CREATE TRIGGER enforce_deposit_source_on_vehicles
  BEFORE UPDATE OF marketplace_visible ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deposit_source_on_marketplace_visible();