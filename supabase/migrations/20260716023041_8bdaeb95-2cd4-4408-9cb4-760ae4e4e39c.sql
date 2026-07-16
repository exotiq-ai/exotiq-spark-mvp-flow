-- M3 part 1: catalog schema

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(btrim(regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'), '-'), '')
$$;

WITH base AS (
  SELECT
    v.id,
    coalesce(public.slugify(concat_ws(' ', v.year::text, v.make, v.model)), 'vehicle') AS base_slug,
    row_number() OVER (
      PARTITION BY v.team_id, coalesce(public.slugify(concat_ws(' ', v.year::text, v.make, v.model)), 'vehicle')
      ORDER BY v.created_at NULLS LAST, v.id
    ) AS rn
  FROM public.vehicles v
  WHERE v.slug IS NULL
)
UPDATE public.vehicles v
SET slug = CASE WHEN b.rn = 1 THEN b.base_slug ELSE b.base_slug || '-' || b.rn END
FROM base b
WHERE v.id = b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_team_slug
ON public.vehicles (team_id, slug)
WHERE slug IS NOT NULL AND team_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_set_vehicle_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_candidate text;
  v_counter int := 1;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_base := coalesce(public.slugify(concat_ws(' ', NEW.year::text, NEW.make, NEW.model)), 'vehicle');
  v_candidate := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE team_id IS NOT DISTINCT FROM NEW.team_id
      AND slug = v_candidate
      AND id <> NEW.id
  ) LOOP
    v_counter := v_counter + 1;
    v_candidate := v_base || '-' || v_counter;
  END LOOP;
  NEW.slug := v_candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_vehicle_slug ON public.vehicles;
CREATE TRIGGER trg_set_vehicle_slug
  BEFORE INSERT OR UPDATE OF make, model, year
  ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_vehicle_slug();

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS marketplace_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_description text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS marketplace_visible boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_marketplace_team(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND t.marketplace_visible = true
      AND coalesce(t.is_demo_account, false) = false
      AND coalesce(t.is_deleted, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_marketplace_vehicle(_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = _vehicle_id
      AND v.marketplace_visible = true
      AND v.status IN ('available', 'booked')
      AND v.archived_at IS NULL
      AND v.trashed_at IS NULL
      AND v.team_id IS NOT NULL
      AND public.is_marketplace_team(v.team_id)
  )
$$;

CREATE INDEX IF NOT EXISTS idx_vehicles_marketplace
ON public.vehicles (team_id)
WHERE marketplace_visible = true;