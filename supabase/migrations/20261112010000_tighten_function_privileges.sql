-- Tighten who may execute a set of database functions, and scope a few membership checks to the caller's team.
--
-- 1. Functions that only server-side code calls (edge functions on the service role, scheduled jobs that run as
--    the owner, other SECURITY DEFINER functions): EXECUTE for service_role only.
-- 2. Functions that only a signed-in user needs: EXECUTE for authenticated and service_role.
-- 3. The same for helper functions used by policies written for signed-in users.
-- 4. deactivate_team_member(uuid, text) and reactivate_team_member(uuid): the caller must be an active owner or
--    admin of a team the member belongs to (or a platform admin), and only that team's membership changes.
-- 5. Functions that look up the caller's team: the membership must be active.
-- 6. get_marketplace_readiness(uuid): a signed-in caller must belong to the team (or be a platform admin).
-- 7. Platform admin lookups go by account id.
-- 8. profiles, team_members, conversation_members: signed-in users update only the columns the application
--    writes; the identifying columns are set by server-side code.
-- 9. Conversation and membership policies follow the caller's team.
--
-- No data is changed. Every statement is skipped when its object is absent, and the file can be run again.
-- It must run AFTER any step that resets privileges to an earlier state (such a reset would undo parts 1 to 3
-- and part 8).

-- ---------------------------------------------------------------------------------------------------------------
-- 1 to 3. Privileges
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare
  sig text;
