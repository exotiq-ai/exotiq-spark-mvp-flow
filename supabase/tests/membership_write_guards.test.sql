-- Tests for 20261112020000_membership_write_guards.sql. Read-only: it inspects functions, triggers, policies and
-- privileges and calls nothing.
--   psql ... < supabase/tests/membership_write_guards.test.sql
do $$
declare
  sig text;
  fn regprocedure;
  def text;
  pol record;
  trg record;
  n bigint;
begin
  -- 1. platform admin lookup: by account id, without reading profiles or an address column
  foreach sig in array array[
    'public.is_super_admin(uuid)',
    'public.super_admin_has_permission(text,uuid)'
  ] loop
    fn := to_regprocedure(sig);
    assert fn is not null, sig || ': the application depends on this function';
    select p.prosrc into def from pg_proc p where p.oid = fn;
    assert def ilike '%sa.user_id = check_user_id%', sig || ': matches on the account id';
    assert def not ilike '%profiles%', sig || ': does not read profiles';
    assert def not ilike '%email%', sig || ': does not compare addresses';
    assert (select p.prosecdef from pg_proc p where p.oid = fn), sig || ': runs with the owner''s rights';
    assert has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated keeps execute (policies use it)';
    assert has_function_privilege('service_role', fn, 'execute'), sig || ': service_role keeps execute';
  end loop;

  -- a platform admin reads their own row, and nothing else is offered to clients on that table
  select p.polcmd, pg_get_expr(p.polqual, p.polrelid) as qual,
         (select array_agg(r.rolname::text order by r.rolname) from pg_roles r where r.oid = any (p.polroles)) as roles
    into pol
  from pg_policy p
  where p.polrelid = 'public.super_admins'::regclass and p.polname = 'Super admins can view super_admins table';
  assert found, 'super_admins: the read policy exists';
  assert pol.polcmd = 'r', 'super_admins: the policy covers SELECT only';
  assert pol.roles = array['authenticated'], 'super_admins: the policy is for signed-in users';
  assert replace(replace(pol.qual, '(', ''), ')', '') = 'user_id = auth.uid', 'super_admins: a platform admin reads their own row';
  assert (select c.relrowsecurity from pg_class c where c.oid = 'public.super_admins'::regclass),
    'super_admins: row security is on';

  -- 2. team_members: every client write passes the guard
  fn := to_regprocedure('public.guard_team_member_write()');
  assert fn is not null, 'guard_team_member_write() exists';
  assert (select p.prorettype = 'trigger'::regtype and not p.prosecdef from pg_proc p where p.oid = fn),
    'guard_team_member_write(): a trigger function that runs as the caller';
  assert not has_function_privilege('anon', fn, 'execute'), 'guard_team_member_write(): anon must not execute';
  assert not has_function_privilege('authenticated', fn, 'execute'), 'guard_team_member_write(): authenticated must not execute';
  assert not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ), 'guard_team_member_write(): no PUBLIC grant';
  select t.tgtype, t.tgenabled, t.tgfoid into trg
  from pg_trigger t
  where t.tgrelid = 'public.team_members'::regclass and t.tgname = 'guard_team_member_write' and not t.tgisinternal;
  assert found, 'team_members: the guard trigger exists';
  assert trg.tgfoid = fn, 'team_members: the trigger calls guard_team_member_write()';
  assert trg.tgenabled = 'O', 'team_members: the trigger is enabled';
  -- tgtype bits: 1 row, 2 before, 4 insert, 8 delete, 16 update
  assert trg.tgtype = 31, 'team_members: before insert or update or delete, for each row';

  -- 3. teams: a change of owner_id passes the guard
  fn := to_regprocedure('public.guard_team_owner_change()');
  assert fn is not null, 'guard_team_owner_change() exists';
  assert (select p.prorettype = 'trigger'::regtype and not p.prosecdef from pg_proc p where p.oid = fn),
    'guard_team_owner_change(): a trigger function that runs as the caller';
  assert not has_function_privilege('anon', fn, 'execute'), 'guard_team_owner_change(): anon must not execute';
  assert not has_function_privilege('authenticated', fn, 'execute'), 'guard_team_owner_change(): authenticated must not execute';
  assert not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ), 'guard_team_owner_change(): no PUBLIC grant';
  select t.tgtype, t.tgenabled, t.tgfoid into trg
  from pg_trigger t
  where t.tgrelid = 'public.teams'::regclass and t.tgname = 'guard_team_owner_change' and not t.tgisinternal;
  assert found, 'teams: the guard trigger exists';
  assert trg.tgfoid = fn, 'teams: the trigger calls guard_team_owner_change()';
  assert trg.tgenabled = 'O', 'teams: the trigger is enabled';
  assert trg.tgtype = 19, 'teams: before update, for each row';

  -- 4. deletion_requests: clients read, the two edge functions (service role) write
  assert (select c.relrowsecurity from pg_class c where c.oid = 'public.deletion_requests'::regclass),
    'deletion_requests: row security is on';
  select count(*) into n
  from pg_policy p
  where p.polrelid = 'public.deletion_requests'::regclass and p.polcmd in ('a', 'w', 'd', '*');
  assert n = 0, 'deletion_requests: no policy lets a client insert, update or delete a row';
  assert not exists (
    select 1 from pg_policy p
    where p.polrelid = 'public.deletion_requests'::regclass
      and p.polname in ('Team owners can create deletion requests', 'Team owners can update deletion requests')
  ), 'deletion_requests: the two client write policies are gone';
  assert exists (
    select 1 from pg_policy p where p.polrelid = 'public.deletion_requests'::regclass and p.polcmd = 'r'
  ), 'deletion_requests: the read policy stays';
end $$;

select 'membership_write_guards tests passed' as result;
