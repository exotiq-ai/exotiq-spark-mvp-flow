
-- Backfill: any tenant still at 0% gets the standard 10%.
UPDATE public.teams
SET platform_fee_percent = 10.00
WHERE platform_fee_percent IS NULL OR platform_fee_percent <= 0;

-- Guard: block marketplace_visible = true unless fee is set > 0.
CREATE OR REPLACE FUNCTION public.enforce_platform_fee_on_marketplace_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.marketplace_visible = TRUE
     AND (COALESCE(OLD.marketplace_visible, FALSE) = FALSE OR NEW.marketplace_visible IS DISTINCT FROM OLD.marketplace_visible)
     AND (NEW.platform_fee_percent IS NULL OR NEW.platform_fee_percent <= 0) THEN
    RAISE EXCEPTION 'platform_fee_percent must be greater than 0 before a team can be marketplace_visible'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_platform_fee_on_marketplace_visible ON public.teams;
CREATE TRIGGER trg_enforce_platform_fee_on_marketplace_visible
BEFORE UPDATE OF marketplace_visible, platform_fee_percent ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.enforce_platform_fee_on_marketplace_visible();
