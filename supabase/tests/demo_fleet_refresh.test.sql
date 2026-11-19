-- Tests for 20261119000000_demo_fleet_refresh.sql. Read-only: inspects the function, the log table and grants;
-- it does not call refresh_demo_fleet().
--   psql ... < supabase/tests/demo_fleet_refresh.test.sql
do $$
declare
  fn oid := to_regprocedure('public.refresh_demo_fleet()');
  src text;
begin
  assert fn is not null, 'public.refresh_demo_fleet() exists and takes no arguments (the team cannot be chosen by the caller)';

  select prosrc into src from pg_proc where oid = fn;
  assert src like '%c1de6533-ab44-4973-a123-007a8007b5ba%', 'the function is pinned to the demo team id';
  assert not (select prosecdef from pg_proc where oid = fn), 'the function runs with the caller''s rights (not SECURITY DEFINER)';
  assert exists (select 1 from pg_proc where oid = fn and 'search_path=public, pg_temp' = any(proconfig)),
    'the function fixes its search_path';

  assert not has_function_privilege('anon', fn, 'execute'), 'anon cannot run the demo refresh';
  assert not has_function_privilege('authenticated', fn, 'execute'), 'signed-in users cannot run the demo refresh';

  assert to_regclass('public.demo_refresh_log') is not null, 'the undo log table exists';
  assert (select relrowsecurity from pg_class where oid = 'public.demo_refresh_log'::regclass),
    'row level security is on for the undo log';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demo_refresh_log'),
    'the undo log has no policies, so only the service role can read it';
  assert not has_table_privilege('anon', 'public.demo_refresh_log', 'select'), 'anon cannot read the undo log';
  assert not has_table_privilege('authenticated', 'public.demo_refresh_log', 'select'), 'signed-in users cannot read the undo log';

  raise notice 'demo_fleet_refresh: all checks passed';
end $$;
