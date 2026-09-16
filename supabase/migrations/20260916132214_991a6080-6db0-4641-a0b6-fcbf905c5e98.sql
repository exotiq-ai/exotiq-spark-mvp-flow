CREATE OR REPLACE FUNCTION public.fn_set_default_vehicle_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc uuid;
BEGIN
  IF NEW.location_id IS NOT NULL OR NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_loc
    FROM public.locations
   WHERE team_id = NEW.team_id
     AND is_default IS TRUE
   ORDER BY created_at
   LIMIT 1;

  IF v_loc IS NULL THEN
    SELECT id INTO v_loc
      FROM public.locations
     WHERE team_id = NEW.team_id
     GROUP BY id
     HAVING (SELECT count(*) FROM public.locations l2 WHERE l2.team_id = NEW.team_id) = 1;
  END IF;

  NEW.location_id := v_loc;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_vehicle_location ON public.vehicles;
CREATE TRIGGER trg_set_default_vehicle_location
BEFORE INSERT ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.fn_set_default_vehicle_location();