-- 1. Marker for an explicit tenant listing decision -------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS marketplace_visibility_set_by_tenant timestamptz;

COMMENT ON COLUMN public.vehicles.marketplace_visibility_set_by_tenant IS
  'Set when a tenant explicitly chooses Listed / Link only / Hidden. Auto-publish never overrides a row where this is set.';

-- Existing rows that are already published were an explicit act; preserve them.
UPDATE public.vehicles
   SET marketplace_visibility_set_by_tenant = COALESCE(marketplace_visibility_set_by_tenant, now())
 WHERE marketplace_visible IS TRUE
    OR marketplace_unlisted IS TRUE;

-- 2. Shared eligibility predicate -------------------------------------------
CREATE OR REPLACE FUNCTION public.vehicle_is_marketplace_eligible(_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.archived_at IS NULL
     AND v.trashed_at IS NULL
     AND v.status = 'available'
     AND v.current_rate IS NOT NULL
     AND v.current_rate > 0
     AND v.location_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.vehicle_photos vp
        WHERE vp.vehicle_id = v.id
          AND vp.is_visible IS NOT FALSE
     )
    FROM public.vehicles v
   WHERE v.id = _vehicle_id;
$$;

-- 3. Publish every untouched, eligible vehicle for a live team --------------
CREATE OR REPLACE FUNCTION public.publish_eligible_team_vehicles(_team_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_count int := 0;
BEGIN
  SELECT marketplace_visible, platform_fee_confirmed_at, platform_fee_percent
    INTO v_team
    FROM public.teams
   WHERE id = _team_id;

  IF NOT FOUND
     OR v_team.marketplace_visible IS NOT TRUE
     OR v_team.platform_fee_confirmed_at IS NULL
     OR COALESCE(v_team.platform_fee_percent, 0) <= 0 THEN
    RETURN 0;
  END IF;

  WITH published AS (
    UPDATE public.vehicles v
       SET marketplace_visible = true
     WHERE v.team_id = _team_id
       AND v.marketplace_visible IS FALSE
       AND v.marketplace_unlisted IS FALSE
       AND v.marketplace_visibility_set_by_tenant IS NULL
       AND public.vehicle_is_marketplace_eligible(v.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM published;

  RETURN v_count;
END;
$$;

-- 4. Team goes live -> publish the eligible fleet ---------------------------
CREATE OR REPLACE FUNCTION public.fn_publish_fleet_on_team_go_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.marketplace_visible IS TRUE
     AND OLD.marketplace_visible IS DISTINCT FROM TRUE THEN
    PERFORM public.publish_eligible_team_vehicles(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_publish_fleet_on_team_go_live ON public.teams;
CREATE TRIGGER trg_publish_fleet_on_team_go_live
  AFTER UPDATE OF marketplace_visible ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_publish_fleet_on_team_go_live();

-- 5. Vehicle becomes eligible -> list itself --------------------------------
-- Named with an "aa_" prefix so it runs before the enforcement triggers on
-- this table, which must see the final value of marketplace_visible.
CREATE OR REPLACE FUNCTION public.fn_autopublish_vehicle_when_eligible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
BEGIN
  IF NEW.marketplace_visible IS NOT FALSE
     OR NEW.marketplace_unlisted IS TRUE
     OR NEW.marketplace_visibility_set_by_tenant IS NOT NULL
     OR NEW.archived_at IS NOT NULL
     OR NEW.trashed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'available'
     OR NEW.current_rate IS NULL OR NEW.current_rate <= 0
     OR NEW.location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT marketplace_visible, platform_fee_confirmed_at, platform_fee_percent
    INTO v_team
    FROM public.teams
   WHERE id = NEW.team_id;

  IF v_team.marketplace_visible IS NOT TRUE
     OR v_team.platform_fee_confirmed_at IS NULL
     OR COALESCE(v_team.platform_fee_percent, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vehicle_photos vp
     WHERE vp.vehicle_id = NEW.id
       AND vp.is_visible IS NOT FALSE
  ) THEN
    RETURN NEW;
  END IF;

  NEW.marketplace_visible := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_autopublish_vehicle_when_eligible ON public.vehicles;
CREATE TRIGGER aa_autopublish_vehicle_when_eligible
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_autopublish_vehicle_when_eligible();

-- 6. First visible photo can also make a vehicle eligible ------------------
CREATE OR REPLACE FUNCTION public.fn_autopublish_vehicle_on_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF NEW.is_visible IS FALSE THEN
    RETURN NEW;
  END IF;

  SELECT team_id INTO v_team_id
    FROM public.vehicles
   WHERE id = NEW.vehicle_id
     AND marketplace_visible IS FALSE
     AND marketplace_unlisted IS FALSE
     AND marketplace_visibility_set_by_tenant IS NULL;

  IF v_team_id IS NOT NULL THEN
    PERFORM public.publish_eligible_team_vehicles(v_team_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopublish_vehicle_on_photo ON public.vehicle_photos;
CREATE TRIGGER trg_autopublish_vehicle_on_photo
  AFTER INSERT ON public.vehicle_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_autopublish_vehicle_on_photo();

GRANT EXECUTE ON FUNCTION public.publish_eligible_team_vehicles(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vehicle_is_marketplace_eligible(uuid) TO authenticated, service_role;