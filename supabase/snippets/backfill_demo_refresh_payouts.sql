-- One-off: log the partner payouts that a refresh made with the FIRST version of refresh_demo_fleet()
-- (migration 20261119000000 alone) created through trg_generate_partner_payout, so that
-- undo_demo_fleet_refresh.sql removes them too. Later versions log these rows themselves.
-- Adds rows to public.demo_refresh_log only; changes no fleet data. Safe to run twice.
--   psql -v run_id="'<run uuid>'" ... < supabase/snippets/backfill_demo_refresh_payouts.sql
-- The payouts it logs are the ones created in that run's transaction (created_at = the run's timestamp) for
-- bookings that run completed.
insert into public.demo_refresh_log (run_id, table_name, row_id, action, before)
select l0.run_id, 'partner_payouts', p.id, 'partner_payout_generated', null
  from (select :run_id::uuid as run_id, min(run_at) as run_at from public.demo_refresh_log where run_id = :run_id::uuid) l0
  join public.partner_payouts p on p.created_at = l0.run_at
 where p.booking_id in (select row_id from public.demo_refresh_log
                         where run_id = l0.run_id and table_name = 'bookings' and action = 'past_rental_completed')
   and not exists (select 1 from public.demo_refresh_log l
                    where l.run_id = l0.run_id and l.table_name = 'partner_payouts' and l.row_id = p.id);
