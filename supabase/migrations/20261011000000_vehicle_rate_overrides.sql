-- Date-specific rates (P1): a car can have a different daily rate on specific local calendar days.
--
-- * vehicles.current_rate stays the base rate. An override replaces it on its days only.
-- * Precedence on a day: a manual override beats a MotorIQ override beats the base rate.
-- * Days are the tenant's local calendar days (inclusive). Overrides are never deleted: they are revoked, so every
--   change keeps who/when. Existing bookings are not touched; they keep the price they were made at.
-- * rate_for_day / quote_nightly are the single source of truth for what a night costs. Callers (booking dialogs now,
--   booking functions and storefronts in later phases) must use them rather than re-implementing the rules.

create table if not exists public.vehicle_rate_overrides (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  daily_rate  numeric(10,2) not null check (daily_rate > 0),
  source      text not null check (source in ('manual', 'motoriq')),
  reason      text,
  event_ref   text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  revoked_by  uuid,
  constraint vehicle_rate_overrides_dates check (end_date >= start_date and end_date - start_date <= 366),
  -- one active range per car and source at a time (manual and MotorIQ may overlap; precedence settles it)
  constraint vehicle_rate_overrides_no_overlap exclude using gist (
    vehicle_id with =,
    source with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (revoked_at is null)
);

create index if not exists vehicle_rate_overrides_team_active_idx
  on public.vehicle_rate_overrides (team_id, end_date) where revoked_at is null;

alter table public.vehicle_rate_overrides enable row level security;

drop policy if exists "Team members can view rate overrides" on public.vehicle_rate_overrides;
create policy "Team members can view rate overrides"
  on public.vehicle_rate_overrides for select to authenticated
  using (is_team_member_of_record(auth.uid(), team_id) or is_super_admin(auth.uid()));

drop policy if exists "Managers can create rate overrides" on public.vehicle_rate_overrides;
create policy "Managers can create rate overrides"
  on public.vehicle_rate_overrides for insert to authenticated
  with check (
    (is_team_member_of_record(auth.uid(), team_id)
      and (has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'manager'::app_role)))
    or is_super_admin(auth.uid())
  );

-- Update exists only so a range can be revoked (the guard trigger rejects any other change).
drop policy if exists "Managers can revoke rate overrides" on public.vehicle_rate_overrides;
create policy "Managers can revoke rate overrides"
  on public.vehicle_rate_overrides for update to authenticated
  using (
    (is_team_member_of_record(auth.uid(), team_id)
      and (has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'manager'::app_role)))
    or is_super_admin(auth.uid())
  );
-- No delete policy on purpose: history is kept.

create or replace function public.vehicle_rate_overrides_guard()
returns trigger
language plpgsql
as $$
declare
  v_team uuid;
  v_min numeric;
begin
  if tg_op = 'INSERT' then
    select team_id into v_team from public.vehicles where id = new.vehicle_id;
    if v_team is null or v_team <> new.team_id then
      raise exception 'vehicle does not belong to this team' using errcode = '42501';
    end if;
    select min_rate into v_min from public.teams where id = new.team_id;
    if v_min is not null and new.daily_rate < v_min then
      raise exception 'rate % is below the team minimum rate %', new.daily_rate, v_min using errcode = '23514';
    end if;
    new.created_by := coalesce(new.created_by, auth.uid());
    new.revoked_at := null;
    new.revoked_by := null;
    return new;
  end if;

  -- UPDATE: only revoking is allowed, and only once
  if old.revoked_at is not null then
    raise exception 'this rate was already revoked' using errcode = '23514';
  end if;
  if (new.team_id, new.vehicle_id, new.start_date, new.end_date, new.daily_rate, new.source, new.reason, new.event_ref, new.created_by, new.created_at)
     is distinct from
     (old.team_id, old.vehicle_id, old.start_date, old.end_date, old.daily_rate, old.source, old.reason, old.event_ref, old.created_by, old.created_at) then
    raise exception 'a date rate can only be revoked, not edited' using errcode = '23514';
  end if;
  if new.revoked_at is null then
    raise exception 'revoked_at is required' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicle_rate_overrides_guard on public.vehicle_rate_overrides;
create trigger vehicle_rate_overrides_guard
  before insert or update on public.vehicle_rate_overrides
  for each row execute function public.vehicle_rate_overrides_guard();

-- A booking will keep the nightly breakdown it was priced with (filled by the booking functions in a later phase).
alter table public.bookings add column if not exists rate_breakdown jsonb;

-- ---------------------------------------------------------------------------------------------------------------
-- What does one night cost?
-- ---------------------------------------------------------------------------------------------------------------

-- The rate for one local calendar day. p_base_rate lets a caller supply a duration-tier rate for days without an override.
create or replace function public.rate_for_day(p_vehicle_id uuid, p_day date, p_base_rate numeric default null)
returns table (rate numeric, source text, override_id uuid)
language plpgsql
stable
as $$
declare
  o record;
begin
  select ov.id, ov.daily_rate, ov.source into o
  from public.vehicle_rate_overrides ov
  where ov.vehicle_id = p_vehicle_id
    and ov.revoked_at is null
    and p_day between ov.start_date and ov.end_date
  order by (ov.source = 'manual') desc, ov.created_at desc
  limit 1;

  if found then
    return query select o.daily_rate, o.source, o.id;
    return;
  end if;

  return query
    select coalesce(p_base_rate, v.current_rate)::numeric, 'base'::text, null::uuid
    from public.vehicles v where v.id = p_vehicle_id;
