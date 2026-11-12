-- Tests for 20261112010000_tighten_function_privileges.sql.
-- Part 1 reads the catalogs only. Part 2 calls the functions as existing users of the database it runs on and
-- undoes everything it did (it runs in a sub-transaction that is rolled back), so nothing is left behind. Part 2
-- is skipped with a NOTICE on a database that has no suitable rows (it needs two teams).
--   psql ... < supabase/tests/tighten_function_privileges.test.sql

-- Part 1: privileges, function text, policies -------------------------------------------------------------------
do $$
declare
  sig text;
  fn regprocedure;
  def text;
  pol record;
begin
  -- 1. service role only
  foreach sig in array array[
    'public.find_holds_needing_warning()',
    'public.expire_unverified_holds()',
    'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint)',
    'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint,text)',
    'public.auto_clear_billing_dunning_for_email(text)',
    'public.next_invoice_number(uuid)',
    'public.purge_old_notifications()',
    'public.update_document_status()',
    'public.mark_expired_invitations()',
    'public.generate_recurring_expenses()',
    'public.check_rate_limit(text,integer,integer)',
    'public.log_pii_read(text,uuid,text[])',
    'public.get_user_teams(uuid)',
    'public.get_user_role(uuid)',
    'public.get_team_owner(uuid)',
    'public.count_admins()',
    'public.team_state_code(uuid)',
    'public.team_state_fee_daily_cents(uuid)',
    'public.team_active_vehicle_count(uuid)',
    'public.team_is_writable(uuid)',
    'public.vehicle_is_marketplace_eligible(uuid)'
  ] loop
    fn := to_regprocedure(sig);
    continue when fn is null;  -- a database that never had the function has nothing to restrict
    assert not has_function_privilege('anon', fn, 'execute'), sig || ': anon must not execute';
    assert not has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated must not execute';
    assert has_function_privilege('service_role', fn, 'execute'), sig || ': service_role keeps execute';
    assert has_function_privilege((select proowner from pg_proc where oid = fn), fn, 'execute'), sig || ': the owner keeps execute (scheduled jobs)';
    -- no row-level-security policy may depend on a function that signed-in users can no longer execute
    assert not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_policy'::regclass and d.refclassid = 'pg_proc'::regclass and d.refobjid = fn
    ), sig || ': a policy uses this function';
    assert not exists (
      select 1 from pg_proc p, aclexplode(p.proacl) a
      where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), sig || ': no PUBLIC grant';
  end loop;

  -- 2. signed-in users and the service role
  foreach sig in array array[
    'public.deactivate_team_member(uuid,text)',
    'public.reactivate_team_member(uuid)',
    'public.get_marketplace_readiness(uuid)',
    'public.rename_team(uuid,text,boolean)',
    'public.resolve_deposit_cents(uuid)',
    'public.rate_for_day(uuid,date,numeric)',
    'public.nightly_rates(uuid,date,integer,numeric)',
    'public.quote_nightly(uuid,timestamptz,timestamptz,text,numeric)',
    'public.set_rate_override(uuid,date,date,numeric,text,text,text)',
    'public.revoke_rate_override(uuid)'
  ] loop
    fn := to_regprocedure(sig);
    continue when fn is null;
    assert not has_function_privilege('anon', fn, 'execute'), sig || ': anon must not execute';
    assert has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated keeps execute';
    assert has_function_privilege('service_role', fn, 'execute'), sig || ': service_role keeps execute';
    assert not exists (
      select 1 from pg_proc p, aclexplode(p.proacl) a
      where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ), sig || ': no PUBLIC grant';
  end loop;

  -- 2b. helper functions used by policies: signed-in users keep them. anon has them only where a policy that
  --     applies to anon uses the helper on a table anon can reach (there, a missing EXECUTE would turn an empty
  --     answer into an error), and never otherwise.
  foreach sig in array array[
    'public.can_access_conversation(uuid,uuid)',
    'public.can_access_entity(uuid,text,uuid)',
    'public.can_access_realtime_topic(uuid,text)',
    'public.can_manage_team_or_user_storage_path(uuid,text)',
    'public.can_read_message_attachment_path(uuid,text)',
    'public.can_read_team_or_user_storage_path(uuid,text)',
    'public.can_write_message_attachment_path(uuid,text)',
    'public.can_write_team_or_user_storage_path(uuid,text)',
    'public.has_shared_team_role(uuid,uuid,public.app_role[])',
    'public.has_team_role(uuid,uuid,public.app_role)',
    'public.is_admin_over_user(uuid,uuid)',
    'public.is_conversation_member(uuid,uuid)',
    'public.is_manager_over_user(uuid,uuid)',
    'public.is_same_team(uuid,uuid)'
  ] loop
    fn := to_regprocedure(sig);
    continue when fn is null;
    assert has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated keeps execute';
    assert has_function_privilege('service_role', fn, 'execute'), sig || ': service_role keeps execute';
    assert has_function_privilege('anon', fn, 'execute') = exists (
      select 1
      from pg_policy p
      join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
                      and d.refclassid = 'pg_proc'::regclass and d.refobjid = fn
      where (0 = any (p.polroles) or (select oid from pg_roles where rolname = 'anon') = any (p.polroles))
        and has_table_privilege('anon', p.polrelid, 'select, insert, update, delete')
    ), sig || ': anon may execute it exactly when a policy that applies to anon uses it';
  end loop;

  -- 3. the functions the storefront calls without a session stay open to anon
  for fn in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'public\_%'
  loop
    assert has_function_privilege('anon', fn, 'execute'), fn::text || ': the storefront needs this without a session';
  end loop;

  -- 4. function text: the caller's membership must be active
  foreach sig in array array[
    'public.get_customer_full(uuid)',
    'public.get_document(uuid)',
    'public.get_inspection_photo_meta(uuid)',
    'public.get_rari_message(uuid)',
    'public.log_pii_read(text,uuid,text[])',
    'public.publish_eligible_team_vehicles(uuid)'
  ] loop
    fn := to_regprocedure(sig);
    continue when fn is null;
    assert pg_get_functiondef(fn) ~* 'tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true',
      sig || ': the membership lookup must require an active membership';
  end loop;

  fn := to_regprocedure('public.publish_eligible_team_vehicles(uuid)');
  if fn is not null then
    assert pg_get_functiondef(fn) ~* 'NOT\s+public\.is_super_admin\(auth\.uid\(\)\)', 'publish_eligible_team_vehicles: a platform admin passes';
  end if;

  fn := to_regprocedure('public.rename_team(uuid,text,boolean)');
  if fn is not null then
    def := pg_get_functiondef(fn);
    assert def ~* 'tm\.role\s+IN\s*\(\s*''owner''\s*,\s*''admin''\s*\)\s+AND\s+tm\.is_active\s*=\s*true', 'rename_team: the admin membership must be active';
    assert def ~* 'own\.is_active\s+IS\s+NOT\s+TRUE', 'rename_team: the owner''s own membership must not be switched off';
  end if;

  fn := to_regprocedure('public.get_marketplace_readiness(uuid)');
  if fn is not null then
    assert pg_get_functiondef(fn) ~* 'NOT\s+public\.is_team_member\(auth\.uid\(\),\s*p_team_id\)', 'get_marketplace_readiness: the caller''s team is checked';
  end if;

  foreach sig in array array['public.deactivate_team_member(uuid,text)', 'public.reactivate_team_member(uuid)'] loop
    fn := to_regprocedure(sig);
    assert fn is not null, sig || ': the application depends on this function';
    def := pg_get_functiondef(fn);
    assert def ~* 'me\.is_active\s*=\s*true' and def ~* 'me\.role\s+in\s*\(\s*''owner''\s*,\s*''admin''\s*\)', sig || ': the caller''s own team role is checked';
    assert def !~* 'has_role\s*\(', sig || ': the account-wide role is not what decides';
    assert (select prosecdef from pg_proc where oid = fn), sig || ': still SECURITY DEFINER';
  end loop;

  -- 5. platform admin lookups go by account id
  foreach sig in array array['public.is_super_admin(uuid)', 'public.super_admin_has_permission(text,uuid)'] loop
    fn := to_regprocedure(sig);
    continue when fn is null;
    def := pg_get_functiondef(fn);
    assert def ~* 'sa\.user_id\s*=\s*check_user_id', sig || ': the account id decides';
    assert def !~* 'profiles' and def !~* 'email', sig || ': nothing but the account id decides';
    assert (select prosecdef from pg_proc where oid = fn), sig || ': still SECURITY DEFINER';
    assert not has_function_privilege('anon', fn, 'execute'), sig || ': anon must not execute';
    assert has_function_privilege('authenticated', fn, 'execute'), sig || ': authenticated keeps execute (policies use it)';
  end loop;
  if to_regclass('public.super_admins') is not null then
    assert (select count(*) from pg_policy p where p.polrelid = 'public.super_admins'::regclass) = 1
       and exists (
         select 1 from pg_policy p
         where p.polrelid = 'public.super_admins'::regclass and p.polcmd = 'r'
           and p.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]
           and pg_get_expr(p.polqual, p.polrelid) ~ '^\(?user_id = auth\.uid\(\)\)?$'
       ), 'super_admins: one policy, a platform admin reads their own row';
    if exists (select 1 from public.super_admins sa where coalesce(sa.is_active, true) and sa.user_id is null) then
      raise warning 'tighten_function_privileges test: an active super_admins row has no user_id and matches no account';
    end if;
  end if;

  -- 6. column-level UPDATE: signed-in users update the application's columns only, anon none
  for pol in
    select * from (values
      ('public.profiles',             array['id', 'email', 'is_active', 'created_at', 'handle_changed_at']),
      ('public.team_members',         array['id', 'team_id', 'user_id']),
      ('public.conversation_members', array['id', 'conversation_id', 'user_id', 'role', 'joined_at'])
    ) as v(tbl, kept)
  loop
    continue when to_regclass(pol.tbl) is null;
    assert not has_table_privilege('authenticated', pol.tbl, 'update'), pol.tbl || ': no table-wide UPDATE for authenticated';
    assert not has_any_column_privilege('anon', pol.tbl, 'update'), pol.tbl || ': no UPDATE at all for anon';
    assert has_table_privilege('service_role', pol.tbl, 'update'), pol.tbl || ': service_role keeps UPDATE';
    assert has_table_privilege('authenticated', pol.tbl, 'select')
       and has_table_privilege('authenticated', pol.tbl, 'insert')
       and has_table_privilege('authenticated', pol.tbl, 'delete'), pol.tbl || ': the other privileges of authenticated are untouched';
    assert not exists (
      select 1 from pg_attribute a
      where a.attrelid = to_regclass(pol.tbl) and a.attnum > 0 and not a.attisdropped
        and a.attname = any (pol.kept)
        and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')
    ), pol.tbl || ': the identifying columns are not updatable by authenticated';
    assert not exists (
      select 1 from pg_attribute a
      where a.attrelid = to_regclass(pol.tbl) and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
        and a.attname <> all (pol.kept)
        and not has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')
    ), pol.tbl || ': every other column stays updatable by authenticated (a new column needs its own grant)';
  end loop;

  -- 7. policies
  if to_regclass('public.conversation_members') is not null then
    for pol in
      select p.polname, p.polroles,
             coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as expr
      from pg_policy p
      where p.polrelid = 'public.conversation_members'::regclass and p.polname in ('cm_select', 'cm_insert', 'cm_update')
    loop
      if pol.polname <> 'cm_update' then
        assert pol.expr ~ 'is_team_member\(auth\.uid\(\), tc\.team_id\)', pol.polname || ': follows the conversation''s team';
        assert pol.expr !~ 'is_company_wide_conversation\(', pol.polname || ': the flag alone is not enough';
      end if;
      if pol.polname = 'cm_insert' then
        assert pol.expr ~ 'is_same_team\(auth\.uid\(\), user_id\)', 'cm_insert: the creator adds members of their own team';
      end if;
      assert pol.polroles = array[(select oid from pg_roles where rolname = 'authenticated')], pol.polname || ': for signed-in users';
    end loop;
    assert (select count(*) from pg_policy p where p.polrelid = 'public.conversation_members'::regclass and p.polname in ('cm_select', 'cm_insert', 'cm_update')) = 3,
      'conversation_members: the three policies exist';
  end if;

  if to_regclass('public.team_conversations') is not null then
    for pol in
      select p.polname, p.polroles, coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as expr
      from pg_policy p
      where p.polrelid = 'public.team_conversations'::regclass and p.polcmd in ('a', 'w')
    loop
      assert pol.expr ~ 'is_team_member\(auth\.uid\(\), team_id\)', 'team_conversations / ' || pol.polname || ': the new row follows the creator''s team';
      assert pol.polroles = array[(select oid from pg_roles where rolname = 'authenticated')], 'team_conversations / ' || pol.polname || ': for signed-in users';
    end loop;
    assert (select count(*) from pg_policy p where p.polrelid = 'public.team_conversations'::regclass and p.polcmd in ('a', 'w')) = 2,
      'team_conversations: one insert and one update policy';
  end if;

  if to_regclass('public.team_members') is not null then
    assert not exists (
      select 1 from pg_policy p
      where p.polrelid = 'public.team_members'::regclass and p.polcmd in ('a', '*')
        and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') !~ '^\(?(public\.)?is_super_admin\(auth\.uid\(\)\)\)?$'
    ) and exists (
      select 1 from pg_policy p where p.polrelid = 'public.team_members'::regclass and p.polcmd = 'a'
    ), 'team_members: rows are inserted by server-side code or a platform admin';
  end if;

  if to_regclass('public.profiles') is not null then
    assert exists (
      select 1 from pg_policy p
      where p.polrelid = 'public.profiles'::regclass and p.polcmd = 'w'
        and pg_get_expr(p.polwithcheck, p.polrelid) ~ 'auth\.uid\(\) = id'
    ) and (select count(*) from pg_policy p where p.polrelid = 'public.profiles'::regclass and p.polcmd in ('w', '*')) = 1,
      'profiles: one update policy, own row, stated for the new row';
  end if;
