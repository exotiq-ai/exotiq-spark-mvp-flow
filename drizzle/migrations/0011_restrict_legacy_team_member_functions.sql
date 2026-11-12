do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.deactivate_team_member(uuid, uuid, uuid, text)',
    'public.reactivate_team_member(uuid, uuid, uuid, text)',
    'public.migrate_users_to_teams()'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end $$;