begin
  -- 1. service role only. Callers: rent-payment-scheduler, rent-create-booking, check-subscription,
  --    generate-vat-invoice, generate-recurring-expenses and the shared rate limiter (all on the service role),
  --    the scheduled jobs (they run as the owner), and other SECURITY DEFINER functions (log_pii_read, and the
  --    five team/vehicle helpers at the end, which the quote, publish and subscription-health functions call).
  --    The four lookup helpers before them have no caller at all.
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
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;

  -- 2. signed-in users and the service role: functions the application calls after sign-in, and the date-rate
  --    functions (present only where the date-rate migrations ran).
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
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon', sig);
      execute format('grant execute on function %s to authenticated, service_role', sig);
    end if;
  end loop;

  -- 3. the same for helper functions that take a user id and are used by row-level-security policies written for
  --    `authenticated`, or by other SECURITY DEFINER functions. A helper is left as it is (with a WARNING) when a
  --    policy that applies to `anon` uses it on a table `anon` can reach: there, a missing EXECUTE would turn an
  --    empty answer into an error.
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
    continue when to_regprocedure(sig) is null;
    if exists (
      select 1
      from pg_policy p
      join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
                      and d.refclassid = 'pg_proc'::regclass and d.refobjid = to_regprocedure(sig)
      where (0 = any (p.polroles) or (select oid from pg_roles where rolname = 'anon') = any (p.polroles))
        and has_table_privilege('anon', p.polrelid, 'select, insert, update, delete')
    ) then
      raise warning 'tighten_function_privileges: % is used by a policy that applies to anon; its grants are left as they are', sig;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon', sig);
    execute format('grant execute on function %s to authenticated, service_role', sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Team member activation: scoped to the caller's team
-- ---------------------------------------------------------------------------------------------------------------
-- Rules (both functions):
--   * the caller is signed in and is not the member being changed;
--   * the caller is an active owner or admin of a team the member belongs to: only that team's membership changes;
--   * a platform admin who is not in one of the member's teams acts on the member as a whole
--     (deactivate: every membership; reactivate: only when the member has a single membership);
--   * profiles.is_active follows the memberships: it is cleared when no active membership is left and set when
--     a membership is reactivated, which is what the team directory screen shows as "inactive" / "active";
--   * each change is written to role_audit_log with the team it concerns.
do $$
begin
  if to_regprocedure('public.deactivate_team_member(uuid,text)') is not null then
    execute $ddl$
create or replace function public.deactivate_team_member(target_user_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_actor uuid := auth.uid();
  v_super boolean;
  v_teams uuid[];
begin
  if v_actor is null then
    raise exception 'Only admins can deactivate team members';
  end if;
  if target_user_id is null then
    raise exception 'A team member is required';
  end if;
  if target_user_id = v_actor then
    raise exception 'Cannot deactivate yourself';
  end if;

  v_super := public.is_super_admin(v_actor);

  -- the team in which the caller is an active owner or admin and the member has a membership
  select array_agg(t.team_id) into v_teams
  from public.team_members t
  where t.user_id = target_user_id
    and exists (
      select 1 from public.team_members me
      where me.team_id = t.team_id
        and me.user_id = v_actor
        and me.is_active = true
        and me.role in ('owner', 'admin')
    );

  if v_teams is null then
    if not v_super then
      raise exception 'Only admins can deactivate team members';
    end if;
    -- platform admin outside the member's teams: the member as a whole
    select coalesce(array_agg(t.team_id), '{}'::uuid[]) into v_teams
    from public.team_members t
    where t.user_id = target_user_id;
  end if;

  if not v_super and public.is_super_admin(target_user_id) then
    raise exception 'This user can only be deactivated by a platform admin';
  end if;

  update public.team_members
  set is_active = false
  where user_id = target_user_id
    and team_id = any (v_teams)
    and is_active is distinct from false;

  -- the account itself is switched off only when no active membership is left in any team
  if not exists (
    select 1 from public.team_members where user_id = target_user_id and is_active = true
  ) then
    update public.profiles
    set is_active = false,
        updated_at = now()
    where id = target_user_id
      and is_active is distinct from false;
  end if;

  insert into public.role_audit_log (user_id, changed_by, action, team_id, metadata)
  select target_user_id, v_actor, 'user_deactivated', x.team_id,
         jsonb_build_object('reason', coalesce(reason, 'No reason provided'))
  from unnest(case when cardinality(v_teams) = 0 then array[null::uuid] else v_teams end) as x(team_id);
end;
$fn$
    $ddl$;
  end if;

  if to_regprocedure('public.reactivate_team_member(uuid)') is not null then
    execute $ddl$
create or replace function public.reactivate_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_actor uuid := auth.uid();
  v_super boolean;
  v_team uuid;
  v_active_team uuid;
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Only admins can reactivate team members';
  end if;
  if target_user_id is null then
    raise exception 'A team member is required';
  end if;
  if target_user_id = v_actor then
    raise exception 'Cannot reactivate yourself';
  end if;

  v_super := public.is_super_admin(v_actor);

  -- the team in which the caller is an active owner or admin and the member has a membership
  select t.team_id into v_team
  from public.team_members t
  join public.team_members me on me.team_id = t.team_id
  where t.user_id = target_user_id
    and me.user_id = v_actor
    and me.is_active = true
    and me.role in ('owner', 'admin')
  limit 1;

  if v_team is null then
    if not v_super then
      raise exception 'Only admins can reactivate team members';
    end if;
    -- platform admin outside the member's teams: only when there is no doubt which membership is meant
    select count(*), (array_agg(t.team_id))[1] into v_count, v_team
    from public.team_members t
    where t.user_id = target_user_id;
    if v_count > 1 then
      raise exception 'This user belongs to more than one team; reactivate them from inside the team';
    end if;
  end if;

  select t.team_id into v_active_team
  from public.team_members t
  where t.user_id = target_user_id and t.is_active = true
  limit 1;

  if v_team is not null and v_active_team is not null and v_active_team <> v_team then
    raise exception 'This user is active in another team and cannot be reactivated here';
  end if;

  if v_team is not null then
    update public.team_members
    set is_active = true
    where user_id = target_user_id
      and team_id = v_team
      and is_active is distinct from true;
  end if;

  update public.profiles
  set is_active = true,
      updated_at = now()
  where id = target_user_id
    and is_active is distinct from true;

  insert into public.role_audit_log (user_id, changed_by, action, team_id, metadata)
  values (target_user_id, v_actor, 'user_reactivated', v_team, jsonb_build_object());
end;
$fn$
    $ddl$;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5 and 6. Membership lookups require an active membership; the readiness report requires the caller's team
-- ---------------------------------------------------------------------------------------------------------------
-- Each entry edits one expression of an existing function and leaves the rest of its body as it is, so a body
-- that has changed elsewhere is not overwritten. An entry is skipped when the function is absent or already has
-- the change. When the expected text is not found the function is left alone and a WARNING says so (the test
-- file then fails for that function).
do $$
declare
  r record;
  fn regprocedure;
  def text;
  new_def text;
begin
  for r in
    select * from (values
      -- the caller's team is the one in which the membership is active
      (1, 'public.get_customer_full(uuid)',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s+LIMIT\s+1)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (2, 'public.get_document(uuid)',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s+LIMIT\s+1)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (3, 'public.get_inspection_photo_meta(uuid)',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s+LIMIT\s+1)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (4, 'public.get_rari_message(uuid)',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s+LIMIT\s+1)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (5, 'public.log_pii_read(text,uuid,text[])',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s+LIMIT\s+1)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      -- rename_team: an owner or admin membership counts only while it is active, and the team's recorded owner
      -- does not pass while their own membership of that team is switched off
      (6, 'public.rename_team(uuid,text,boolean)',
          $p$(tm\.role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*\))$p$,
          $r$\1 AND tm.is_active = true$r$,
          $d$tm\.role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (7, 'public.rename_team(uuid,text,boolean)',
          $p$v_team\.owner_id\s*=\s*v_uid$p$,
          $r$(v_team.owner_id = v_uid AND NOT EXISTS (SELECT 1 FROM public.team_members own WHERE own.team_id = _team_id AND own.user_id = v_uid AND own.is_active IS NOT TRUE))$r$,
          $d$own\.is_active\s+IS\s+NOT\s+TRUE$d$),
      -- publish_eligible_team_vehicles: the caller's membership must be active. A platform admin is let through,
      -- because the approval of a team (done by a platform admin) reaches this function through a trigger.
      (8, 'public.publish_eligible_team_vehicles(uuid)',
          $p$(tm\.user_id\s*=\s*auth\.uid\(\))(\s*\)\s*THEN)$p$,
          $r$\1 AND tm.is_active = true\2$r$,
          $d$tm\.user_id\s*=\s*auth\.uid\(\)\s+AND\s+tm\.is_active\s*=\s*true$d$),
      (9, 'public.publish_eligible_team_vehicles(uuid)',
          $p$(IF\s+auth\.uid\(\)\s+IS\s+NOT\s+NULL)(\s+AND\s+NOT\s+EXISTS)$p$,
          $r$\1 AND NOT public.is_super_admin(auth.uid())\2$r$,
          $d$IF\s+auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+public\.is_super_admin\(auth\.uid\(\)\)$d$),
      -- get_marketplace_readiness: a signed-in caller must be an active member of the team or a platform admin.
      -- Calls without a user (service role) are unchanged.
      (10, 'public.get_marketplace_readiness(uuid)',
          $p$(\nBEGIN[ \t\r]*\n)$p$,
          $r$\1  IF auth.uid() IS NOT NULL
     AND NOT public.is_team_member(auth.uid(), p_team_id)
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

$r$,
          $d$NOT\s+public\.is_team_member\(auth\.uid\(\),\s*p_team_id\)$d$)
    ) as v(ord, sig, pattern, replacement, done_pattern)
    order by ord
  loop
    fn := to_regprocedure(r.sig);
    continue when fn is null;
    def := pg_get_functiondef(fn);
    continue when def ~* r.done_pattern;
    new_def := regexp_replace(def, r.pattern, r.replacement, 'i');
    if new_def = def then
      raise warning 'tighten_function_privileges: % was left unchanged, the expected text was not found (entry %)', r.sig, r.ord;
      continue;
    end if;
    execute new_def;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Platform admin lookups go by account id
-- ---------------------------------------------------------------------------------------------------------------
-- A platform admin is the account named by super_admins.user_id. The address columns of super_admins and of
-- profiles are information only. A row of super_admins without a user id matches nobody: the WARNING below says
-- how many there are (set user_id on such a row to give that account its access back).
do $$
declare
  n bigint;
begin
  if to_regclass('public.super_admins') is null then
    return;
  end if;

  if to_regprocedure('public.is_super_admin(uuid)') is not null then
    execute $ddl$
create or replace function public.is_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from public.super_admins sa
    where coalesce(sa.is_active, true) = true
      and sa.user_id = check_user_id
  );
