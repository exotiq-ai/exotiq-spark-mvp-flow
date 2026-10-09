-- Tests for date-specific rates. Run against a database that has the migration; everything happens in one
-- transaction that is rolled back, using an existing vehicle, so nothing is left behind.
--   psql ... < supabase/tests/vehicle_rate_overrides.test.sql
begin;

create temp table t_ctx on commit drop as
select v.id as vehicle_id, v.team_id, v.current_rate::numeric as base,
       (select min_rate from public.teams where id = v.team_id) as min_rate
from public.vehicles v
join public.teams t on t.id = v.team_id
where v.archived_at is null and v.current_rate >= 500 and t.timezone = 'America/Phoenix'
  and not exists (select 1 from public.vehicle_rate_overrides o where o.vehicle_id = v.id)
limit 1;

do $$
declare c record; q jsonb;
begin
  select * into c from t_ctx;
  assert c.vehicle_id is not null, 'fixture: need a Phoenix-team vehicle with rate >= 500';

  -- 1. no overrides: base rate on every night
  q := public.quote_nightly(c.vehicle_id, '2026-10-16 17:00+00', '2026-10-18 17:00+00');
  assert (q->>'nights')::int = 2, 'two nights';
  assert (q->>'total')::numeric = c.base * 2, 'base total';
  assert (q->>'has_overrides')::boolean = false, 'no overrides';
  assert q->>'time_zone' = 'America/Phoenix', 'uses the team zone';

  -- 2. precedence: a manual override beats a MotorIQ override beats the base rate
  perform public.set_rate_override(c.vehicle_id, '2026-10-16', '2026-10-17', 2000, 'motoriq', 'event');
  perform public.set_rate_override(c.vehicle_id, '2026-10-17', '2026-10-17', 2500, 'manual', 'owner');
  q := public.quote_nightly(c.vehicle_id, '2026-10-16 17:00+00', '2026-10-19 17:00+00');
  assert (q->>'nights')::int = 3, 'three nights';
  assert (q->'breakdown'->0->>'rate')::numeric = 2000 and q->'breakdown'->0->>'source' = 'motoriq', 'day 1 motoriq';
  assert (q->'breakdown'->1->>'rate')::numeric = 2500 and q->'breakdown'->1->>'source' = 'manual', 'day 2 manual wins';
  assert (q->'breakdown'->2->>'rate')::numeric = c.base and q->'breakdown'->2->>'source' = 'base', 'day 3 base';
  assert (q->>'total')::numeric = 2000 + 2500 + c.base, 'total is the sum of the nights';
  assert (q->>'has_overrides')::boolean, 'flag set';

  -- 3. a tier rate stands in for the base on days without an override
  q := public.quote_nightly(c.vehicle_id, '2026-10-16 17:00+00', '2026-10-19 17:00+00', null, 700);
  assert (q->'breakdown'->2->>'rate')::numeric = 700, 'tier rate on a non-override day';
  assert (q->'breakdown'->0->>'rate')::numeric = 2000, 'override still wins over the tier';

  -- 4. replacing an overlapping range of the same source keeps one active range (history is kept)
  perform public.set_rate_override(c.vehicle_id, '2026-10-16', '2026-10-18', 1800, 'motoriq', 'event v2');
  assert (select count(*) from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and source = 'motoriq' and revoked_at is null) = 1, 'one active motoriq range';
  assert (select count(*) from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and source = 'motoriq') = 2, 'replaced range kept as history';
  q := public.quote_nightly(c.vehicle_id, '2026-10-16 17:00+00', '2026-10-19 17:00+00');
  assert (q->'breakdown'->0->>'rate')::numeric = 1800 and (q->'breakdown'->2->>'rate')::numeric = 1800, 'new range in force';
  assert (q->'breakdown'->1->>'rate')::numeric = 2500, 'manual still beats it';

  -- 5. revoking returns the day to the next rule down, and only once
  perform public.revoke_rate_override((select id from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and source = 'manual' and revoked_at is null));
  q := public.quote_nightly(c.vehicle_id, '2026-10-16 17:00+00', '2026-10-19 17:00+00');
  assert (q->'breakdown'->1->>'rate')::numeric = 1800, 'back to the MotorIQ rate';
  begin
    perform public.revoke_rate_override((select id from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and source = 'manual' limit 1));
    raise exception 'revoking twice must fail';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- 6. the team minimum rate is enforced when writing
do $$
declare c record;
begin
  select * into c from t_ctx;
  begin
    perform public.set_rate_override(c.vehicle_id, '2026-12-01', '2026-12-02', c.min_rate - 1, 'manual');
    raise exception 'a rate under the team minimum must be refused';
  exception when sqlstate '23514' then null; end;
end $$;

