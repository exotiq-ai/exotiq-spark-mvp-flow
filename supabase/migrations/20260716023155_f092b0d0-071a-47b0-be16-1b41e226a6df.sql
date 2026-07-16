CREATE OR REPLACE FUNCTION public.public_team_by_slug(_team_slug text)
RETURNS TABLE (
  slug text, name text, logo_url text, public_description text,
  city text, state text, timezone text, currency text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.slug, t.name, t.logo_url, t.public_description,
         l.city, l.state, t.timezone, t.currency
  FROM public.teams t
  LEFT JOIN LATERAL (
    SELECT loc.city, loc.state
    FROM public.locations loc
    WHERE loc.team_id = t.id AND coalesce(loc.is_active, true)
    ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
    LIMIT 1
  ) l ON true
  WHERE t.slug = _team_slug
    AND public.is_marketplace_team(t.id)
$$;

CREATE OR REPLACE FUNCTION public.public_team_fleet(_team_slug text)
RETURNS TABLE (
  vehicle_slug text, name text, make text, model text, year int, color text,
  daily_rate numeric, hero_image_url text, min_rental_days int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  ORDER BY v.current_rate DESC
$$;

CREATE OR REPLACE FUNCTION public.public_vehicle_by_slug(_team_slug text, _vehicle_slug text)
RETURNS TABLE (
  vehicle_slug text, team_slug text, team_name text, name text, make text, model text,
  year int, color text, daily_rate numeric, rate_3hr numeric, rate_6hr numeric,
  rate_multiday numeric, default_mileage_limit int, mileage_overage_rate numeric,
  hero_image_url text, photos jsonb, pickup_city text, pickup_state text,
  timezone text, currency text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
         l.city AS pickup_city, l.state AS pickup_state, t.timezone, t.currency
  FROM public.vehicles v
  JOIN public.teams t ON t.id = v.team_id
  LEFT JOIN public.locations l ON l.id = v.location_id AND coalesce(l.is_active, true)
  WHERE t.slug = _team_slug
    AND v.slug = _vehicle_slug
    AND public.is_marketplace_vehicle(v.id)
$$;

CREATE OR REPLACE FUNCTION public.public_vehicle_availability(
  _team_slug text, _vehicle_slug text, _range_start date, _range_end date
)
RETURNS TABLE (busy_start date, busy_end date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT v.id AS vehicle_id, coalesce(t.rental_buffer_minutes, 60) AS buffer_minutes
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
  )
  SELECT (b.start_date - make_interval(mins => tg.buffer_minutes))::date AS busy_start,
         (b.end_date + make_interval(mins => tg.buffer_minutes))::date AS busy_end
  FROM public.bookings b
  JOIN target tg ON tg.vehicle_id = b.vehicle_id
  WHERE b.status IN ('pending', 'confirmed', 'active')
    AND b.end_date >= _range_start::timestamptz
    AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.public_vehicle_quote(
  _team_slug text, _vehicle_slug text, _start_date date, _end_date date,
  _options jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  currency text, rental_days int, daily_rate_cents bigint, rental_subtotal_cents bigint,
  operator_total_cents bigint, platform_fee_percent numeric, platform_fee_cents bigint,
  protection_tier text, protection_daily_cents bigint, protection_total_cents bigint,
  exotiq_total_cents bigint, grand_total_cents bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT v.current_rate, t.currency, coalesce(t.platform_fee_percent, 10) AS fee_pct
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
      AND _end_date > _start_date
  ),
  calc AS (
    SELECT tg.currency,
           (_end_date - _start_date)::int AS rental_days,
           round(tg.current_rate * 100)::bigint AS daily_rate_cents,
           tg.fee_pct,
           CASE lower(coalesce(_options->>'protection', 'premium'))
             WHEN 'premium' THEN 28900::bigint
             WHEN 'standard' THEN 8900::bigint
             ELSE 0::bigint
           END AS protection_daily_cents,
           lower(coalesce(_options->>'protection', 'premium')) AS protection_tier
    FROM target tg
  )
  SELECT c.currency, c.rental_days, c.daily_rate_cents,
         c.daily_rate_cents * c.rental_days AS rental_subtotal_cents,
         c.daily_rate_cents * c.rental_days AS operator_total_cents,
         c.fee_pct AS platform_fee_percent,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint AS platform_fee_cents,
         c.protection_tier,
         c.protection_daily_cents,
         c.protection_daily_cents * c.rental_days AS protection_total_cents,
         round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS exotiq_total_cents,
         (c.daily_rate_cents * c.rental_days)
           + round(c.daily_rate_cents * c.rental_days * c.fee_pct / 100.0)::bigint
           + (c.protection_daily_cents * c.rental_days) AS grand_total_cents
  FROM calc c
$$;

GRANT EXECUTE ON FUNCTION public.public_team_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_team_fleet(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_vehicle_by_slug(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_vehicle_availability(text, text, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_vehicle_quote(text, text, date, date, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_marketplace_team(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_marketplace_vehicle(uuid) TO anon, authenticated;