$fn$
    $ddl$;
  end if;

  if to_regprocedure('public.super_admin_has_permission(text,uuid)') is not null then
    execute $ddl$
create or replace function public.super_admin_has_permission(permission_name text, check_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from public.super_admins sa
    where coalesce(sa.is_active, true) = true
      and permission_name = any (coalesce(sa.permissions, array[]::text[]))
      and sa.user_id = check_user_id
  );
$fn$
    $ddl$;
  end if;

  -- a platform admin reads their own row
  drop policy if exists "Super admins can view super_admins table" on public.super_admins;
  create policy "Super admins can view super_admins table" on public.super_admins
    for select to authenticated
    using (user_id = auth.uid());

  select count(*) into n from public.super_admins sa where coalesce(sa.is_active, true) = true and sa.user_id is null;
  if n > 0 then
    raise warning 'tighten_function_privileges: % active super_admins row(s) have no user_id and match no account', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Column-level UPDATE for signed-in users
-- ---------------------------------------------------------------------------------------------------------------
-- On these tables a signed-in user may update every column except the ones listed, which identify the row or are
-- maintained by server-side code (SECURITY DEFINER functions, triggers, the service role):
--   profiles              id, email, is_active, created_at, handle_changed_at
--   team_members          id, team_id, user_id
--   conversation_members  id, conversation_id, user_id, role, joined_at
-- Row-level-security policies still decide WHICH rows. anon has no UPDATE here at all (it never matched a row).
-- A column added to one of these tables later is not covered: grant UPDATE on that column to authenticated in
-- the migration that adds it, never UPDATE on the whole table.
do $$
declare
  r record;
  cols text;