-- 7. an active range cannot be edited, and two active ranges of one source cannot overlap
do $$
declare c record;
begin
  select * into c from t_ctx;
  begin
    update public.vehicle_rate_overrides set daily_rate = 1 where vehicle_id = c.vehicle_id and revoked_at is null;
    raise exception 'editing a rate must fail';
  exception when sqlstate '23514' then null; end;
  begin
    insert into public.vehicle_rate_overrides (team_id, vehicle_id, start_date, end_date, daily_rate, source)
    values (c.team_id, c.vehicle_id, '2026-10-17', '2026-10-20', 1900, 'motoriq');
    raise exception 'overlapping active ranges must fail';
  exception when exclusion_violation then null; end;
end $$;

-- 8. a vehicle can only get rates for its own team
do $$
declare c record; other uuid;
begin
  select * into c from t_ctx;
  select id into other from public.teams where id <> c.team_id limit 1;
  begin
    insert into public.vehicle_rate_overrides (team_id, vehicle_id, start_date, end_date, daily_rate, source)
    values (other, c.vehicle_id, '2027-01-01', '2027-01-02', 1000, 'manual');
    raise exception 'cross-team override must fail';
  exception when sqlstate '42501' then null; end;
end $$;

-- 9. nights are counted on the local wall clock (daylight saving ends at 2 am on Nov 1 2026 in New York)
do $$
declare c record; q jsonb;
begin
  select * into c from t_ctx;
  -- Oct 31 10:00 EDT to Nov 2 10:00 EST is 49 elapsed hours but two calendar nights
  q := public.quote_nightly(c.vehicle_id, '2026-10-31 14:00+00', '2026-11-02 15:00+00', 'America/New_York');
  assert (q->>'nights')::int = 2, 'two nights across the clock change, got ' || (q->>'nights');
  assert q->'breakdown'->0->>'date' = '2026-10-31' and q->'breakdown'->1->>'date' = '2026-11-01', 'starts on the local date';
  -- 9 pm on Oct 10 in New York is already Oct 11 in UTC; the stay still starts on Oct 10
  q := public.quote_nightly(c.vehicle_id, '2026-10-11 01:00+00', '2026-10-11 12:00+00', 'America/New_York');
  assert (q->>'nights')::int = 1 and q->'breakdown'->0->>'date' = '2026-10-10', 'local start date';
  -- the same instant read in Phoenix
  q := public.quote_nightly(c.vehicle_id, '2026-10-11 01:00+00', '2026-10-11 12:00+00', 'America/Phoenix');
  assert q->'breakdown'->0->>'date' = '2026-10-10', 'phoenix local start date';
  -- zero-length and reversed stays
  q := public.quote_nightly(c.vehicle_id, '2026-10-12 10:00+00', '2026-10-12 10:00+00');
  assert (q->>'nights')::int = 1, 'a zero-length stay is one night';
  q := public.quote_nightly(c.vehicle_id, '2026-10-12 10:00+00', '2026-10-11 10:00+00');
  assert (q->>'nights')::int = 0, 'reversed stay has no nights';
  -- unknown time zone falls back to UTC
  q := public.quote_nightly(c.vehicle_id, '2026-10-12 10:00+00', '2026-10-13 10:00+00', 'Mars/Olympus');
  assert q->>'time_zone' = 'UTC', 'bad zone -> UTC';
  -- unknown vehicle
  q := public.quote_nightly('00000000-0000-0000-0000-000000000000', now(), now() + interval '1 day');
  assert q ? 'error', 'unknown vehicle is reported';
end $$;

-- 10. access: a manager-level member of the team can write and read; a member of another team can do neither
do $$
declare c record; ua uuid; ub uuid; n int; ok boolean;
begin
  select * into c from t_ctx;
  select tm.user_id into ua from public.team_members tm
    where tm.team_id = c.team_id and tm.is_active
      and exists (select 1 from public.user_roles r where r.user_id = tm.user_id and r.role in ('owner','admin','manager')) limit 1;
  select tm.user_id into ub from public.team_members tm
    where tm.team_id <> c.team_id and tm.is_active
      and not exists (select 1 from public.team_members x where x.team_id = c.team_id and x.user_id = tm.user_id)
      and not public.is_super_admin(tm.user_id) limit 1;
  assert ua is not null and ub is not null, 'fixture: a manager of the team and a member of another team';

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  perform public.set_rate_override(c.vehicle_id, '2027-03-01', '2027-03-02', 1234, 'manual', 'access test');
  select count(*) into n from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id and reason = 'access test';
  assert n = 1, 'the team manager can write and read';
  assert exists (select 1 from public.vehicle_change_log where vehicle_id = c.vehicle_id and field_name = 'date_rate' and user_id = ua), 'the change is in the vehicle history';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  select count(*) into n from public.vehicle_rate_overrides where vehicle_id = c.vehicle_id;
  assert n = 0, 'another team cannot read the rows';
  ok := false;
  begin
    perform public.set_rate_override(c.vehicle_id, '2027-04-01', '2027-04-02', 1500, 'manual');
  exception when others then ok := true; end;
  assert ok, 'another team cannot write';
  reset role;
end $$;

rollback;
select 'vehicle_rate_overrides tests passed' as result;
