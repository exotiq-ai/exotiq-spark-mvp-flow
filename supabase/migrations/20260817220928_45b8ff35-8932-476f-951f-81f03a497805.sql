update public.team_members
set is_active = false
where id = '08f23e89-6e19-4028-8508-8930ad09bc0f';

insert into public.team_members (team_id, user_id, role, is_active, joined_at)
select '780f425c-3733-40c7-855f-ff3c5addbb60', '36f85701-6c21-4d1d-ac12-175259fb1f5f', 'admin', true, now()
where not exists (
  select 1 from public.team_members
  where team_id = '780f425c-3733-40c7-855f-ff3c5addbb60'
    and user_id = '36f85701-6c21-4d1d-ac12-175259fb1f5f'
);

insert into public.user_roles (user_id, role)
select '36f85701-6c21-4d1d-ac12-175259fb1f5f', 'admin'
where not exists (
  select 1 from public.user_roles where user_id = '36f85701-6c21-4d1d-ac12-175259fb1f5f'
);

update public.user_invitations
set status = 'accepted'
where email ilike 'exoticsbythebay@exotiq.ai'
  and team_id = '780f425c-3733-40c7-855f-ff3c5addbb60'
  and status = 'pending';

update public.profiles
set company_name = (select name from public.teams where id = '780f425c-3733-40c7-855f-ff3c5addbb60'),
    onboarding_completed = true,
    updated_at = now()
where id = '36f85701-6c21-4d1d-ac12-175259fb1f5f';