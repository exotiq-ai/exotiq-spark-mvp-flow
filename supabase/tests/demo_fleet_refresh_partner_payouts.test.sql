-- Tests for 20261119010000_demo_fleet_refresh_partner_payouts.sql. Read-only: inspects the functions and grants;
-- it does not call refresh_demo_fleet().
--   psql ... < supabase/tests/demo_fleet_refresh_partner_payouts.test.sql
do $$
declare
  fn oid := to_regprocedure('public.refresh_demo_fleet()');
  snap oid := to_regprocedure('public.demo_refresh_snapshot(uuid, text, uuid[], text)');
  src text;
begin
  assert fn is not null and snap is not null, 'both demo refresh functions exist';
  select prosrc into src from pg_proc where oid = fn;
  assert src like '%partner_payout_generated%', 'payout rows created by the booking trigger are logged for undo';
  assert src like '%payout_before_completion%', 'existing payout rows are snapshotted before a booking is completed';
  assert src like '%Demo record — no transfer%', 'old payouts are marked paid as demo records';
  assert (select prosrc from pg_proc where oid = snap) like '%partner_payouts%', 'the snapshot helper accepts partner_payouts';

  assert not has_function_privilege('anon', fn, 'execute') and not has_function_privilege('authenticated', fn, 'execute'),
    'only the service role can run the demo refresh';
  assert not has_function_privilege('anon', snap, 'execute') and not has_function_privilege('authenticated', snap, 'execute'),
    'only the service role can call the snapshot helper';

  raise notice 'demo_fleet_refresh_partner_payouts: all checks passed';
end $$;
