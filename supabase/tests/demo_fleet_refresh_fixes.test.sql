-- Tests for 20261119030000_demo_fleet_refresh_fixes.sql. Read-only: inspects the function and grants;
-- it does not call refresh_demo_fleet().
--   psql ... < supabase/tests/demo_fleet_refresh_fixes.test.sql
do $$
declare
  fn oid := to_regprocedure('public.refresh_demo_fleet()');
  src text;
begin
  assert fn is not null, 'refresh_demo_fleet() exists';
  select prosrc into src from pg_proc where oid = fn;
  assert src not like '%missing := missing ||%', 'no "missing || literal" left (it fails with 22P02 malformed array literal)';
  assert src like '%array_append(missing,%', 'missing states are appended with array_append';
  assert src like '%post_rental_charge%', 'a post-rental charge is raised when no completed rental is left owing';
  assert src like '%demo_payment_dated%' and src like '%partner_payout_generated%',
    'the payment-date and partner-payout handling from the earlier follow-ups is still there';
  assert not has_function_privilege('anon', fn, 'execute') and not has_function_privilege('authenticated', fn, 'execute'),
    'only the service role can run the demo refresh';
  raise notice 'demo_fleet_refresh_fixes: all checks passed';
end $$;
