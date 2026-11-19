-- Read-only check of the demo fleet after `select public.refresh_demo_fleet();`.
-- Asserts the states the demo and training-video scripts point at, using the same rules as the app
-- (Pulse → Attention, Bookings, Vault). Changes nothing.
--   psql ... < supabase/tests/demo_fleet_state.check.sql
do $$
declare
  t constant uuid := 'c1de6533-ab44-4973-a123-007a8007b5ba';
  tz text;
  now_ts timestamptz := now();
  day_end timestamptz;
  n int;
begin
  select coalesce(timezone, 'America/Phoenix') into tz from public.teams where id = t;
  assert tz is not null, 'the demo team exists';
  day_end := (date_trunc('day', now_ts at time zone tz) + interval '1 day') at time zone tz;

  -- Pulse → Attention: every category has at least one row, none has dozens
  select count(*) into n from public.bookings
   where team_id = t and status in ('active', 'confirmed') and start_date <= now_ts and end_date < now_ts;
  assert n between 1 and 3, format('late returns: 1–3 (found %s)', n);

  select count(*) into n from public.bookings where team_id = t and status = 'confirmed' and start_date < day_end;
  assert n between 1 and 8, format('pending pickups (confirmed, starting today or earlier): 1–8 (found %s)', n);

  select count(*) into n from public.payments where team_id = t and payment_status in ('pending', 'overdue');
  assert n between 1 and 3, format('overdue payments: 1–3 (found %s)', n);

  select count(*) into n from public.vehicle_tasks where team_id = t and status <> 'completed' and due_at < now_ts;
  assert n between 1 and 3, format('overdue tasks: 1–3 (found %s)', n);

  select count(*) into n from public.work_orders
   where team_id = t and status in ('new','triaged','scheduled','in_progress','blocked_parts','blocked_vendor','qa_review')
     and due_at < now_ts;
  assert n between 1 and 2, format('overdue work orders: 1–2 (found %s)', n);

  select count(*) into n from public.work_orders where team_id = t and status in ('blocked_parts', 'blocked_vendor');
  assert n between 1 and 2, format('blocked work orders: 1–2 (found %s)', n);

  select count(*) into n from public.customers
   where team_id = t
     and ((license_expiry::timestamptz > now_ts and license_expiry::timestamptz <= now_ts + interval '7 days')
       or (insurance_expiry::timestamptz > now_ts and insurance_expiry::timestamptz <= now_ts + interval '7 days'));
  assert n between 1 and 3, format('customers with a licence or insurance expiring within 7 days: 1–3 (found %s)', n);

  select count(*) into n from public.maintenance_schedules
   where team_id = t and coalesce(status, '') <> 'completed' and scheduled_date::timestamptz < day_end + interval '1 day';
  assert n between 1 and 3, format('maintenance due (today, tomorrow or past): 1–3 (found %s)', n);

  -- Bookings: an upcoming pickup and a return
  select count(*) into n from public.bookings
   where team_id = t and status = 'confirmed' and start_date >= now_ts and start_date < now_ts + interval '48 hours';
  assert n >= 1, 'an upcoming pickup in the next 48 hours';

  select count(*) into n from public.bookings
   where team_id = t and status = 'active' and end_date >= now_ts and end_date < now_ts + interval '48 hours';
  assert n >= 1, 'a return due in the next 48 hours';

  -- An active rental with a mileage limit and a pickup odometer reading (mileage overage at check-in)
  select count(*) into n from public.bookings
   where team_id = t and status = 'active' and start_date <= now_ts and end_date > now_ts
     and mileage_limit > 0 and pickup_odometer > 0 and coalesce(unlimited_mileage, false) = false;
  assert n >= 1, 'an active rental with a mileage limit and a pickup odometer';

  -- Vault: one or two documents genuinely expiring (within the Vault''s 30-day window)
  select count(*) into n from public.documents
   where team_id = t and expires_at > now_ts and expires_at <= now_ts + interval '30 days';
  assert n between 1 and 2, format('Vault documents expiring within 30 days: 1–2 (found %s)', n);

  -- Billing: past rentals are paid, apart from a few left open on purpose
  select count(*) into n from public.bookings
   where team_id = t and status = 'completed' and coalesce(payment_status, '') <> 'paid';
  assert n between 1 and 3, format('completed bookings not fully paid: 1–3 (found %s)', n);

  -- Partners: nothing owed for rentals returned more than two weeks ago
  select count(*) into n from public.partner_payouts p join public.bookings b on b.id = p.booking_id
   where p.team_id = t and p.status = 'pending' and b.end_date < now_ts - interval '14 days';
  assert n = 0, format('pending partner payouts older than 14 days: none (found %s)', n);

  raise notice 'demo_fleet_state: all checks passed';
end $$;
