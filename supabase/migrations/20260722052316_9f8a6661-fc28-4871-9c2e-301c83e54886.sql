-- Add optional _require_hero filter to public_team_fleet so the renter UI
-- can hide vehicles without a hero image until photo coverage is seeded.
-- Backwards compatible: default false preserves existing behavior for all
-- callers, and existing GRANT to anon/authenticated survives CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.public_team_fleet(
  _team_slug text,
  _require_hero boolean DEFAULT false
)
RETURNS TABLE (
  vehicle_slug text, name text, make text, model text, year int, color text,
  daily_rate numeric, hero_image_url text, min_rental_days int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
           1 AS min_rental_days
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND public.is_marketplace_vehicle(v.id)
  ) sub
  WHERE (_require_hero = false OR hero_image_url IS NOT NULL)
  ORDER BY daily_rate DESC
$$;

GRANT EXECUTE ON FUNCTION public.public_team_fleet(text, boolean) TO anon, authenticated;