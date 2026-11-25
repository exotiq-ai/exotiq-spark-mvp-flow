-- Tests for 20261125000000_customers_rls_by_team.sql. Read-only: it inspects functions, policies and privileges
-- and calls nothing.
--   psql ... < supabase/tests/customers_rls_by_team.test.sql
do $$
declare
  fn regprocedure := to_regprocedure('public.has_team_record_role(uuid,uuid,public.app_role[])');
  member_fn regprocedure := to_regprocedure('public.is_team_member_of_record(uuid,uuid)');
  def text;
  pol record;
  n bigint;
begin
  -- 1. the role helper: active membership of the row's team, with the role held in that team
  assert fn is not null, 'has_team_record_role: the customers policies depend on this function';
  select p.prosrc into def from pg_proc p where p.oid = fn;
  assert def ilike '%team_members%', 'has_team_record_role: reads team_members';
  assert def ilike '%tm.team_id = _team_id%', 'has_team_record_role: matches the row''s team, not another user''s';
  assert def ilike '%tm.is_active = true%', 'has_team_record_role: only active memberships count';
  assert def ilike '%_team_id is not null%', 'has_team_record_role: a row with no team grants nothing';
  assert def not ilike '%is_same_team%', 'has_team_record_role: does not go through the creator''s team';
  assert def ilike '%tm.role = any (_roles)%', 'has_team_record_role: checks the role held in that team';
  assert def not ilike '%user_roles%', 'has_team_record_role: a platform role from another team grants nothing here';
  assert (select p.prosecdef from pg_proc p where p.oid = fn), 'has_team_record_role: runs with the owner''s rights';
  assert exists (select 1 from pg_proc p where p.oid = fn and 'search_path=public' = any (p.proconfig)),
    'has_team_record_role: pins search_path';
  assert has_function_privilege('authenticated', fn, 'execute'), 'has_team_record_role: authenticated executes it';
  assert has_function_privilege('service_role', fn, 'execute'), 'has_team_record_role: service_role executes it';
  assert not has_function_privilege('anon', fn, 'execute'), 'has_team_record_role: anon does not';
  assert member_fn is not null, 'is_team_member_of_record: the insert and update policies depend on it';
  assert has_function_privilege('authenticated', member_fn, 'execute'), 'is_team_member_of_record: authenticated executes it';

  -- 2. customers: row security on, exactly the four policies, all for signed-in users
  assert (select c.relrowsecurity from pg_class c where c.oid = 'public.customers'::regclass),
    'customers: row security is on';
  select count(*) into n from pg_policy p where p.polrelid = 'public.customers'::regclass;
  assert n = 4, 'customers: expected exactly 4 policies, found ' || n;
  select count(*) into n
  from pg_policy p
  where p.polrelid = 'public.customers'::regclass
    and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
        ~* '(is_same_team|has_shared_team_role)\(';
  assert n = 0, 'customers: no policy may follow the creator''s team (is_same_team / has_shared_team_role)';

  for pol in
    select p.polname, p.polcmd,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '') as qual,
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as chk,
           (select array_agg(r.rolname::text order by r.rolname) from pg_roles r where r.oid = any (p.polroles)) as roles
    from pg_policy p
    where p.polrelid = 'public.customers'::regclass
  loop
    assert pol.roles = array['authenticated'], 'customers / ' || pol.polname || ': for signed-in users only';
    if pol.polcmd = 'r' then
      assert pol.polname = 'Customers: view by team', 'customers: unexpected SELECT policy ' || pol.polname;
      assert pol.qual ~* 'has_team_record_role\(auth\.uid\(\), team_id,', 'customers / view: keyed on the row''s team_id';
      assert pol.qual ~* 'operator' and pol.qual !~* 'viewer', 'customers / view: owner, admin, manager, operator';
      assert pol.qual ~* 'user_id = auth\.uid\(\)', 'customers / view: the creator keeps access';
    elsif pol.polcmd = 'a' then
      assert pol.polname = 'Customers: insert into own team', 'customers: unexpected INSERT policy ' || pol.polname;
      assert pol.chk ~* 'user_id = auth\.uid\(\)', 'customers / insert: only as yourself';
      assert pol.chk ~* 'is_team_member_of_record\(auth\.uid\(\), team_id\)', 'customers / insert: only into a team you belong to';
    elsif pol.polcmd = 'w' then
      assert pol.polname = 'Customers: update by team', 'customers: unexpected UPDATE policy ' || pol.polname;
      assert pol.qual ~* 'has_team_record_role\(auth\.uid\(\), team_id,', 'customers / update: keyed on the row''s team_id';
      assert pol.qual ~* 'manager' and pol.qual !~* 'operator', 'customers / update: owner, admin, manager';
      assert pol.chk ~* 'is_team_member_of_record\(auth\.uid\(\), team_id\)', 'customers / update: cannot move a row into another team';
    elsif pol.polcmd = 'd' then
      assert pol.polname = 'Customers: delete by team', 'customers: unexpected DELETE policy ' || pol.polname;
      assert pol.qual ~* 'has_team_record_role\(auth\.uid\(\), team_id,', 'customers / delete: keyed on the row''s team_id';
      assert pol.qual ~* 'admin' and pol.qual !~* 'manager', 'customers / delete: owner, admin';
    else
      assert false, 'customers / ' || pol.polname || ': unexpected FOR ALL policy';
    end if;
  end loop;
end $$;

select 'customers_rls_by_team tests passed' as result;
