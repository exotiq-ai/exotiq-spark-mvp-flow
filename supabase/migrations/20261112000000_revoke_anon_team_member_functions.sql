-- Restrict three legacy SECURITY DEFINER functions to the service role.
--
-- public.deactivate_team_member(uuid, uuid, uuid, text)
-- public.reactivate_team_member(uuid, uuid, uuid, text)
-- public.migrate_users_to_teams()
--
-- None of the three checks its caller, and all three were executable by `anon`, `authenticated` and PUBLIC.
-- The application calls only the two-argument versions, which check the caller with has_role(auth.uid(), 'admin');
-- nothing in the app, the edge functions, the database or cron calls these three.
-- service_role keeps EXECUTE so a server-side job could still use them.
--
-- Same statement as drizzle/migrations/0011_restrict_legacy_team_member_functions.sql on main (applied to the
-- Lovable project on 2026-11-12). It is repeated here because a project restored from an export taken before that
-- date carries the old grants, and the restore applies supabase/migrations, not the drizzle journal.
-- Safe to run more than once.
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
