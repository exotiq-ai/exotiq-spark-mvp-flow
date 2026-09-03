set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. Additive tenant flag (independent of the existing marketplace_visible gate).
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS marketplace_listed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.marketplace_listed IS
  'Drive Exotiq marketplace opt-in (M7f/MP-7). Independent of marketplace_visible, which still gates public readability. A team must pass is_marketplace_team() AND have marketplace_listed = true to appear on the marketplace.';

-- 2. One-time bounded seed: exactly two named rows.
DO $seed$
DECLARE v_n integer;
BEGIN
  UPDATE public.teams SET marketplace_listed = true
   WHERE slug IN ('exotiq', 'exotics-by-the-bay')
     AND marketplace_listed IS DISTINCT FROM true;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n <> 2 THEN
    SELECT count(*) INTO v_n FROM public.teams
     WHERE slug IN ('exotiq', 'exotics-by-the-bay') AND marketplace_listed = true;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'marketplace_listed seed matched % rows, expected 2', v_n;
    END IF;
  END IF;
END
$seed$;

-- 3. Listed teams for the marketplace grid.
CREATE OR REPLACE FUNCTION public.public_marketplace_teams()
RETURNS TABLE (
  slug text,
  name text,
  city text,
  state text,
  timezone text,
  logo_url text,
  verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.slug, t.name, l.city, l.state, t.timezone, t.logo_url,
         false AS verified
  FROM public.teams t
  LEFT JOIN LATERAL (
    SELECT loc.city, loc.state
    FROM public.locations loc
    WHERE loc.team_id = t.id AND coalesce(loc.is_active, true)
    ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
    LIMIT 1
  ) l ON true
  WHERE t.marketplace_listed = true
    AND public.is_marketplace_team(t.id)
$$;

REVOKE ALL ON FUNCTION public.public_marketplace_teams() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_marketplace_teams() TO anon, authenticated, service_role;

-- 4. Cross-tenant fleet for the marketplace grid.
--    Column set mirrors public_team_fleet() exactly, plus team_slug/photo_count/verified.
CREATE OR REPLACE FUNCTION public.public_marketplace_fleet()
RETURNS TABLE (
  vehicle_slug text,
  name text,
  make text,
  model text,
  year integer,
  color text,
  daily_rate numeric,
  hero_image_url text,
  min_rental_days integer,
  team_slug text,
  photo_count integer,
  verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT v.slug AS vehicle_slug, v.name, v.make, v.model, v.year, v.color,
           v.current_rate AS daily_rate,
           coalesce(v.image_url,
             (SELECT coalesce(vp.enhanced_url, vp.url)
              FROM public.vehicle_photos vp
              WHERE vp.vehicle_id = v.id
                AND coalesce(vp.is_visible, true)
                AND coalesce(vp.is_vehicle_confirmed, true)
              ORDER BY vp.display_order NULLS LAST, vp.created_at
              LIMIT 1)) AS hero_image_url,
           1 AS min_rental_days,
           t.slug AS team_slug,
           (SELECT count(*)
            FROM public.vehicle_photos vp2
            WHERE vp2.vehicle_id = v.id
              AND coalesce(vp2.is_visible, true)
              AND coalesce(vp2.is_vehicle_confirmed, true))::integer AS photo_count,
           false AS verified
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.marketplace_listed = true
      AND public.is_marketplace_team(t.id)
      AND coalesce(v.marketplace_unlisted, false) = false
      AND public.is_marketplace_vehicle(v.id)
  ) sub
$$;

REVOKE ALL ON FUNCTION public.public_marketplace_fleet() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_marketplace_fleet() TO anon, authenticated, service_role;