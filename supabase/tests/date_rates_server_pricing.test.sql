-- Tests for server-side date-rate pricing (P2). Run against a database that has both date-rate migrations.
-- Everything happens in one transaction that is rolled back.
begin;

create temp table t_ctx on commit drop as
select t.slug as team_slug, v.slug as vehicle_slug, v.id as vehicle_id, v.team_id, v.current_rate::numeric as base,
       coalesce(t.platform_fee_percent, 10) as fee_pct
from public.vehicles v join public.teams t on t.id = v.team_id
where v.slug is not null and v.current_rate >= 300 and public.is_marketplace_vehicle(v.id)
  and not exists (select 1 from public.vehicle_rate_overrides o where o.vehicle_id = v.id)
order by v.current_rate limit 1;

do $$
declare c record; s date := current_date + 400; e date; q record; q0 record; n int;
begin
  select * into c from t_ctx;
  assert c.vehicle_id is not null, 'fixture: a marketplace vehicle';
  e := s + 3;

  -- nightly_rates: one row per night, base rate when nothing applies
  select count(*) into n from public.nightly_rates(c.vehicle_id, s, 3, c.base);
  assert n = 3, 'three nights';
  assert (select bool_and(rate = c.base and source = 'base') from public.nightly_rates(c.vehicle_id, s, 3, c.base)), 'all base';
  assert (select count(*) from public.nightly_rates(c.vehicle_id, s, 0, c.base)) = 0, 'no nights';

  -- 1. no date rates: the quote is days x rate, as before
  select * into q0 from public.public_vehicle_quote(c.team_slug, c.vehicle_slug, s, e, '{"protection":"decline"}');
  assert q0.rental_days = 3, 'three days';
  assert q0.rental_subtotal_cents = round(c.base * 100) * 3, 'subtotal is days x rate';
  assert q0.daily_rate_cents = round(c.base * 100), 'daily rate is the base rate';

  -- 2. a manual rate on the middle night changes the subtotal by exactly that night
  perform public.set_rate_override(c.vehicle_id, s + 1, s + 1, c.base * 2, 'manual', 'test');
  select * into q from public.public_vehicle_quote(c.team_slug, c.vehicle_slug, s, e, '{"protection":"decline"}');
  assert q.rental_subtotal_cents = round(c.base * 100) * 2 + round(c.base * 200), 'subtotal includes the special night: ' || q.rental_subtotal_cents;
  assert q.daily_rate_cents = round(q.rental_subtotal_cents::numeric / 3), 'daily rate is the average';
  -- every figure derived from the subtotal follows it
  assert q.platform_fee_cents = round(q.rental_subtotal_cents * q.platform_fee_percent / 100.0), 'platform fee follows the subtotal';
  assert q.operator_total_cents = q.rental_subtotal_cents + case when q.operator_tax_rate > 0 and q.operator_tax_cents > 0 and
        (select coalesce(l.tax_inclusive, t.tax_inclusive, false) from public.vehicles v join public.teams t on t.id = v.team_id left join public.locations l on l.id = v.location_id where v.id = c.vehicle_id)
        then 0 else q.operator_tax_cents end, 'operator total = subtotal + tax';
  assert q.grand_total_cents = q.operator_total_cents + q.exotiq_total_cents, 'grand total adds up';
  assert q.processing_fee_cents > q0.processing_fee_cents, 'processing fee grows with the subtotal';

  -- 3. a special rate outside the stay, or a revoked one, changes nothing
  perform public.set_rate_override(c.vehicle_id, s + 10, s + 11, c.base * 3, 'manual', 'elsewhere');
  select * into q from public.public_vehicle_quote(c.team_slug, c.vehicle_slug, s, e, '{"protection":"decline"}');
  assert q.rental_subtotal_cents = round(c.base * 100) * 2 + round(c.base * 200), 'other dates do not matter';
  perform public.revoke_rate_override((select id from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and reason = 'test'));
  select * into q from public.public_vehicle_quote(c.team_slug, c.vehicle_slug, s, e, '{"protection":"decline"}');
  assert q.rental_subtotal_cents = q0.rental_subtotal_cents, 'revoked rate no longer applies';
  assert q.grand_total_cents = q0.grand_total_cents, 'back to the original total';
end $$;

-- 4. a marketplace booking keeps the nightly rates it was priced with
do $$
declare c record; s date := current_date + 400; e date; q record; b record; r record; total numeric;
begin
  select * into c from t_ctx;
  e := s + 3;
  perform public.set_rate_override(c.vehicle_id, s, s, c.base * 1.5, 'motoriq', 'event');
  select * into q from public.public_vehicle_quote(c.team_slug, c.vehicle_slug, s, e, '{"protection":"decline"}');
  select * into r from public.create_marketplace_booking(
    c.team_slug, c.vehicle_slug, s, e, '10:00 AM', 'Test Renter', 'p2-test@example.com', '5555550100',
    q.daily_rate_cents / 100.0, q.operator_total_cents / 100.0, 'requested', 'decline',
    q.platform_fee_cents, q.protection_total_cents, q.state_fee_cents, q.processing_fee_cents, q.operator_tax_cents, '10:00 AM');
  select * into b from public.bookings where id = r.booking_id;
  assert b.rate_breakdown is not null, 'the booking has a breakdown';
  assert jsonb_array_length(b.rate_breakdown->'nights') = 3, 'three nights recorded';
  assert b.rate_breakdown->'nights'->0->>'source' = 'motoriq', 'first night is the MotorIQ rate';
  assert (b.rate_breakdown->'nights'->0->>'rate')::numeric = round(c.base * 1.5, 2), 'first night rate';
  assert (b.rate_breakdown->'nights'->1->>'source') = 'base', 'second night is base';
  select sum((n->>'rate')::numeric) into total from jsonb_array_elements(b.rate_breakdown->'nights') n;
  assert round(total * 100) = q.rental_subtotal_cents, 'breakdown adds up to the quoted subtotal';
  assert b.rate_breakdown->>'time_zone' is not null, 'time zone recorded';
end $$;

rollback;
select 'date_rates_server_pricing tests passed' as result;
