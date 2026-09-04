set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.public_fleet_busy(
  _range_start date,
  _range_end date,
  _team_slug text default null
)
returns table(team_slug text, vehicle_slug text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if _range_start is null or _range_end is null then
    raise exception 'public_fleet_busy: _range_start and _range_end are required'
      using errcode = '22023';
  end if;

  if _range_end < _range_start then
    raise exception 'public_fleet_busy: _range_end (%) must be on or after _range_start (%)', _range_end, _range_start
      using errcode = '22023';
  end if;

  if (_range_end - _range_start) > 180 then
    raise exception 'public_fleet_busy: window of % days exceeds the 180 day maximum', (_range_end - _range_start)
      using errcode = '22023';
  end if;

  -- A window entirely in the past has nothing to filter.
  if _range_end < current_date then
    return;
  end if;

  return query
  with cand as (
    select
      v.id                                        as vehicle_id,
      t.slug                                      as t_slug,
      v.slug                                      as v_slug,
      coalesce(t.rental_buffer_minutes, 60)       as buffer_minutes
    from public.vehicles v
    join public.teams t on t.id = v.team_id
    where coalesce(v.marketplace_unlisted, false) = false
      and public.is_marketplace_vehicle(v.id)
      and (
        -- team-scoped call: no marketplace_listed gate
        (_team_slug is not null and t.slug = _team_slug)
        -- fleet-wide call: listed teams only
        or (_team_slug is null and t.marketplace_listed = true)
      )
  ),
  busy as (
    select c.t_slug, c.v_slug
    from cand c
    join public.bookings b on b.vehicle_id = c.vehicle_id
    where b.status in ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
      and coalesce(b.is_historical, false) = false
      and (b.start_date - make_interval(mins => c.buffer_minutes))::date <= _range_end
      and greatest(
            (b.start_date - make_interval(mins => c.buffer_minutes))::date,
            (b.end_date - interval '1 day')::date
          ) >= _range_start

    union

    select c.t_slug, c.v_slug
    from cand c
    join public.vehicle_blocked_dates d on d.vehicle_id = c.vehicle_id
    where d.start_date::date <= _range_end
      and greatest(d.start_date::date, (d.end_date - interval '1 second')::date) >= _range_start
  )
  select distinct busy.t_slug, busy.v_slug
  from busy
  order by 1, 2;
end;
$function$;

comment on function public.public_fleet_busy(date, date, text) is
'Batched availability for public fleet grids. Returns {team_slug, vehicle_slug} for every publicly visible vehicle that is NOT rentable for the whole window [_range_start, _range_end].

Overlap predicate (inclusive on both window ends): a vehicle is busy when busy_start <= _range_end AND busy_end >= _range_start, where busy_start/busy_end are the same buffer-adjusted dates public_vehicle_availability produces:
  bookings: busy_start = (start_date - team.rental_buffer_minutes)::date, busy_end = greatest(busy_start, (end_date - interval ''1 day'')::date)
  manual/maintenance blocks (vehicle_blocked_dates): busy_start = start_date::date, busy_end = greatest(busy_start, (end_date - interval ''1 second'')::date)
Because busy_end for a booking is the day before its end_date, the drop-off day itself is rentable - identical to public_vehicle_availability.

Blocking booking statuses (identical to public_vehicle_availability): requested, pending_documents, pending_payment, pending, confirmed, active; rows with is_historical = true are ignored.

Scope: _team_slug null -> teams with marketplace_listed = true only. _team_slug given -> that team regardless of marketplace_listed. Both paths require is_marketplace_vehicle(v.id) and marketplace_unlisted = false.

Errors on _range_end < _range_start and on windows longer than 180 days; a fully past window returns an empty set.';

revoke all on function public.public_fleet_busy(date, date, text) from public;
grant execute on function public.public_fleet_busy(date, date, text) to anon, authenticated, service_role;