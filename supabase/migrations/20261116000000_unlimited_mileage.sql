-- Unlimited miles per vehicle, copied onto each booking when it is made.
--
-- Operators can mark a car "unlimited miles": no allowance applies and no overage is ever charged. The flag lives on
-- the vehicle and is snapshotted onto the booking at insert, like the per-day allowance and rate already are
-- (bookings.mileage_limit / mileage_overage_fee), so changing the car later does not change bookings already made.
--
-- The copy is done by a BEFORE INSERT trigger rather than by each client, so every way a booking is created (the
-- Command Center dialog, imports, and the renter booking functions) gets it without changes there. A booking insert
-- that sets the flag itself keeps its value.
--
-- Existing rows: vehicles get false (the default); existing bookings keep NULL, which the app reads as "not
-- unlimited" — the same rule they were charged under. No other data is changed. The file can be run again.

alter table public.vehicles
  add column if not exists unlimited_mileage boolean not null default false;

alter table public.bookings
  add column if not exists unlimited_mileage boolean;

comment on column public.vehicles.unlimited_mileage is
  'Unlimited miles: no allowance applies and no overage is charged. Copied onto bookings at insert.';
comment on column public.bookings.unlimited_mileage is
  'Snapshot of vehicles.unlimited_mileage when the booking was made. NULL (older bookings) means not unlimited.';

-- Runs with the owner's rights so the copy works whoever inserts (including renter booking functions and users
-- whose row-level access to the vehicle differs); it reads one boolean of the booking's own vehicle and nothing else.
create or replace function public.snapshot_booking_unlimited_mileage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.unlimited_mileage is null then
    if new.vehicle_id is not null then
      select v.unlimited_mileage into new.unlimited_mileage
      from public.vehicles v
      where v.id = new.vehicle_id;
    end if;
    new.unlimited_mileage := coalesce(new.unlimited_mileage, false);
  end if;
  return new;
end;
$$;

-- A trigger function needs no EXECUTE grant to fire; nobody should call it directly.
revoke all on function public.snapshot_booking_unlimited_mileage() from public, anon, authenticated;

drop trigger if exists snapshot_booking_unlimited_mileage on public.bookings;
create trigger snapshot_booking_unlimited_mileage
  before insert on public.bookings
  for each row execute function public.snapshot_booking_unlimited_mileage();
