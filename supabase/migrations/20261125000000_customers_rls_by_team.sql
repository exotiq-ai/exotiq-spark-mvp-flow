-- Customers: grant team access by the customer's own team (customers.team_id), not by the creator's current team.
--
-- Before: the SELECT / UPDATE / DELETE policies (20251226193106) let a user in when
--   user_id = auth.uid()  OR  (is_same_team(auth.uid(), user_id) AND has_role(...))
-- is_same_team compares the two users' *active* memberships. So a customer row followed its creator: when the
-- creator left the team, switched teams, or ended a support session (end_support_session deletes the temporary
-- membership), the team lost the row and the creator's other team could read it.
--
-- After:
--   SELECT  creator, or an active member of customers.team_id with role owner / admin / manager / operator
--   UPDATE  creator, or an active member of customers.team_id with role owner / admin / manager;
--           the row after the update must belong to a team the user is an active member of (or to no team)
--   DELETE  creator, or an active member of customers.team_id with role owner / admin
--   INSERT  creator only, and only into a team the user is an active member of (or no team)
-- The role is the member's role in that team, or (as before) their platform role in user_roles, so nobody who reads
-- a team's customers today through their platform role loses it. The vehicles / bookings / payments / damage_claims
-- policies (20260103050456) already key on team_id; customers was the one table left behind.
--
-- Safe to run more than once.

create or replace function public.has_team_record_role(_user_id uuid, _team_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _team_id is not null
     and exists (
       select 1
       from public.team_members tm
       where tm.user_id = _user_id
         and tm.team_id = _team_id
         and tm.is_active = true
         and (
           tm.role = any (_roles)
           or exists (
             select 1 from public.user_roles ur
             where ur.user_id = _user_id
               and ur.role = any (_roles)
           )
         )
     )
$$;

comment on function public.has_team_record_role(uuid, uuid, public.app_role[]) is
  'True when the user is an active member of the team and holds one of the roles, in that team or as platform role. '
  'For row-level security on tables that carry team_id.';

revoke all on function public.has_team_record_role(uuid, uuid, public.app_role[]) from public, anon;
grant execute on function public.has_team_record_role(uuid, uuid, public.app_role[]) to authenticated, service_role;

alter table public.customers enable row level security;

-- the policies this migration replaces, by every name they have carried
drop policy if exists "Users can view own customers" on public.customers;
drop policy if exists "Users can insert own customers" on public.customers;
drop policy if exists "Users can update own customers" on public.customers;
drop policy if exists "Users can delete own customers" on public.customers;
drop policy if exists "Team members can view customers" on public.customers;
drop policy if exists "Owners can insert customers" on public.customers;
drop policy if exists "Authorized users can update customers" on public.customers;
drop policy if exists "Authorized users can delete customers" on public.customers;
-- and the ones it creates, so a second run starts clean
drop policy if exists "Customers: view by team" on public.customers;
drop policy if exists "Customers: insert into own team" on public.customers;
drop policy if exists "Customers: update by team" on public.customers;
drop policy if exists "Customers: delete by team" on public.customers;

create policy "Customers: view by team"
on public.customers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_team_record_role(auth.uid(), team_id, array['owner', 'admin', 'manager', 'operator']::public.app_role[])
);

create policy "Customers: insert into own team"
on public.customers
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (team_id is null or public.is_team_member_of_record(auth.uid(), team_id))
);

create policy "Customers: update by team"
on public.customers
for update
to authenticated
using (
  user_id = auth.uid()
  or public.has_team_record_role(auth.uid(), team_id, array['owner', 'admin', 'manager']::public.app_role[])
)
with check (
  (team_id is null or public.is_team_member_of_record(auth.uid(), team_id))
  and (
    user_id = auth.uid()
    or public.has_team_record_role(auth.uid(), team_id, array['owner', 'admin', 'manager']::public.app_role[])
  )
);

create policy "Customers: delete by team"
on public.customers
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_team_record_role(auth.uid(), team_id, array['owner', 'admin']::public.app_role[])
);
