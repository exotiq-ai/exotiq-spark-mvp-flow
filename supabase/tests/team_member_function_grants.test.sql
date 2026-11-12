-- Tests for 20261112000000_revoke_anon_team_member_functions.sql. Read-only: it inspects privileges and calls
-- nothing.
--   psql ... < supabase/tests/team_member_function_grants.test.sql
do $$
declare
  sig text;
  fn regprocedure;
begin
  -- 1. the three legacy functions: service role only
  foreach sig in array array[
    'public.deactivate_team_member(uuid, uuid, uuid, text)',
    'public.reactivate_team_member(uuid, uuid, uuid, text)',
    'public.migrate_users_to_teams()'
  ] loop
    fn := to_regprocedure(sig);
    continue when fn is null;  -- a database that never had the function has nothing to restrict
    assert not has_function_privilege('anon', fn, 'execute'), sig || ': anon must not execute';
    assert not has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated must not execute';
    assert has_function_privilege('service_role', fn, 'execute'), sig || ': service_role keeps execute';
    assert not exists (
      select 1 from pg_proc p, aclexplode(p.proacl) a
      where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), sig || ': no PUBLIC grant';
  end loop;

  -- 2. the two versions the application calls stay reachable for signed-in users (they check the caller)
  foreach sig in array array[
    'public.deactivate_team_member(uuid, text)',
    'public.reactivate_team_member(uuid)'
  ] loop
    fn := to_regprocedure(sig);
    assert fn is not null, sig || ': the application depends on this function';
    assert has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated must keep execute';
  end loop;
end $$;

select 'team_member_function_grants tests passed' as result;
