-- Tests for 20261119020000_demo_fleet_refresh_payment_dates.sql. Read-only: inspects the function and grants;
-- it does not call refresh_demo_fleet().
--   psql ... < supabase/tests/demo_fleet_refresh_payment_dates.test.sql
do $$
declare
  fn oid := to_regprocedure('public.refresh_demo_fleet()');
  src text;
begin
  assert fn is not null, 'refresh_demo_fleet() exists';
  select prosrc into src from pg_proc where oid = fn;
  assert src like '%demo_payment_dated%', 'demo payment rows from earlier runs are re-dated (and logged for undo)';
  assert src like '%c_note, o.end_date%', 'new demo payment rows are dated when their rental ended';
  assert src like '%interval ''45 days''%', 'only recent pending payments are kept as overdue';
  assert src like '%partner_payout_generated%', 'the partner payout handling from 20261119010000 is still there';
  assert not has_function_privilege('anon', fn, 'execute') and not has_function_privilege('authenticated', fn, 'execute'),
    'only the service role can run the demo refresh';
  raise notice 'demo_fleet_refresh_payment_dates: all checks passed';
end $$;