begin
  for r in
    select * from (values
      ('public.profiles',             array['id', 'email', 'is_active', 'created_at', 'handle_changed_at']),
      ('public.team_members',         array['id', 'team_id', 'user_id']),
      ('public.conversation_members', array['id', 'conversation_id', 'user_id', 'role', 'joined_at'])
    ) as v(tbl, kept)
  loop
    continue when to_regclass(r.tbl) is null;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = to_regclass(r.tbl)
      and a.attnum > 0
      and not a.attisdropped
      and a.attgenerated = ''
      and a.attname <> all (r.kept);
    -- revoking the table privilege also removes every column-level UPDATE granted earlier
    execute format('revoke update on table %s from public, anon, authenticated', r.tbl);
    if cols is not null then
      execute format('grant update (%s) on table %s to authenticated', cols, r.tbl);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. Conversation and membership policies follow the caller's team
-- ---------------------------------------------------------------------------------------------------------------
-- conversation_members
--   select: own rows, rows of conversations the caller created, and rows of a company-wide conversation of a team
--           the caller is an active member of.
--   insert: the creator of a conversation adds themselves and members of their own team; anyone else can only
--           add themselves, as an ordinary member, to a company-wide conversation of their own team.
--   update: own rows (the columns are limited in part 8).
-- team_conversations
--   insert, update: by the creator; a conversation that names a team must name a team the creator is an active
--           member of, and only such a conversation can be company-wide.
-- team_members
--   insert: memberships are created by server-side code (sign-up, invitation acceptance, support sessions) or by
--           a platform admin. Team admins keep UPDATE and DELETE on their own team's rows.
-- profiles
--   update: own row, stated for the new row as well.
-- The policies that were written for every role are now for signed-in users (other roles never had a matching row).
do $$
begin
  if to_regclass('public.conversation_members') is not null
     and to_regclass('public.team_conversations') is not null
     and to_regprocedure('public.is_conversation_creator(uuid,uuid)') is not null
     and to_regprocedure('public.is_same_team(uuid,uuid)') is not null
     and to_regprocedure('public.is_team_member(uuid,uuid)') is not null then

    drop policy if exists cm_select on public.conversation_members;
    create policy cm_select on public.conversation_members
      for select to authenticated
      using (
        user_id = auth.uid()
        or public.is_conversation_creator(conversation_id, auth.uid())
        or exists (
          select 1 from public.team_conversations tc
          where tc.id = conversation_members.conversation_id
            and tc.is_company_wide = true
            and tc.team_id is not null
            and public.is_team_member(auth.uid(), tc.team_id)
        )
      );

    drop policy if exists cm_insert on public.conversation_members;
    create policy cm_insert on public.conversation_members
      for insert to authenticated
      with check (
        (
          public.is_conversation_creator(conversation_id, auth.uid())
          and (user_id = auth.uid() or public.is_same_team(auth.uid(), user_id))
        )
        or (
          user_id = auth.uid()
          and coalesce(role, 'member') = 'member'
          and exists (
            select 1 from public.team_conversations tc
            where tc.id = conversation_members.conversation_id
              and tc.is_company_wide = true
              and tc.team_id is not null
              and public.is_team_member(auth.uid(), tc.team_id)
          )
        )
      );

    drop policy if exists cm_update on public.conversation_members;
    create policy cm_update on public.conversation_members
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());

    drop policy if exists "Users can create conversations" on public.team_conversations;
    create policy "Users can create conversations" on public.team_conversations
      for insert to authenticated
      with check (
        auth.uid() = created_by
        and (
          (team_id is null and is_company_wide is not true)
          or (team_id is not null and public.is_team_member(auth.uid(), team_id))
        )
      );

    drop policy if exists tc_update on public.team_conversations;
    create policy tc_update on public.team_conversations
      for update to authenticated
      using (created_by = auth.uid())
      with check (
        created_by = auth.uid()
        and (
          (team_id is null and is_company_wide is not true)
          or (team_id is not null and public.is_team_member(auth.uid(), team_id))
        )
      );
  end if;

  if to_regclass('public.team_members') is not null
     and to_regprocedure('public.is_super_admin(uuid)') is not null then
    drop policy if exists "Team admins can add members" on public.team_members;
    drop policy if exists "Platform admins can add members" on public.team_members;
    create policy "Platform admins can add members" on public.team_members
      for insert to authenticated
      with check (public.is_super_admin(auth.uid()));
  end if;

  if to_regclass('public.profiles') is not null then
    drop policy if exists "Users can update own profile" on public.profiles;
    create policy "Users can update own profile" on public.profiles
      for update to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;
