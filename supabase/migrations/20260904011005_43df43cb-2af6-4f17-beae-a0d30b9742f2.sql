set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Restore pre-MP-9 ACLs: these two live functions were executable by PUBLIC before
-- the drop/create, and the recreate must not tighten access.
grant execute on function public.public_team_fleet(text, boolean) to public;
grant execute on function public.public_vehicle_by_slug(text, text) to public;