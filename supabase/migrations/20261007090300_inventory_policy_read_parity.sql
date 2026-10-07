-- Depends on 20261007090200. Preserves exact RPC signatures and scope filters.
-- Day-granular results are conservative discovery, exact instants use shared
-- predicate. Caller compatibility remains a rollout gate, no opt-in change here.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE FUNCTION public.agent_inventory_available(_vehicle uuid,_start timestamptz,_end timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE proposed tstzrange; buffer integer;
BEGIN
  IF _start IS NULL OR _end IS NULL OR _end<=_start OR NOT isfinite(_start) OR NOT isfinite(_end) THEN
    RAISE EXCEPTION 'invalid_inventory_interval' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(t.rental_buffer_minutes,60) INTO buffer FROM public.vehicles v
  JOIN public.teams t ON t.id=v.team_id WHERE v.id=_vehicle;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF buffer NOT BETWEEN 0 AND 10080 THEN RAISE EXCEPTION 'invalid_inventory_buffer' USING ERRCODE='22023'; END IF;
  proposed:=public.agent_inventory_span(_start,_end,buffer);
  RETURN NOT EXISTS(SELECT FROM public.bookings b WHERE b.vehicle_id=_vehicle
    AND public.agent_inventory_blocking(b.status)
    AND public.agent_inventory_span(b.start_date,b.end_date,b.inventory_buffer_minutes) && proposed)
    AND NOT EXISTS(SELECT FROM public.vehicle_blocked_dates d WHERE d.vehicle_id=_vehicle
    AND tstzrange(d.start_date,d.end_date,'[)') && proposed);
END;
$$;
REVOKE ALL ON FUNCTION public.agent_inventory_available(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.agent_inventory_available(uuid,timestamptz,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.public_vehicle_busy_windows(_team_slug text,_vehicle_slug text,_range_start date,_range_end date)
RETURNS TABLE(busy_start_at timestamptz,busy_end_at timestamptz,timezone text,buffer_minutes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF _range_start IS NULL OR _range_end IS NULL OR _range_end<_range_start OR _range_end-_range_start>365 THEN
    RAISE EXCEPTION 'invalid_inventory_window' USING ERRCODE='22023';
  END IF;
  RETURN QUERY WITH target AS (
    SELECT v.id,coalesce(t.timezone,'UTC') tz FROM public.vehicles v JOIN public.teams t ON t.id=v.team_id
    WHERE t.slug=_team_slug AND v.slug=_vehicle_slug AND public.is_marketplace_vehicle(v.id)
  ), spans AS (
    SELECT public.agent_inventory_span(b.start_date,b.end_date,b.inventory_buffer_minutes) span,
      tg.tz,b.inventory_buffer_minutes buf FROM public.bookings b JOIN target tg ON tg.id=b.vehicle_id
    WHERE public.agent_inventory_blocking(b.status)
    UNION ALL
    SELECT tstzrange(d.start_date,d.end_date,'[)'),tg.tz,0
    FROM public.vehicle_blocked_dates d JOIN target tg ON tg.id=d.vehicle_id
  ) SELECT lower(s.span),upper(s.span),s.tz,s.buf FROM spans s
    WHERE s.span && tstzrange(_range_start::timestamp AT TIME ZONE s.tz,
      (_range_end+1)::timestamp AT TIME ZONE s.tz,'[)') ORDER BY 1;
END;
$$;
REVOKE ALL ON FUNCTION public.public_vehicle_busy_windows(text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_vehicle_busy_windows(text,text,date,date) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.public_vehicle_availability(_team_slug text,_vehicle_slug text,_range_start date,_range_end date)
RETURNS TABLE(busy_start date,busy_end date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
  SELECT (w.busy_start_at AT TIME ZONE w.timezone)::date,
    ((w.busy_end_at-interval '1 microsecond') AT TIME ZONE w.timezone)::date
  FROM public.public_vehicle_busy_windows(_team_slug,_vehicle_slug,_range_start,_range_end) w ORDER BY 1
$$;
REVOKE ALL ON FUNCTION public.public_vehicle_availability(text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_vehicle_availability(text,text,date,date) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.public_fleet_busy(_range_start date,_range_end date,_team_slug text DEFAULT NULL)
RETURNS TABLE(team_slug text,vehicle_slug text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF _range_start IS NULL OR _range_end IS NULL OR _range_end<_range_start OR _range_end-_range_start>180 THEN
    RAISE EXCEPTION 'invalid_inventory_window' USING ERRCODE='22023';
  END IF;
  -- Preserve existing fully-past-window behavior; exact helper never infers
  -- availability from that discovery shortcut.
  IF _range_end<current_date THEN RETURN; END IF;
  RETURN QUERY WITH cand AS (
    SELECT v.id,t.slug t_slug,v.slug v_slug,coalesce(t.timezone,'UTC') tz FROM public.vehicles v
    JOIN public.teams t ON t.id=v.team_id
    WHERE coalesce(v.marketplace_unlisted,false)=false AND public.is_marketplace_vehicle(v.id)
      AND ((_team_slug IS NOT NULL AND t.slug=_team_slug) OR (_team_slug IS NULL AND t.marketplace_listed=true))
  ), spans AS (
    SELECT c.t_slug,c.v_slug,c.tz,public.agent_inventory_span(b.start_date,b.end_date,b.inventory_buffer_minutes) span
    FROM cand c JOIN public.bookings b ON b.vehicle_id=c.id WHERE public.agent_inventory_blocking(b.status)
    UNION ALL SELECT c.t_slug,c.v_slug,c.tz,tstzrange(d.start_date,d.end_date,'[)')
    FROM cand c JOIN public.vehicle_blocked_dates d ON d.vehicle_id=c.id
  ) SELECT DISTINCT s.t_slug,s.v_slug FROM spans s
    WHERE s.span && tstzrange(_range_start::timestamp AT TIME ZONE s.tz,
      (_range_end+1)::timestamp AT TIME ZONE s.tz,'[)') ORDER BY 1,2;
END;
$$;
COMMENT ON FUNCTION public.public_fleet_busy(date,date,text) IS
  'Conservative tenant-local inclusive-date discovery using snapshotted post-return buffers and raw maintenance blocks. Exact booking availability uses agent_inventory_available. Existing listing/unlisted scope preserved; elapsed holds remain blocked until terminal transition.';
REVOKE ALL ON FUNCTION public.public_fleet_busy(date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_fleet_busy(date,date,text) TO anon,authenticated,service_role;

-- expire_unverified_holds financial-reference guard and 24h/72h policy preserved.
-- Scheduling, payment reconciliation and transactional retries are owned by01-06.
-- Existing public_vehicle_quote arithmetic preserved. Quotes must separately
-- check agent_inventory_available; plan01-04 consumes the exact predicate.
