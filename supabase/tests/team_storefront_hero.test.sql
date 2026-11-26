-- Tests for 20261116020000_team_storefront_hero.sql. Read-only.
do $$
declare res text;
begin
  assert exists (select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='storefront_hero_url'),
    'teams.storefront_hero_url exists';
  assert exists (select 1 from pg_constraint where conname='teams_storefront_hero_url_https'), 'https check exists';
  select pg_get_function_result('public.public_team_by_slug(text)'::regprocedure) into res;
  assert res like '%pickup_instructions text, storefront_hero_url text)', 'RPC returns storefront_hero_url last: ' || res;
  assert has_function_privilege('anon', 'public.public_team_by_slug(text)', 'execute'), 'anon executes the storefront RPC';
  assert has_function_privilege('authenticated', 'public.public_team_by_slug(text)', 'execute'), 'authenticated executes the storefront RPC';
  assert (select prosecdef from pg_proc where oid='public.public_team_by_slug(text)'::regprocedure), 'still security definer';
end $$;
select 'team_storefront_hero tests passed' as result;
