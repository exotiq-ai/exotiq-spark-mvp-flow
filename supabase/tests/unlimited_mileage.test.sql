-- Tests for 20261116000000_unlimited_mileage.sql. Read-only: it inspects columns, the function and the trigger and
-- calls nothing.
--   psql ... < supabase/tests/unlimited_mileage.test.sql
do $$
declare
  col record;
  fn regprocedure;
  def text;
  cfg text[];
  trg record;
begin
  -- 1. vehicles.unlimited_mileage: boolean, required, off by default
  select a.attnotnull, format_type(a.atttypid, a.atttypmod) as typ, pg_get_expr(d.adbin, d.adrelid) as dflt
    into col
  from pg_attribute a
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.vehicles'::regclass and a.attname = 'unlimited_mileage' and not a.attisdropped;
  assert found, 'vehicles.unlimited_mileage exists';
  assert col.typ = 'boolean', 'vehicles.unlimited_mileage is boolean';
  assert col.attnotnull, 'vehicles.unlimited_mileage is NOT NULL';
  assert col.dflt = 'false', 'vehicles.unlimited_mileage defaults to false';

  -- 2. bookings.unlimited_mileage: boolean, nullable (older bookings stay NULL = not unlimited)
  select a.attnotnull, format_type(a.atttypid, a.atttypmod) as typ
    into col
  from pg_attribute a
  where a.attrelid = 'public.bookings'::regclass and a.attname = 'unlimited_mileage' and not a.attisdropped;
  assert found, 'bookings.unlimited_mileage exists';
  assert col.typ = 'boolean', 'bookings.unlimited_mileage is boolean';
  assert not col.attnotnull, 'bookings.unlimited_mileage allows NULL for older bookings';

  -- 3. the snapshot function: a trigger function with a fixed search_path that only reads the vehicle's flag
  fn := to_regprocedure('public.snapshot_booking_unlimited_mileage()');
  assert fn is not null, 'snapshot_booking_unlimited_mileage() exists';
  select p.prosrc, p.proconfig into def, cfg from pg_proc p where p.oid = fn;
  assert (select p.prorettype = 'trigger'::regtype from pg_proc p where p.oid = fn), 'it is a trigger function';
  assert (select p.prosecdef from pg_proc p where p.oid = fn), 'it runs with the owner''s rights';
  assert cfg is not null and exists (select 1 from unnest(cfg) c where c like 'search_path=%'), 'it fixes search_path';
  assert def ilike '%if new.unlimited_mileage is null%', 'it keeps a value the insert set itself';
  assert def ilike '%from public.vehicles v%' and def ilike '%v.id = new.vehicle_id%', 'it reads the booking''s own vehicle';
  assert def ilike '%coalesce(new.unlimited_mileage, false)%', 'a booking without a vehicle gets false';
  assert def not ilike '%update %' and def not ilike '%delete %' and def not ilike '%insert %', 'it writes nothing else';
  assert not has_function_privilege('anon', fn, 'execute'), 'anon must not execute it';
  assert not has_function_privilege('authenticated', fn, 'execute'), 'authenticated must not execute it';

  -- 4. the trigger: BEFORE INSERT, row level, enabled, on bookings
  select t.tgenabled, t.tgtype into trg
  from pg_trigger t
  where t.tgrelid = 'public.bookings'::regclass and t.tgname = 'snapshot_booking_unlimited_mileage' and not t.tgisinternal;
  assert found, 'the trigger exists on bookings';
  assert trg.tgenabled <> 'D', 'the trigger is enabled';
  assert (trg.tgtype & 1) = 1, 'the trigger is row level';
  assert (trg.tgtype & 2) = 2, 'the trigger fires BEFORE';
  assert (trg.tgtype & 4) = 4 and (trg.tgtype & 16) = 0, 'the trigger fires on INSERT only';
  assert (select tgfoid from pg_trigger where tgrelid = 'public.bookings'::regclass and tgname = 'snapshot_booking_unlimited_mileage') = fn,
    'the trigger calls snapshot_booking_unlimited_mileage()';

  raise notice 'unlimited_mileage: all checks passed';
end $$;
