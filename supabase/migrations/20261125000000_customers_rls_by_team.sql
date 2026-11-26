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
-- The role is the member's role in that team (team_members.role). The platform role in user_roles no longer counts:
-- every self-signup holds platform 'admin', which made a viewer in another team an admin of its customers.
-- Support sessions join the team as 'admin', so they keep working. The vehicles / bookings / payments / damage_claims
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
         and tm.role = any (_roles)
     )
$$;

comment on function public.has_team_record_role(uuid, uuid, public.app_role[]) is
  'True when the user is an active member of the team with one of the roles in that team. '
  'For row-level security on tables that carry team_id.';

revoke all on function public.has_team_record_role(uuid, uuid, public.app_role[]) from public, anon;
grant execute on function public.has_team_record_role(uuid, uuid, public.app_role[]) to authenticated, service_role;

alter table public.customers enable row level security;

-- Drop every policy on customers, whatever its name: policies are OR'ed, so one left over (an older name, or one
-- added outside the migrations) would keep the old access. A second run also starts clean this way.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'customers' loop
    execute format('drop policy %I on public.customers', pol.policyname);
  end loop;
end $$;

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
