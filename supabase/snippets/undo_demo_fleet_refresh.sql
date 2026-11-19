-- Undo one run of public.refresh_demo_fleet(): puts every changed row back as it was and removes the demo
-- payments that run inserted. Set the run id (from the refresh summary or public.demo_refresh_log) first.
--   psql -v run_id="'<run uuid>'" ... < supabase/snippets/undo_demo_fleet_refresh.sql
begin;

create temp table undo_rows on commit drop as
select distinct on (table_name, row_id) table_name, row_id, action, before
  from public.demo_refresh_log
 where run_id = :run_id
 order by table_name, row_id, id;   -- the first snapshot of a row in a run is its original state

delete from public.payments where id in (select row_id from undo_rows where table_name = 'payments' and before is null);
delete from public.partner_payouts where id in (select row_id from undo_rows where table_name = 'partner_payouts' and before is null);

update public.partner_payouts t
   set status = r.status, paid_at = r.paid_at, payout_method = r.payout_method, payout_reference = r.payout_reference,
       gross_rental_base = r.gross_rental_base, platform_fee_amount = r.platform_fee_amount, net_after_fee = r.net_after_fee,
       net_to_partner = r.net_to_partner, reconcile_flag = r.reconcile_flag, reconcile_note = r.reconcile_note
  from undo_rows u, jsonb_populate_record(null::public.partner_payouts, u.before) r
 where u.table_name = 'partner_payouts' and u.before is not null and t.id = u.row_id;

update public.bookings t
   set start_date = r.start_date, end_date = r.end_date, payment_status = r.payment_status,
       balance_due = r.balance_due, paid_at = r.paid_at, mileage_limit = r.mileage_limit,
       mileage_overage_fee = r.mileage_overage_fee, pickup_odometer = r.pickup_odometer, unlimited_mileage = r.unlimited_mileage
  from undo_rows u, jsonb_populate_record(null::public.bookings, u.before) r
 where u.table_name = 'bookings' and t.id = u.row_id;

-- status only where it changed: writing the status column at all fires the booking status triggers
-- (a "completed" write would create partner payouts)
update public.bookings t
   set status = r.status
  from undo_rows u, jsonb_populate_record(null::public.bookings, u.before) r
 where u.table_name = 'bookings' and t.id = u.row_id and t.status is distinct from r.status;

update public.payments t
   set payment_status = r.payment_status, transaction_date = r.transaction_date, notes = r.notes, created_at = r.created_at
  from undo_rows u, jsonb_populate_record(null::public.payments, u.before) r
 where u.table_name = 'payments' and u.before is not null and t.id = u.row_id;

update public.vehicle_tasks t set due_at = r.due_at
  from undo_rows u, jsonb_populate_record(null::public.vehicle_tasks, u.before) r
 where u.table_name = 'vehicle_tasks' and t.id = u.row_id;

update public.work_orders t set status = r.status, due_at = r.due_at, expected_return_at = r.expected_return_at
  from undo_rows u, jsonb_populate_record(null::public.work_orders, u.before) r
 where u.table_name = 'work_orders' and t.id = u.row_id;

update public.maintenance_schedules t set scheduled_date = r.scheduled_date
  from undo_rows u, jsonb_populate_record(null::public.maintenance_schedules, u.before) r
 where u.table_name = 'maintenance_schedules' and t.id = u.row_id;

update public.customers t set license_expiry = r.license_expiry, insurance_expiry = r.insurance_expiry
  from undo_rows u, jsonb_populate_record(null::public.customers, u.before) r
 where u.table_name = 'customers' and t.id = u.row_id;

update public.documents t set expires_at = r.expires_at
  from undo_rows u, jsonb_populate_record(null::public.documents, u.before) r
 where u.table_name = 'documents' and t.id = u.row_id;

-- the undo's own status changes post notices too; remove them
delete from public.notifications
 where xmin = pg_current_xact_id()::xid
   and user_id in (select user_id from public.team_members where team_id = 'c1de6533-ab44-4973-a123-007a8007b5ba');

commit;
-- Vehicle revenue totals are recomputed by the next refresh; they are not restored here.
-- Marketplace bookings: the app re-snapshots the platform fee when a booking completes and then freezes it, so
-- if the team's fee percentage changed since the booking was made, that snapshot is not reverted by this undo.
