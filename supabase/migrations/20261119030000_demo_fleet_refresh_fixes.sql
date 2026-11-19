-- Demo fleet refresh, third follow-up (after 20261119000000, 010000 and 020000): two fixes found on production.
--
-- 1. "missing := missing || 'some state'" fails with 22P02 (malformed array literal): with missing text[],
--    Postgres reads the untyped literal as text[]. Any branch that reported a missing state crashed the whole
--    refresh. Every one now uses array_append().
-- 2. When no completed rental is left owing (on production the three balances were the old overdue payments,
--    which this version settles), the refresh now raises post-rental charges on the most recently returned
--    rental (6% of the rental, at least 85; a pending "balance" payment due two days after return, logged for
--    undo) instead of reporting the state as missing.
-- Everything else is unchanged. Like the earlier migrations, this only replaces the functions.

-- Copies the current rows (before a change) into the undo log.
create or replace function public.demo_refresh_snapshot(p_run uuid, p_table text, p_ids uuid[], p_action text)
returns integer
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if p_table not in ('bookings', 'payments', 'partner_payouts', 'vehicle_tasks', 'work_orders', 'maintenance_schedules', 'customers', 'documents') then
    raise exception 'demo_refresh_snapshot: unexpected table %', p_table;
  end if;
  execute format(
    'insert into public.demo_refresh_log (run_id, table_name, row_id, action, before)
     select $1, %L, x.id, $2, to_jsonb(x) from public.%I x where x.id = any($3)', p_table, p_table)
  using p_run, p_action, p_ids;
  get diagnostics n = row_count;
  return n;
end
$fn$;

create or replace function public.refresh_demo_fleet()
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  c_team constant uuid := 'c1de6533-ab44-4973-a123-007a8007b5ba';
  c_active_wo constant text[] := array['new','triaged','scheduled','in_progress','blocked_parts','blocked_vendor','qa_review'];
  c_note constant text := 'Demo record — no Stripe charge';
  v_run uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_team record;
  v_tz text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_start timestamptz;
  ids uuid[];
  keep uuid[];
  n integer;
  r record;
  summary jsonb := '{}'::jsonb;
  missing text[] := '{}';
begin
  select * into v_team from teams where id = c_team;
  if not found then
    raise exception 'refresh_demo_fleet: demo team % not found', c_team;
  end if;
  v_tz := coalesce(nullif(v_team.timezone, ''), 'America/Phoenix');
  v_day_start := date_trunc('day', v_now at time zone v_tz) at time zone v_tz;
  v_day_end := v_day_start + interval '1 day';
  summary := summary || jsonb_build_object('run_id', v_run, 'ran_at', v_now, 'timezone', v_tz);

  ---------------------------------------------------------------------------------------------------------
  -- Bookings
  ---------------------------------------------------------------------------------------------------------

  -- "active" bookings that have not started yet go back to confirmed
  ids := array(select id from bookings
               where team_id = c_team and status = 'active' and start_date > v_now + interval '1 hour');
  perform demo_refresh_snapshot(v_run, 'bookings', ids, 'not_started_back_to_confirmed');
  update bookings set status = 'confirmed' where id = any(ids);
  summary := summary || jsonb_build_object('active_not_started_to_confirmed', cardinality(ids));

  -- Late returns: keep the 3 most recent (ended within 3 days; else the latest one), complete the rest
  keep := array(select id from bookings
                where team_id = c_team and status in ('confirmed', 'active')
                  and start_date <= v_now and end_date < v_now and end_date >= v_now - interval '3 days'
                order by end_date desc, id limit 3);
  if cardinality(keep) = 0 then
    keep := array(select id from bookings
                  where team_id = c_team and status in ('confirmed', 'active') and start_date <= v_now and end_date < v_now
                  order by end_date desc, id limit 1);
  end if;
  ids := array(select id from bookings
               where team_id = c_team and status in ('confirmed', 'active')
                 and start_date <= v_now and end_date < v_now and not (id = any(keep)));
  perform demo_refresh_snapshot(v_run, 'bookings', ids, 'past_rental_completed');
  -- completing a rental on a partner's car makes trg_generate_partner_payout create (or refresh) its payout:
  -- keep the rows as they were, and log the new ones so the undo removes them
  perform demo_refresh_snapshot(v_run, 'partner_payouts',
                                array(select id from partner_payouts where booking_id = any(ids)), 'payout_before_completion');
  update bookings set status = 'completed' where id = any(ids);
  summary := summary || jsonb_build_object('past_rentals_completed', cardinality(ids));
  insert into demo_refresh_log (run_id, table_name, row_id, action, before)
  select v_run, 'partner_payouts', p.id, 'partner_payout_generated', null
    from partner_payouts p
   where p.booking_id = any(ids) and p.xmin = pg_current_xact_id()::xid
     and not exists (select 1 from demo_refresh_log l where l.run_id = v_run and l.table_name = 'partner_payouts' and l.row_id = p.id);
  get diagnostics n = row_count;
  summary := summary || jsonb_build_object('partner_payouts_generated', n);

  ids := array(select id from bookings where id = any(keep) and status <> 'active');
  perform demo_refresh_snapshot(v_run, 'bookings', ids, 'late_return_kept_active');
  update bookings set status = 'active' where id = any(ids);
  summary := summary || jsonb_build_object('late_returns_kept', cardinality(keep));
  if cardinality(keep) = 0 then missing := array_append(missing, 'late return'); end if;

  -- Current rentals (started more than an hour ago) are out with the renter: active
  ids := array(select id from bookings
               where team_id = c_team and status = 'confirmed'
                 and start_date <= v_now - interval '1 hour' and end_date >= v_now);
  perform demo_refresh_snapshot(v_run, 'bookings', ids, 'current_rental_active');
  update bookings set status = 'active' where id = any(ids);
  summary := summary || jsonb_build_object('current_rentals_set_active', cardinality(ids));

  -- A pickup later today: if none, bring the next confirmed booking (within 7 days) forward, if its car is free
  if not exists (select 1 from bookings where team_id = c_team and status = 'confirmed'
                 and start_date >= v_now and start_date < v_day_end) then
    v_start := greatest(least(date_trunc('hour', v_now) + interval '2 hours', v_day_end - interval '30 minutes'),
                        v_now + interval '10 minutes');
    select b.id, b.start_date, b.end_date into r
      from bookings b
     where b.team_id = c_team and b.status = 'confirmed' and b.vehicle_id is not null
       and b.start_date >= v_day_end and b.start_date < v_now + interval '7 days'
       and not exists (
         select 1 from bookings o
          where o.vehicle_id = b.vehicle_id and o.id <> b.id
            and o.status not in ('cancelled', 'declined', 'refunded', 'payment_expired', 'completed')
            and o.start_date < b.end_date + (v_start - b.start_date) and o.end_date > v_start)
       and not exists (
         select 1 from work_orders w
          where w.vehicle_id = b.vehicle_id and w.status = any(c_active_wo) and coalesce(w.out_of_rotation, false))
     order by b.start_date, b.id
     limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'bookings', array[r.id], 'moved_to_pickup_today');
      update bookings set start_date = v_start, end_date = r.end_date + (v_start - r.start_date) where id = r.id;
      summary := summary || jsonb_build_object('pickup_moved_to_today', r.id);
    else
      missing := array_append(missing, 'pickup later today');
    end if;
  end if;

  -- A return within 48 hours: if none, shorten one current rental so it is due back in a few hours
  if not exists (select 1 from bookings where team_id = c_team and status = 'active'
                 and end_date >= v_now and end_date < v_now + interval '48 hours') then
    select id into r from bookings
     where team_id = c_team and status = 'active' and start_date <= v_now and end_date >= v_now + interval '48 hours'
     order by end_date, id limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'bookings', array[r.id], 'return_due_soon');
      update bookings set end_date = date_trunc('hour', v_now) + interval '5 hours' where id = r.id;
      summary := summary || jsonb_build_object('return_moved_to_today', r.id);
    else
      missing := array_append(missing, 'return within 48 hours');
    end if;
  end if;

  -- An active rental with a mileage limit and a pickup odometer (for the check-in mileage overage)
  if not exists (select 1 from bookings
                 where team_id = c_team and status = 'active' and start_date <= v_now and end_date > v_now
                   and mileage_limit > 0 and pickup_odometer > 0 and not coalesce(unlimited_mileage, false)) then
    select b.id into r
      from bookings b join vehicles v on v.id = b.vehicle_id
     where b.team_id = c_team and b.status = 'active' and b.start_date <= v_now and b.end_date > v_now
       and not coalesce(v.unlimited_mileage, false)
     order by b.end_date desc, b.id
     limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'bookings', array[r.id], 'mileage_rental');
      update bookings b
         set mileage_limit = coalesce(nullif(b.mileage_limit, 0), nullif(v.default_mileage_limit, 0),
                                      nullif(v_team.default_mileage_limit, 0), 150),
             mileage_overage_fee = coalesce(nullif(b.mileage_overage_fee, 0), nullif(v.mileage_overage_rate, 0),
                                            nullif(v_team.default_mileage_overage_rate, 0), 1.50),
             pickup_odometer = coalesce(nullif(b.pickup_odometer, 0), nullif(v.mileage, 0),
                                        8000 + abs(hashtext(b.id::text)) % 20000),
             unlimited_mileage = false
        from vehicles v
       where b.id = r.id and v.id = b.vehicle_id;
      summary := summary || jsonb_build_object('mileage_rental', r.id);
    else
      missing := array_append(missing, 'active rental with mileage limit and odometer');
    end if;
  end if;

  ---------------------------------------------------------------------------------------------------------
  -- Payments (demo rows only; no Stripe ids, no Stripe calls)
  ---------------------------------------------------------------------------------------------------------

  -- Overdue payments: keep the 3 most recent pending ones on live bookings, if they are recent (due within
  -- the last 45 days or later); settle or void the rest
  keep := array(select p.id from payments p join bookings b on b.id = p.booking_id
                where p.team_id = c_team and p.payment_status in ('pending', 'overdue')
                  and b.status in ('completed', 'active', 'confirmed')
                  and coalesce(p.transaction_date, p.created_at) >= v_now - interval '45 days'
                order by coalesce(p.transaction_date, p.created_at) desc nulls last, p.id limit 3);
  ids := array(select p.id from payments p join bookings b on b.id = p.booking_id
               where p.team_id = c_team and p.payment_status in ('pending', 'overdue')
                 and b.status in ('completed', 'active', 'confirmed') and not (p.id = any(keep)));
  perform demo_refresh_snapshot(v_run, 'payments', ids, 'pending_settled');
  update payments set payment_status = 'completed', transaction_date = coalesce(transaction_date, v_now),
                      notes = concat_ws(' · ', nullif(notes, ''), c_note)
   where id = any(ids);
  summary := summary || jsonb_build_object('pending_payments_settled', cardinality(ids));
  ids := array(select p.id from payments p left join bookings b on b.id = p.booking_id
               where p.team_id = c_team and p.payment_status in ('pending', 'overdue')
                 and (b.id is null or b.status is null or b.status not in ('completed', 'active', 'confirmed')));
  perform demo_refresh_snapshot(v_run, 'payments', ids, 'pending_voided');
  update payments set payment_status = 'cancelled' where id = any(ids);
  summary := summary || jsonb_build_object('pending_payments_voided', cardinality(ids));

  -- Completed rentals: what is still owed on each
  drop table if exists demo_owed;
  create temp table demo_owed on commit drop as
  select b.id, b.user_id, b.customer_id, b.end_date, b.paid_at,
         greatest(coalesce(b.total_value, 0) - coalesce(sum(p.amount) filter (
           where p.payment_type in ('rental', 'balance') and p.payment_status in ('completed', 'paid', 'succeeded')), 0), 0) as owed,
         coalesce(sum(p.amount) filter (
           where p.payment_type in ('rental', 'balance') and p.payment_status in ('completed', 'paid', 'succeeded')), 0) as paid,
         bool_or(p.payment_status in ('pending', 'overdue')) as has_pending
    from bookings b left join payments p on p.booking_id = b.id
   where b.team_id = c_team and b.status = 'completed'
   group by b.id;

  -- Left open on purpose (≤ 3): rentals with a pending payment first, then the most recently returned
  keep := array(select id from demo_owed
                where owed > 0.005 and (coalesce(has_pending, false) or end_date >= v_now - interval '30 days')
                order by coalesce(has_pending, false) desc, end_date desc, id limit 3);

  -- Everything else gets a demo payment for what is owed
  with ins as (
    insert into payments (booking_id, team_id, customer_id, user_id, amount, payment_type, payment_status,
                          payment_method, transaction_date, notes, created_at)
    select o.id, c_team, o.customer_id, o.user_id, round(o.owed::numeric, 2), 'rental', 'completed',
           'card', o.end_date, c_note, o.end_date
      from demo_owed o
     where o.owed > 0.005 and not (o.id = any(keep))
    returning id
  )
  insert into demo_refresh_log (run_id, table_name, row_id, action, before)
  select v_run, 'payments', id, 'demo_payment_inserted', null from ins;
  get diagnostics n = row_count;
  summary := summary || jsonb_build_object('demo_payments_inserted', n);

  ids := array(select id from payments
               where team_id = c_team and notes = c_note and transaction_date is not null
                 and created_at is distinct from transaction_date);
  perform demo_refresh_snapshot(v_run, 'payments', ids, 'demo_payment_dated');
  update payments set created_at = transaction_date where id = any(ids);
  summary := summary || jsonb_build_object('demo_payments_dated', cardinality(ids));

  ids := array(select b.id from bookings b join demo_owed o on o.id = b.id
               where not (b.id = any(keep))
                 and (b.payment_status is distinct from 'paid' or coalesce(b.balance_due, 0) <> 0 or b.paid_at is null));
  perform demo_refresh_snapshot(v_run, 'bookings', ids, 'marked_paid');
  update bookings b set payment_status = 'paid', balance_due = 0, paid_at = coalesce(b.paid_at, b.end_date)
   where b.id = any(ids);
  summary := summary || jsonb_build_object('bookings_marked_paid', cardinality(ids));

  perform demo_refresh_snapshot(v_run, 'bookings', keep, 'left_with_balance');
  update bookings b set payment_status = case when o.paid > 0 then 'partial' else 'pending' end,
                        balance_due = round(o.owed::numeric, 2)
    from demo_owed o
   where o.id = b.id and b.id = any(keep);
  summary := summary || jsonb_build_object('bookings_left_with_balance', cardinality(keep));
  -- No rental left owing (for example, its balance was one of the old overdue payments settled above):
  -- post-rental charges (fuel, tolls, extra miles) on the most recently returned rental, due two days later
  if cardinality(keep) = 0 then
    select b.id, b.total_value, b.end_date, b.customer_id, b.user_id into r
      from bookings b
     where b.team_id = c_team and b.status = 'completed' and coalesce(b.total_value, 0) > 0
       and b.end_date < v_now - interval '1 hour' and b.end_date >= v_now - interval '14 days'
     order by b.end_date desc, b.id
     limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'bookings', array[r.id], 'post_rental_charge');
      update bookings set payment_status = 'partial', balance_due = greatest(round(r.total_value * 0.06, 2), 85)
       where id = r.id;
      with ins as (
        insert into payments (booking_id, team_id, customer_id, user_id, amount, payment_type, payment_status,
                              payment_method, transaction_date, notes, created_at)
        values (r.id, c_team, r.customer_id, r.user_id, greatest(round(r.total_value * 0.06, 2), 85), 'balance', 'pending',
                'card', least(r.end_date + interval '2 days', v_now - interval '1 hour'), c_note,
                least(r.end_date + interval '2 days', v_now - interval '1 hour'))
        returning id
      )
      insert into demo_refresh_log (run_id, table_name, row_id, action, before)
      select v_run, 'payments', id, 'overdue_payment_inserted', null from ins;
      summary := summary || jsonb_build_object('post_rental_charge', r.id);
    else
      missing := array_append(missing, 'completed rental with a balance');
    end if;
  end if;

  -- At least one overdue payment: a pending payment for the balance on one of those rentals
  if not exists (select 1 from payments where team_id = c_team and payment_status in ('pending', 'overdue')) then
    with ins as (
      insert into payments (booking_id, team_id, customer_id, user_id, amount, payment_type, payment_status,
                            payment_method, transaction_date, notes, created_at)
      select o.id, c_team, o.customer_id, o.user_id, round(o.owed::numeric, 2), 'balance', 'pending',
             'card', least(o.end_date + interval '2 days', v_now - interval '1 hour'), c_note,
             least(o.end_date + interval '2 days', v_now - interval '1 hour')
        from demo_owed o
       where o.id = any(keep)
       order by o.end_date desc
       limit 1
      returning id
    )
    insert into demo_refresh_log (run_id, table_name, row_id, action, before)
    select v_run, 'payments', id, 'overdue_payment_inserted', null from ins;
    get diagnostics n = row_count;
    if n = 0 then missing := array_append(missing, 'overdue payment'); end if;
  end if;

  -- Partner payouts: rentals returned more than 14 days ago have been paid out (demo record, no transfer);
  -- the last two weeks stay pending, like a payout run that has not happened yet
  ids := array(select p.id from partner_payouts p join bookings b on b.id = p.booking_id
               where p.team_id = c_team and p.status = 'pending' and b.status = 'completed'
                 and b.end_date < v_now - interval '14 days');
  perform demo_refresh_snapshot(v_run, 'partner_payouts', ids, 'payout_marked_paid');
  update partner_payouts p
     set status = 'paid', paid_at = least(b.end_date + interval '7 days', v_now),
         payout_method = coalesce(p.payout_method, 'bank_transfer'),
         payout_reference = coalesce(p.payout_reference, 'Demo record — no transfer')
    from bookings b
   where b.id = p.booking_id and p.id = any(ids);
  summary := summary || jsonb_build_object('partner_payouts_marked_paid', cardinality(ids));

  ---------------------------------------------------------------------------------------------------------
  -- Tasks, work orders, maintenance
  ---------------------------------------------------------------------------------------------------------

  -- Overdue tasks: keep the 2 most recent, spread the rest over the next 9 days
  keep := array(select id from vehicle_tasks
                where team_id = c_team and status <> 'completed' and due_at < v_now
                order by due_at desc, id limit 2);
  for r in select id, row_number() over (order by due_at, id) as rn from vehicle_tasks
            where team_id = c_team and status <> 'completed' and due_at < v_now and not (id = any(keep)) loop
    perform demo_refresh_snapshot(v_run, 'vehicle_tasks', array[r.id], 'task_rescheduled');
    update vehicle_tasks set due_at = v_day_start + interval '10 hours' + ((r.rn % 9) + 1) * interval '1 day' where id = r.id;
  end loop;
  if cardinality(keep) = 0 then
    select id into r from vehicle_tasks where team_id = c_team and status <> 'completed'
     order by due_at nulls last, id limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'vehicle_tasks', array[r.id], 'task_made_overdue');
      update vehicle_tasks set due_at = v_now - interval '1 day' where id = r.id;
    else
      missing := array_append(missing, 'overdue task');
    end if;
  end if;

  -- Overdue work orders: keep the most recent one, give the rest a due date in the coming week
  keep := array(select id from work_orders
                where team_id = c_team and status = any(c_active_wo) and due_at < v_now
                order by due_at desc, id limit 1);
  for r in select id, row_number() over (order by due_at, id) as rn from work_orders
            where team_id = c_team and status = any(c_active_wo) and due_at < v_now and not (id = any(keep)) loop
    perform demo_refresh_snapshot(v_run, 'work_orders', array[r.id], 'work_order_rescheduled');
    update work_orders set due_at = v_day_start + interval '17 hours' + ((r.rn % 6) + 2) * interval '1 day' where id = r.id;
  end loop;
  if cardinality(keep) = 0 then
    select id into r from work_orders where team_id = c_team and status = any(c_active_wo)
     order by due_at nulls last, id limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'work_orders', array[r.id], 'work_order_made_overdue');
      update work_orders set due_at = v_now - interval '1 day' where id = r.id;
      keep := array[r.id];
    else
      missing := array_append(missing, 'overdue work order');
    end if;
  end if;

  -- One blocked work order (waiting on parts); at most two
  if not exists (select 1 from work_orders where team_id = c_team and status in ('blocked_parts', 'blocked_vendor')) then
    select id into r from work_orders
     where team_id = c_team and status = any(c_active_wo) and not (id = any(keep))
     order by (status = 'in_progress') desc, created_at desc nulls last, id limit 1;
    if not found then
      select id into r from work_orders where team_id = c_team and status = any(c_active_wo) order by id limit 1;
    end if;
    if found then
      perform demo_refresh_snapshot(v_run, 'work_orders', array[r.id], 'work_order_blocked');
      update work_orders set status = 'blocked_parts' where id = r.id;
    else
      missing := array_append(missing, 'blocked work order');
    end if;
  else
    ids := array(select id from work_orders where team_id = c_team and status in ('blocked_parts', 'blocked_vendor')
                 order by updated_at desc nulls last, id offset 2);
    perform demo_refresh_snapshot(v_run, 'work_orders', ids, 'work_order_unblocked');
    update work_orders set status = 'in_progress' where id = any(ids);
  end if;

  -- Cars out of service always show when they come back
  for r in select id, due_at, row_number() over (order by created_at, id) as rn from work_orders
            where team_id = c_team and status = any(c_active_wo) and coalesce(out_of_rotation, false)
              and expected_return_at is null loop
    perform demo_refresh_snapshot(v_run, 'work_orders', array[r.id], 'return_date_set');
    update work_orders
       set expected_return_at = greatest(coalesce(r.due_at, v_now), v_now) + (r.rn + 1) * interval '1 day'
     where id = r.id;
  end loop;

  -- Maintenance due (today, tomorrow or past): keep 2, schedule the rest over the coming weeks
  keep := array(select id from maintenance_schedules
                where team_id = c_team and coalesce(status, '') <> 'completed' and scheduled_date < v_day_end + interval '1 day'
                order by scheduled_date desc, id limit 2);
  for r in select id, row_number() over (order by scheduled_date, id) as rn from maintenance_schedules
            where team_id = c_team and coalesce(status, '') <> 'completed' and scheduled_date < v_day_end + interval '1 day'
              and not (id = any(keep)) loop
    perform demo_refresh_snapshot(v_run, 'maintenance_schedules', array[r.id], 'maintenance_rescheduled');
    update maintenance_schedules set scheduled_date = v_day_start + (r.rn * 7 + 3) * interval '1 day' where id = r.id;
  end loop;
  if cardinality(keep) = 0 then
    select id into r from maintenance_schedules where team_id = c_team and coalesce(status, '') <> 'completed'
     order by scheduled_date, id limit 1;
    if found then
      perform demo_refresh_snapshot(v_run, 'maintenance_schedules', array[r.id], 'maintenance_due_tomorrow');
      update maintenance_schedules set scheduled_date = v_day_start + interval '1 day' where id = r.id;
    else
      missing := array_append(missing, 'maintenance due');
    end if;
  end if;

  ---------------------------------------------------------------------------------------------------------
  -- Expiring documents
  ---------------------------------------------------------------------------------------------------------

  -- Customers (Pulse → Expiring Docs, 7 days): 1–2
  ids := array(select id from customers
               where team_id = c_team
                 and ((license_expiry::timestamptz > v_now and license_expiry::timestamptz <= v_now + interval '7 days')
                   or (insurance_expiry::timestamptz > v_now and insurance_expiry::timestamptz <= v_now + interval '7 days'))
               order by id offset 2);
  perform demo_refresh_snapshot(v_run, 'customers', ids, 'customer_document_renewed');
  update customers
     set license_expiry = case when license_expiry::timestamptz <= v_now + interval '7 days' and license_expiry::timestamptz > v_now
                               then license_expiry::timestamptz + interval '1 year' else license_expiry::timestamptz end,
         insurance_expiry = case when insurance_expiry::timestamptz <= v_now + interval '7 days' and insurance_expiry::timestamptz > v_now
                                 then insurance_expiry::timestamptz + interval '1 year' else insurance_expiry::timestamptz end
   where id = any(ids);
  if not exists (select 1 from customers where team_id = c_team
                 and ((license_expiry::timestamptz > v_now and license_expiry::timestamptz <= v_now + interval '7 days')
                   or (insurance_expiry::timestamptz > v_now and insurance_expiry::timestamptz <= v_now + interval '7 days'))) then
    -- renters with a booking coming up first, so the alert leads somewhere real
    ids := array(select c.id from customers c
                 where c.team_id = c_team
                 order by exists (select 1 from bookings b where b.customer_id = c.id and b.status = 'confirmed'
                                  and b.start_date > v_now and b.start_date < v_now + interval '21 days') desc,
                          c.lifetime_value desc nulls last, c.id
                 limit 2);
    perform demo_refresh_snapshot(v_run, 'customers', ids, 'customer_document_expiring');
    update customers set license_expiry = v_day_start + interval '5 days' where id = ids[1];
    update customers set insurance_expiry = v_day_start + interval '6 days' where id = ids[2];
    if cardinality(ids) = 0 then missing := array_append(missing, 'customer document expiring'); end if;
  end if;

  -- Vault (30-day window): nothing already expired; 1–2 genuinely expiring
  for r in select id, row_number() over (order by expires_at, id) as rn from documents
            where team_id = c_team and expires_at <= v_now loop
    perform demo_refresh_snapshot(v_run, 'documents', array[r.id], 'document_renewed');
    update documents set expires_at = v_day_start + (120 + r.rn * 29) * interval '1 day' where id = r.id;
  end loop;
  ids := array(select id from documents where team_id = c_team and expires_at > v_now and expires_at <= v_now + interval '30 days'
               order by expires_at, id offset 2);
  perform demo_refresh_snapshot(v_run, 'documents', ids, 'document_renewed');
  update documents set expires_at = expires_at + interval '1 year' where id = any(ids);
  if not exists (select 1 from documents where team_id = c_team and expires_at > v_now and expires_at <= v_now + interval '30 days') then
    ids := array(select id from documents
                 where team_id = c_team and (expires_at is not null or type in ('insurance', 'registration'))
                 order by (type = 'insurance') desc, (type = 'registration') desc, (expires_at is not null) desc, id
                 limit 2);
    perform demo_refresh_snapshot(v_run, 'documents', ids, 'document_expiring');
    update documents set expires_at = v_day_start + interval '12 days' where id = ids[1];
    update documents set expires_at = v_day_start + interval '23 days' where id = ids[2];
    if cardinality(ids) = 0 then missing := array_append(missing, 'Vault document expiring'); end if;
  end if;

  ---------------------------------------------------------------------------------------------------------
  -- Totals and clean-up
  ---------------------------------------------------------------------------------------------------------

  update vehicles v
     set revenue = coalesce((select sum(b.total_value) from bookings b where b.vehicle_id = v.id and b.status = 'completed'), 0)
   where v.team_id = c_team
     and v.revenue is distinct from coalesce((select sum(b.total_value) from bookings b
                                              where b.vehicle_id = v.id and b.status = 'completed'), 0);

  -- The status/payment triggers post an in-app notice per row for every team member; drop the ones this run made
  delete from notifications
   where xmin = pg_current_xact_id()::xid
     and user_id in (select user_id from team_members where team_id = c_team);
  get diagnostics n = row_count;
  summary := summary || jsonb_build_object('notifications_removed', n, 'missing', to_jsonb(missing));

  return summary;
end
$fn$;

revoke all on function public.demo_refresh_snapshot(uuid, text, uuid[], text) from public, anon, authenticated;
revoke all on function public.refresh_demo_fleet() from public, anon, authenticated;
grant execute on function public.refresh_demo_fleet() to service_role;
grant execute on function public.demo_refresh_snapshot(uuid, text, uuid[], text) to service_role;
