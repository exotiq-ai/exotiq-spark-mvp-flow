CREATE OR REPLACE FUNCTION public.public_vehicle_by_slug(_team_slug text, _vehicle_slug text)
 RETURNS TABLE(vehicle_slug text, team_slug text, team_name text, name text, make text, model text, year integer, color text, daily_rate numeric, rate_3hr numeric, rate_6hr numeric, rate_multiday numeric, default_mileage_limit integer, mileage_overage_rate numeric, hero_image_url text, photos jsonb, pickup_city text, pickup_state text, timezone text, currency text, body_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.slug AS vehicle_slug, t.slug AS team_slug, t.name AS team_name,
         v.name, v.make, v.model, v.year, v.color,
         v.current_rate AS daily_rate, v.rate_3hr, v.rate_6hr, v.rate_multiday,
         v.default_mileage_limit, v.mileage_overage_rate,
         coalesce(v.image_url,
           (SELECT coalesce(vp.enhanced_url, vp.url)
            FROM public.vehicle_photos vp
            WHERE vp.vehicle_id = v.id
              AND coalesce(vp.is_visible, true)
              AND coalesce(vp.is_vehicle_confirmed, true)
            ORDER BY vp.display_order NULLS LAST, vp.created_at
            LIMIT 1)) AS hero_image_url,
         coalesce(
           (SELECT jsonb_agg(jsonb_build_object(
                     'url', d.url, 'thumbnail_url', d.thumbnail_url, 'display_order', d.display_order
                   ) ORDER BY d.is_hero DESC, d.display_order NULLS LAST, d.created_at)
            FROM (
              SELECT DISTINCT ON (coalesce(vp.enhanced_url, vp.url))
                     coalesce(vp.enhanced_url, vp.url) AS url, vp.thumbnail_url, vp.display_order, vp.created_at,
                     (coalesce(vp.enhanced_url, vp.url) = v.image_url) AS is_hero
              FROM public.vehicle_photos vp
              WHERE vp.vehicle_id = v.id
                AND coalesce(vp.is_visible, true)
                AND coalesce(vp.is_vehicle_confirmed, true)
              ORDER BY coalesce(vp.enhanced_url, vp.url), vp.display_order NULLS LAST, vp.created_at
            ) d),
           '[]'::jsonb) AS photos,
         l.city AS pickup_city, l.state AS pickup_state, t.timezone, t.currency,
         v.body_type
  FROM public.vehicles v
  JOIN public.teams t ON t.id = v.team_id
  LEFT JOIN public.locations l ON l.id = v.location_id AND coalesce(l.is_active, true)
  WHERE t.slug = _team_slug
    AND v.slug = _vehicle_slug
    AND public.is_marketplace_vehicle(v.id)
$function$;