end $$;

-- Part 2: behaviour, as existing users, undone at the end ----------------------------------------------------------
do $$
declare
  a record;          -- a team with an active owner/admin and one more active member
  b record;          -- another team with an active owner/admin
  v_customer uuid;
  v_conv uuid := gen_random_uuid();
  v_conv2 uuid := gen_random_uuid();
  v_email text;
  v_audit bigint;
  failed boolean;
  n bigint;
begin
  select tm.team_id, tm.user_id as admin_id, m.user_id as member_id into a
  from public.team_members tm
  join public.team_members m on m.team_id = tm.team_id and m.user_id <> tm.user_id and m.is_active = true
  where tm.is_active = true and tm.role in ('owner', 'admin')
    and not public.is_super_admin(tm.user_id) and not public.is_super_admin(m.user_id)
    and (select count(*) from public.team_members x where x.user_id = m.user_id) = 1
    and (select count(*) from public.team_members x where x.user_id = tm.user_id) = 1
  order by tm.joined_at, m.joined_at
  limit 1;

  select tm.team_id, tm.user_id as admin_id into b
  from public.team_members tm
  where tm.is_active = true and tm.role in ('owner', 'admin')
    and tm.team_id <> a.team_id
    and not public.is_super_admin(tm.user_id)
    and (select count(*) from public.team_members x where x.user_id = tm.user_id) = 1
  order by tm.joined_at
  limit 1;

  if a.team_id is null or b.team_id is null then
    raise notice 'tighten_function_privileges: behaviour tests skipped (they need two teams, one with an admin and a second member)';
    return;
  end if;

  select c.id into v_customer from public.customers c where c.team_id = a.team_id limit 1;
  select count(*) into v_audit from public.role_audit_log where team_id = a.team_id and user_id = a.member_id;

  begin
    -- as the admin of team A ---------------------------------------------------------------------------------
    perform set_config('request.jwt.claims', json_build_object('sub', a.admin_id, 'role', 'authenticated')::text, true);

    failed := false;
    begin perform public.deactivate_team_member(b.admin_id, 'test'); exception when others then failed := true; end;
    assert failed, 'a member of another team must not be deactivated';
    assert (select is_active from public.team_members where team_id = b.team_id and user_id = b.admin_id), 'the other team''s member is untouched';

    failed := false;
    begin perform public.deactivate_team_member(a.admin_id, 'test'); exception when others then failed := true; end;
    assert failed, 'nobody deactivates himself';

    perform public.deactivate_team_member(a.member_id, 'test');
    assert not (select is_active from public.team_members where team_id = a.team_id and user_id = a.member_id), 'own member: membership switched off';
    assert not (select is_active from public.profiles where id = a.member_id), 'own member: account switched off when no active membership is left';
    assert (select count(*) from public.role_audit_log where team_id = a.team_id and user_id = a.member_id) = v_audit + 1
       and exists (select 1 from public.role_audit_log where team_id = a.team_id and user_id = a.member_id and action = 'user_deactivated' and changed_by = a.admin_id),
      'the change is logged with its team';

    assert public.get_marketplace_readiness(a.team_id) ? 'team_checks', 'own team: the readiness report is returned';
    failed := false;
    begin perform public.get_marketplace_readiness(b.team_id); exception when insufficient_privilege then failed := true; end;
    assert failed, 'another team''s readiness report is refused';

    if v_customer is not null then
      assert (select count(*) from public.get_customer_full(v_customer)) = 1, 'an active member reads a customer of the team';
    end if;

    -- as the member that was just switched off -----------------------------------------------------------------
    perform set_config('request.jwt.claims', json_build_object('sub', a.member_id, 'role', 'authenticated')::text, true);

    failed := false;
    begin perform public.reactivate_team_member(a.member_id); exception when others then failed := true; end;
    assert failed, 'nobody reactivates himself';
    assert not (select is_active from public.profiles where id = a.member_id), 'still switched off';

    if v_customer is not null then
      assert (select count(*) from public.get_customer_full(v_customer)) = 0, 'a switched-off member reads nothing through get_customer_full';
    end if;
    failed := false;
    begin perform public.get_marketplace_readiness(a.team_id); exception when insufficient_privilege then failed := true; end;
    assert failed, 'a switched-off member gets no readiness report';
    failed := false;
    begin perform public.publish_eligible_team_vehicles(a.team_id); exception when others then failed := true; end;
    assert failed, 'a switched-off member cannot publish';
    failed := false;
    begin perform public.rename_team(a.team_id, 'tighten test name', false); exception when others then failed := true; end;
    assert failed, 'a switched-off member cannot rename the team';

    -- as the admin of team B -----------------------------------------------------------------------------------
    perform set_config('request.jwt.claims', json_build_object('sub', b.admin_id, 'role', 'authenticated')::text, true);

    failed := false;
    begin perform public.reactivate_team_member(a.member_id); exception when others then failed := true; end;
    assert failed, 'an admin of another team cannot reactivate the member';
    assert not (select is_active from public.team_members where team_id = a.team_id and user_id = a.member_id), 'still switched off';

    -- back as the admin of team A --------------------------------------------------------------------------------
    perform set_config('request.jwt.claims', json_build_object('sub', a.admin_id, 'role', 'authenticated')::text, true);

    perform public.reactivate_team_member(a.member_id);
    assert (select is_active from public.team_members where team_id = a.team_id and user_id = a.member_id), 'own member: membership back on';
    assert (select is_active from public.profiles where id = a.member_id), 'own member: account back on';
    assert (select count(*) from public.role_audit_log where team_id = a.team_id and user_id = a.member_id) = v_audit + 2
       and exists (select 1 from public.role_audit_log where team_id = a.team_id and user_id = a.member_id and action = 'user_reactivated' and changed_by = a.admin_id),
      'the reactivation is logged with its team';

    -- without a user (service role, scheduled jobs) the readiness report is unchanged
    perform set_config('request.jwt.claims', '', true);
    assert public.get_marketplace_readiness(b.team_id) ? 'team_checks', 'no user: the readiness report is returned';

    -- conversation_members: a company-wide conversation of team B, seen from team A and from team B
    insert into public.team_conversations (id, type, is_company_wide, created_by, team_id, name)
    values (v_conv, 'channel', true, b.admin_id, b.team_id, 'tighten test');
    insert into public.conversation_members (conversation_id, user_id, role) values (v_conv, b.admin_id, 'admin');

    perform set_config('request.jwt.claims', json_build_object('sub', a.admin_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.conversation_members where conversation_id = v_conv;
    failed := false;
    begin
      insert into public.conversation_members (conversation_id, user_id, role) values (v_conv, a.admin_id, 'member');
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert n = 0, 'another team''s company-wide conversation: its member list is not visible';
    assert failed, 'another team''s company-wide conversation: joining is refused';

    perform set_config('request.jwt.claims', json_build_object('sub', b.admin_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.conversation_members where conversation_id = v_conv;
    reset role;
    assert n = 1, 'own team''s company-wide conversation: its member list is visible';

    -- the caller's own profile row: the application's columns yes, the identifying columns no
    perform set_config('request.jwt.claims', json_build_object('sub', a.admin_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.profiles set full_name = full_name, updated_at = now() where id = a.admin_id;
    get diagnostics n = row_count;
    failed := false;
    begin update public.profiles set email = email where id = a.admin_id; exception when insufficient_privilege then failed := true; end;
    reset role;
    assert n = 1, 'own profile: the application''s columns are updatable';
    assert failed, 'own profile: the address column is not updatable by the user';
    set local role authenticated;
    failed := false;
    begin update public.profiles set is_active = true where id = a.admin_id; exception when insufficient_privilege then failed := true; end;
    reset role;
    assert failed, 'own profile: the active flag is not updatable by the user';

    -- platform admin status follows the account id, whatever the address columns hold
    select sa.email into v_email from public.super_admins sa where coalesce(sa.is_active, true) and sa.user_id is not null and sa.email is not null limit 1;
    if v_email is not null then
      update public.profiles set email = v_email where id = a.admin_id;
      assert not public.is_super_admin(a.admin_id), 'the account id decides who is a platform admin';
      if to_regprocedure('public.super_admin_has_permission(text,uuid)') is not null then
        execute 'select count(*) from public.super_admins sa, unnest(coalesce(sa.permissions, array[]::text[])) perm
                 where public.super_admin_has_permission(perm, $1)' into n using a.admin_id;
        assert n = 0, 'the account id decides the platform permissions';
      end if;
      set local role authenticated;
      select count(*) into n from public.super_admins;
      reset role;
      assert n = 0, 'super_admins: no row is visible to another account';
      assert (select bool_and(public.is_super_admin(sa.user_id)) from public.super_admins sa where coalesce(sa.is_active, true) and sa.user_id is not null),
        'platform admins are still recognised by their account id';
    end if;

    -- memberships: a team admin neither creates a row for another account nor re-points one
    set local role authenticated;
    failed := false;
    begin
      insert into public.team_members (team_id, user_id, role, is_active) values (a.team_id, b.admin_id, 'manager', false);
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert failed, 'team_members: a team admin does not create a membership for another account';
    set local role authenticated;
    failed := false;
    begin
      update public.team_members set user_id = b.admin_id where team_id = a.team_id and user_id = a.member_id;
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert failed, 'team_members: a membership row is not re-pointed';
    set local role authenticated;
    update public.team_members set is_active = is_active where team_id = a.team_id and user_id = a.member_id;
    get diagnostics n = row_count;
    reset role;
    assert n = 1, 'team_members: a team admin still updates the other columns of the team''s rows';

    -- conversations: only inside the caller's team
    set local role authenticated;
    failed := false;
    begin
      insert into public.team_conversations (type, is_company_wide, created_by, team_id, name) values ('channel', true, a.admin_id, b.team_id, 'tighten test');
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert failed, 'team_conversations: no conversation in another team';
    set local role authenticated;
    insert into public.team_conversations (id, type, is_company_wide, created_by, team_id, name) values (v_conv2, 'group', false, a.admin_id, a.team_id, 'tighten test');
    insert into public.conversation_members (conversation_id, user_id, role) values (v_conv2, a.admin_id, 'admin');
    insert into public.conversation_members (conversation_id, user_id, role) values (v_conv2, a.member_id, 'member');
    update public.team_conversations set updated_at = now() where id = v_conv2;
    get diagnostics n = row_count;
    failed := false;
    begin
      insert into public.conversation_members (conversation_id, user_id, role) values (v_conv2, b.admin_id, 'member');
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert n = 1, 'team_conversations: the creator still updates a conversation of their team';
    assert failed, 'conversation_members: the creator adds members of their own team only';
    set local role authenticated;
    failed := false;
    begin
      update public.team_conversations set team_id = b.team_id, is_company_wide = true where id = v_conv2;
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert failed, 'team_conversations: a conversation is not moved to another team';
    set local role authenticated;
    update public.conversation_members set last_read_at = now() where conversation_id = v_conv2 and user_id = a.admin_id;
    get diagnostics n = row_count;
    failed := false;
    begin
      update public.conversation_members set conversation_id = v_conv where conversation_id = v_conv2 and user_id = a.admin_id;
    exception when insufficient_privilege then failed := true; end;
    reset role;
    assert n = 1, 'conversation_members: the read marker is updatable';
    assert failed, 'conversation_members: a member row is not moved to another conversation';

    raise exception using errcode = 'TT000', message = 'undo';
  exception when sqlstate 'TT000' then
    null;  -- everything above is rolled back
  end;
end $$;

select 'tighten_function_privileges tests passed' as result;
