-- Tests for 20261113000000_grant_vehicle_photo_delete_helper.sql. Read-only: it inspects privileges and policies
-- and calls nothing.
--   psql ... < supabase/tests/policy_function_grants.test.sql
do $$
declare
  fn regprocedure := to_regprocedure('public.can_delete_vehicle_photo_object(uuid,text)');
  bad text;
begin
  -- 1. the helper of the vehicle-photo delete policy: signed-in users and the service role, nobody else
  assert fn is not null, 'can_delete_vehicle_photo_object: the storage delete policy depends on this function';
  assert has_function_privilege('authenticated', fn, 'execute'), 'authenticated must execute the policy helper';
  assert has_function_privilege('service_role', fn, 'execute'), 'service_role keeps execute';
  assert not has_function_privilege('anon', fn, 'execute'), 'anon must not execute';

  -- 2. no policy written for signed-in users may call a public function that signed-in users cannot execute
  --    (Postgres refuses the whole statement, whichever branch of the policy would have applied)
  select string_agg(pol.schemaname || '.' || pol.tablename || ' / ' || pol.policyname || ' -> ' || p.oid::regprocedure::text, '; ')
    into bad
  from pg_policies pol
  join pg_proc p on p.pronamespace = 'public'::regnamespace
   and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~ ('(^|[^a-zA-Z0-9_])' || p.proname || '\(')
  where ('authenticated' = any(pol.roles) or 'public' = any(pol.roles))
    and not has_function_privilege('authenticated', p.oid, 'execute');
  assert bad is null, 'policies for signed-in users call functions they cannot execute: ' || bad;
end $$;

select 'policy_function_grants tests passed' as result;
