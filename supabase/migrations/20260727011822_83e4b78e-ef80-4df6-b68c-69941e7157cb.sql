
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS deposit_source_confirmed_at timestamptz;

COMMENT ON COLUMN public.teams.deposit_source_confirmed_at IS
  'Timestamp of the operator''s explicit confirmation of default_deposit_cents in the Command Center. NULL means the value is a system fallback, not an operator choice.';

-- Grandfather live tenants so we don''t retroactively lock them out.
UPDATE public.teams
   SET deposit_source_confirmed_at = now()
 WHERE marketplace_visible IS TRUE
   AND deposit_source_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_deposit_source_on_marketplace_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_confirmed timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'teams' THEN
    IF NEW.marketplace_visible IS TRUE
       AND (OLD.marketplace_visible IS DISTINCT FROM TRUE)
       AND NEW.deposit_source_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Cannot enable marketplace visibility: confirm your default security deposit in Command Center → Team Settings before going live.';
    END IF;
  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    IF NEW.marketplace_visible IS TRUE
       AND (OLD.marketplace_visible IS DISTINCT FROM TRUE) THEN
      IF NEW.deposit_override_cents IS NULL THEN
        SELECT t.deposit_source_confirmed_at
          INTO _team_confirmed
          FROM public.teams t
         WHERE t.id = NEW.team_id;
        IF _team_confirmed IS NULL THEN
          RAISE EXCEPTION 'Cannot enable marketplace visibility on vehicle %: set a per-vehicle deposit override, or confirm the tenant default deposit in Team Settings first.', NEW.id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