end;
$$;

-- The nightly breakdown for a stay. Nights follow the app's convention: elapsed local hours / 24, rounded up, at
-- least one, starting on the local start date (so a stay across a daylight-saving change is counted on the wall clock).
create or replace function public.quote_nightly(
  p_vehicle_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_tz text default null,
  p_base_rate numeric default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tz text;
  v_base numeric;
  v_local_start timestamp;
  v_local_end timestamp;
  v_nights int;
  v_first date;
  v_rows jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_any boolean := false;
  i int;
  r record;
begin
  select coalesce(p_base_rate, v.current_rate), coalesce(p_tz, t.timezone)
    into v_base, v_tz
  from public.vehicles v
  left join public.teams t on t.id = v.team_id
  where v.id = p_vehicle_id;

  if v_base is null then
    return jsonb_build_object('error', 'vehicle not found');
  end if;

  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;

  v_local_start := p_start at time zone v_tz;
  v_local_end := p_end at time zone v_tz;
  if v_local_end < v_local_start then
    return jsonb_build_object('nights', 0, 'total', 0, 'average', null, 'breakdown', '[]'::jsonb,
      'base_rate', v_base, 'time_zone', v_tz, 'has_overrides', false);
  end if;

  v_nights := least(366, greatest(1, ceil(extract(epoch from (v_local_end - v_local_start)) / 86400.0)::int));
  v_first := v_local_start::date;

  for i in 0 .. v_nights - 1 loop
    select * into r from public.rate_for_day(p_vehicle_id, v_first + i, p_base_rate);
    v_total := v_total + r.rate;
    if r.source <> 'base' then v_any := true; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('date', v_first + i, 'rate', r.rate, 'source', r.source));
  end loop;

  return jsonb_build_object(
    'nights', v_nights,
    'total', v_total,
    'average', v_total / v_nights,
    'breakdown', v_rows,
    'base_rate', v_base,
    'time_zone', v_tz,
    'has_overrides', v_any
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Writing a date rate. Replaces overlapping active ranges of the same source in one transaction and leaves a line in
-- the vehicle's change history. Row-level security still decides who may do it (managers and above).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.set_rate_override(
  p_vehicle_id uuid,
  p_start date,
  p_end date,
  p_rate numeric,
  p_source text default 'manual',
  p_reason text default null,
  p_event_ref text default null
)
returns public.vehicle_rate_overrides
language plpgsql
as $$
declare
  v record;
  res public.vehicle_rate_overrides;
begin
  select id, team_id, name into v from public.vehicles where id = p_vehicle_id;
  if not found then
    raise exception 'vehicle not found' using errcode = 'P0002';
  end if;
  if p_source not in ('manual', 'motoriq') then
    raise exception 'unknown source %', p_source using errcode = '22023';
  end if;

  update public.vehicle_rate_overrides
     set revoked_at = now(), revoked_by = auth.uid()
   where vehicle_id = p_vehicle_id
     and source = p_source
     and revoked_at is null
     and daterange(start_date, end_date, '[]') && daterange(p_start, p_end, '[]');

  insert into public.vehicle_rate_overrides (team_id, vehicle_id, start_date, end_date, daily_rate, source, reason, event_ref)
  values (v.team_id, p_vehicle_id, p_start, p_end, p_rate, p_source, p_reason, p_event_ref)
  returning * into res;

  if auth.uid() is not null then
    insert into public.vehicle_change_log (vehicle_id, user_id, team_id, field_name, old_value, new_value, change_source)
    values (p_vehicle_id, auth.uid(), v.team_id, 'date_rate', null,
            format('%s to %s at %s a day%s', p_start, p_end, p_rate, coalesce(' (' || p_reason || ')', '')), p_source);
  end if;
  return res;
end;
$$;

create or replace function public.revoke_rate_override(p_id uuid)
returns void
language plpgsql
as $$
declare
  o public.vehicle_rate_overrides;
begin
  update public.vehicle_rate_overrides
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_id and revoked_at is null
   returning * into o;
  if not found then
    raise exception 'date rate not found, already revoked, or not allowed' using errcode = 'P0002';
  end if;
  if auth.uid() is not null then
    insert into public.vehicle_change_log (vehicle_id, user_id, team_id, field_name, old_value, new_value, change_source)
    values (o.vehicle_id, auth.uid(), o.team_id, 'date_rate',
            format('%s to %s at %s a day', o.start_date, o.end_date, o.daily_rate), 'removed', o.source);
  end if;
end;
$$;

revoke all on function public.rate_for_day(uuid, date, numeric) from public;
revoke all on function public.quote_nightly(uuid, timestamptz, timestamptz, text, numeric) from public;
revoke all on function public.set_rate_override(uuid, date, date, numeric, text, text, text) from public;
revoke all on function public.revoke_rate_override(uuid) from public;
grant execute on function public.rate_for_day(uuid, date, numeric) to authenticated, service_role;
grant execute on function public.quote_nightly(uuid, timestamptz, timestamptz, text, numeric) to authenticated, service_role;
grant execute on function public.set_rate_override(uuid, date, date, numeric, text, text, text) to authenticated, service_role;
grant execute on function public.revoke_rate_override(uuid) to authenticated, service_role;
