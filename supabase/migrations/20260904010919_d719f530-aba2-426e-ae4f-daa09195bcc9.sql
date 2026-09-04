set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. Column + fixed vocabulary
alter table public.vehicles add column if not exists body_type text;
comment on column public.vehicles.body_type is 'Optional vehicle body/type classification from a fixed vocabulary (MP-9). Null when unset.';

alter table public.vehicles drop constraint if exists vehicles_body_type_check;
alter table public.vehicles add constraint vehicles_body_type_check
  check (body_type is null or body_type in ('supercar','sports-car','luxury-sedan','luxury-suv','grand-tourer','convertible','hypercar'));

-- 2. public_team_fleet(text, boolean) -- drop + create (return type changes)
drop function if exists public.public_team_fleet(text, boolean);

create function public.public_team_fleet(_team_slug text, _require_hero boolean default false)
returns table(vehicle_slug text, name text, make text, model text, year integer, color text, daily_rate numeric, hero_image_url text, min_rental_days integer, body_type text)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
           v.body_type
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND coalesce(v.marketplace_unlisted, false) = false
      AND public.is_marketplace_vehicle(v.id)
  ) sub
  WHERE (_require_hero = false OR hero_image_url IS NOT NULL)
  ORDER BY daily_rate DESC
$function$;

revoke all on function public.public_team_fleet(text, boolean) from public;
grant execute on function public.public_team_fleet(text, boolean) to anon, authenticated, service_role;

-- 3. public_marketplace_fleet()
drop function if exists public.public_marketplace_fleet();

create function public.public_marketplace_fleet()
returns table(vehicle_slug text, name text, make text, model text, year integer, color text, daily_rate numeric, hero_image_url text, min_rental_days integer, team_slug text, photo_count integer, verified boolean, body_type text)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
           false AS verified,
           v.body_type
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.marketplace_listed = true
      AND public.is_marketplace_team(t.id)
      AND coalesce(v.marketplace_unlisted, false) = false
      AND public.is_marketplace_vehicle(v.id)
  ) sub
$function$;

revoke all on function public.public_marketplace_fleet() from public;
grant execute on function public.public_marketplace_fleet() to anon, authenticated, service_role;

-- 4. public_vehicle_by_slug(text, text)
drop function if exists public.public_vehicle_by_slug(text, text);

create function public.public_vehicle_by_slug(_team_slug text, _vehicle_slug text)
returns table(vehicle_slug text, team_slug text, team_name text, name text, make text, model text, year integer, color text, daily_rate numeric, rate_3hr numeric, rate_6hr numeric, rate_multiday numeric, default_mileage_limit integer, mileage_overage_rate numeric, hero_image_url text, photos jsonb, pickup_city text, pickup_state text, timezone text, currency text, body_type text)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
                     'url', coalesce(vp.enhanced_url, vp.url),
                     'thumbnail_url', vp.thumbnail_url,
                     'display_order', vp.display_order
                   ) ORDER BY vp.display_order NULLS LAST, vp.created_at)
            FROM public.vehicle_photos vp
            WHERE vp.vehicle_id = v.id
              AND coalesce(vp.is_visible, true)
              AND coalesce(vp.is_vehicle_confirmed, true)),
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

revoke all on function public.public_vehicle_by_slug(text, text) from public;
grant execute on function public.public_vehicle_by_slug(text, text) to anon, authenticated, service_role;