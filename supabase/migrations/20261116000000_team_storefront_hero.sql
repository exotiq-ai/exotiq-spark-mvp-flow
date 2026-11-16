-- An operator's own hero image for their storefront page on exotiq.rent.
--
-- Until now the storefront hero was the photo of the operator's first car. This adds an optional, operator-chosen
-- image (a public https URL, normally in the public bucket dashboard-banners) and returns it from
-- public_team_by_slug, the RPC the storefront reads. When it is null the storefront keeps using the first car's
-- photo, so nothing changes for operators that do not set one.
--
-- Who can set it: the same people who can update team settings today (policy "Only owners can update team
-- settings"); the column inherits the table's privileges. Additive: no data is changed.

alter table public.teams add column if not exists storefront_hero_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teams_storefront_hero_url_https') then
    alter table public.teams add constraint teams_storefront_hero_url_https
      check (storefront_hero_url is null or (storefront_hero_url ~ '^https://' and length(storefront_hero_url) <= 2048));
  end if;
end $$;

comment on column public.teams.storefront_hero_url is
  'Optional hero image for the public storefront page (https URL). Null: the storefront shows the first vehicle photo.';

-- The return type changes (one column appended at the end), so the function is dropped and created again in the
-- same transaction. Body unchanged apart from the new column.
drop function if exists public.public_team_by_slug(text);

create function public.public_team_by_slug(_team_slug text)
 returns table(slug text, name text, logo_url text, public_description text, city text, state text, timezone text,
               currency text, support_email text, support_phone text, pickup_address text, pickup_instructions text,
               storefront_hero_url text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT t.slug, t.name, t.logo_url, t.public_description,
         l.city, l.state, t.timezone, t.currency,
         nullif(btrim(t.support_email), ''),
         nullif(btrim(t.support_phone), ''),
         public.resolve_pickup_address(t.id, NULL),
         nullif(btrim(t.pickup_instructions), ''),
         nullif(btrim(t.storefront_hero_url), '')
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
$function$;

grant execute on function public.public_team_by_slug(text) to anon, authenticated, service_role;
