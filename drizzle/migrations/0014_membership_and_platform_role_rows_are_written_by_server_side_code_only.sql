-- Membership, ownership and platform-role rows are written by server-side code only.
--
-- 1. Platform admin lookup: is_super_admin() and super_admin_has_permission() match on the account id only.
--    A super_admins row without a user id matches nobody until its user_id is set (a NOTICE says how many).
-- 2. team_members: signed-in clients do not insert rows, do not move a row to another team or user, do not
--    grant, remove or self-assign roles involving the owner role, and do not delete or deactivate an owner's
--    row. Invitations (accept-invite), the member activation functions, support sessions and the sign-up
--    trigger run on the service role or as SECURITY DEFINER functions and are not affected.
-- 3. teams.owner_id: not changed by signed-in clients.
-- 4. deletion_requests: rows are created and updated by the two edge functions (service role) only.
--
-- The file can be run again. No tenant data is changed.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Platform admin lookup
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.is_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.super_admins sa
    where coalesce(sa.is_active, true) = true
      and sa.user_id = check_user_id
  );
$function$;

create or replace function public.super_admin_has_permission(permission_name text, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.super_admins sa
    where coalesce(sa.is_active, true) = true
      and permission_name = any(coalesce(sa.permissions, array[]::text[]))
      and sa.user_id = check_user_id
  );
$function$;

-- a platform admin reads their own row
drop policy if exists "Super admins can view super_admins table" on public.super_admins;
create policy "Super admins can view super_admins table"
  on public.super_admins
  for select
  to authenticated
  using (user_id = auth.uid());

do $$
declare
  n bigint;
begin
  select count(*) into n from public.super_admins sa where coalesce(sa.is_active, true) = true and sa.user_id is null;
  if n > 0 then
    raise notice 'membership_write_guards: % active super_admins row(s) have no user_id and match no account', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. team_members
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.guard_team_member_write()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Server-side writers (service role, SECURITY DEFINER functions, migrations) are not restricted.
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role::text = 'owner' then
      raise exception 'An owner membership cannot be removed here' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Team memberships are created through invitations' using errcode = '42501';
  end if;

  if new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id then
    raise exception 'A membership cannot be moved to another team or user' using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     and (new.role::text = 'owner' or old.role::text = 'owner' or old.user_id = auth.uid()) then
    raise exception 'This role change is not available here' using errcode = '42501';
  end if;

  if old.role::text = 'owner' and new.is_active is distinct from old.is_active then
    raise exception 'An owner membership cannot be switched on or off here' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_team_member_write() from public, anon, authenticated;

drop trigger if exists guard_team_member_write on public.team_members;
create trigger guard_team_member_write
  before insert or update or delete on public.team_members
  for each row execute function public.guard_team_member_write();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. teams.owner_id
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.guard_team_owner_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') and new.owner_id is distinct from old.owner_id then
    raise exception 'Team ownership cannot be changed here' using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_team_owner_change() from public, anon, authenticated;

drop trigger if exists guard_team_owner_change on public.teams;
create trigger guard_team_owner_change
  before update on public.teams
  for each row execute function public.guard_team_owner_change();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. deletion_requests
-- ---------------------------------------------------------------------------------------------------------------
drop policy if exists "Team owners can create deletion requests" on public.deletion_requests;
drop policy if exists "Team owners can update deletion requests" on public.deletion_requests;