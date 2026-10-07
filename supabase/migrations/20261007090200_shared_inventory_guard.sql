-- Universal inventory guard. Staging deployment only after reviewed conflict,
-- trigger/ACL/cascade and caller inventory. No existing overlap is deleted here.
-- Keep bookings_no_marketplace_overlap as an independent GiST backstop.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS inventory_buffer_minutes integer;
-- Current policy is the only reconstructable buffer for pre-migration rows.
-- Report historical-policy uncertainty before rollout; do not claim old consent.
UPDATE public.bookings b SET inventory_buffer_minutes = coalesce(t.rental_buffer_minutes,60)
FROM public.vehicles v JOIN public.teams t ON t.id=v.team_id
WHERE b.vehicle_id=v.id AND b.inventory_buffer_minutes IS NULL;
ALTER TABLE public.bookings ALTER COLUMN inventory_buffer_minutes SET NOT NULL;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_inventory_buffer_valid
  CHECK(inventory_buffer_minutes BETWEEN 0 AND 10080);
COMMENT ON COLUMN public.bookings.inventory_buffer_minutes IS
  'Single post-return turnaround snapshot, derived by guard on creation/vehicle move. Never a pre-pickup buffer. Existing rows reconstructed from current tenant policy.';

CREATE FUNCTION public.agent_inventory_blocking(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$ SELECT coalesce(_status IN ('requested','pending_documents','pending_payment','pending','confirmed','active'),false) $$;

CREATE FUNCTION public.agent_inventory_span(_start timestamptz,_end timestamptz,_buffer integer)
RETURNS tstzrange LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$ SELECT tstzrange(_start,_end+make_interval(mins=>_buffer),'[)') $$;

CREATE FUNCTION public.agent_inventory_lock(_old_vehicle uuid,_new_vehicle uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE vehicle uuid;
BEGIN
  -- VOLATILE SQL statements obtain fresh snapshots under READ COMMITTED.
  -- Fixed transaction snapshots cannot establish absence of committed phantoms.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'inventory_retry_read_committed' USING ERRCODE='40001';
  END IF;
  FOR vehicle IN SELECT DISTINCT x FROM unnest(ARRAY[_old_vehicle,_new_vehicle]) x WHERE x IS NOT NULL ORDER BY x LOOP
    -- Never wait for an advisory lock while holding a booking row lock: UPDATE
    -- acquires its row lock before a BEFORE ROW trigger. A waiting inserter and
    -- existing-row updater could otherwise deadlock. Abort the whole statement
    -- safely; clients retry the WHOLE transaction, bounded and with jitter.
    IF NOT pg_try_advisory_xact_lock(hashtextextended('exotiq-inventory:'||vehicle::text,0)) THEN
      RAISE EXCEPTION 'inventory_retry' USING ERRCODE='40001';
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.agent_inventory_booking_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE old_vehicle uuid; span tstzrange; expected_buffer integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_vehicle:=OLD.vehicle_id; END IF;
  IF TG_OP='DELETE' THEN
    PERFORM public.agent_inventory_lock(old_vehicle,NULL);
    RETURN OLD;
  END IF;
  PERFORM public.agent_inventory_lock(old_vehicle,NEW.vehicle_id);
  IF TG_OP='INSERT' OR NEW.vehicle_id IS DISTINCT FROM old_vehicle THEN
    SELECT coalesce(t.rental_buffer_minutes,60) INTO expected_buffer
    FROM public.vehicles v JOIN public.teams t ON t.id=v.team_id WHERE v.id=NEW.vehicle_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_inventory_vehicle' USING ERRCODE='22023'; END IF;
    IF TG_WHEN='AFTER' AND NEW.inventory_buffer_minutes IS DISTINCT FROM expected_buffer THEN
      RAISE EXCEPTION 'inventory_buffer_immutable' USING ERRCODE='22023';
    END IF;
    NEW.inventory_buffer_minutes:=expected_buffer;
  ELSIF NEW.inventory_buffer_minutes IS DISTINCT FROM OLD.inventory_buffer_minutes THEN
    RAISE EXCEPTION 'inventory_buffer_immutable' USING ERRCODE='22023';
  END IF;
  IF NEW.inventory_buffer_minutes IS NULL OR NEW.inventory_buffer_minutes NOT BETWEEN 0 AND 10080
      OR NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.end_date<=NEW.start_date
      OR NOT isfinite(NEW.start_date) OR NOT isfinite(NEW.end_date) THEN
    RAISE EXCEPTION 'invalid_inventory_interval' USING ERRCODE='22023';
  END IF;
  IF NOT public.agent_inventory_blocking(NEW.status) THEN RETURN NEW; END IF;
  -- Historical flags and booking_source never override a blocking status.
  span:=public.agent_inventory_span(NEW.start_date,NEW.end_date,NEW.inventory_buffer_minutes);
  IF EXISTS(SELECT FROM public.bookings b WHERE b.vehicle_id=NEW.vehicle_id AND b.id IS DISTINCT FROM NEW.id
      AND public.agent_inventory_blocking(b.status)
      AND public.agent_inventory_span(b.start_date,b.end_date,b.inventory_buffer_minutes) && span)
     OR EXISTS(SELECT FROM public.vehicle_blocked_dates d WHERE d.vehicle_id=NEW.vehicle_id
      AND tstzrange(d.start_date,d.end_date,'[)') && span) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.agent_inventory_blocked_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE old_vehicle uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_vehicle:=OLD.vehicle_id; END IF;
  IF TG_OP='DELETE' THEN
    PERFORM public.agent_inventory_lock(old_vehicle,NULL); RETURN OLD;
  END IF;
  PERFORM public.agent_inventory_lock(old_vehicle,NEW.vehicle_id);
  IF NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.end_date<=NEW.start_date
      OR NOT isfinite(NEW.start_date) OR NOT isfinite(NEW.end_date) THEN
    RAISE EXCEPTION 'invalid_inventory_interval' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT FROM public.bookings b WHERE b.vehicle_id=NEW.vehicle_id
      AND public.agent_inventory_blocking(b.status)
      AND public.agent_inventory_span(b.start_date,b.end_date,b.inventory_buffer_minutes)
        && tstzrange(NEW.start_date,NEW.end_date,'[)')) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE='23P01';
  END IF;
  -- Maintenance blocks may overlap each other; they form a union of hard ranges.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_inventory_blocking(text), public.agent_inventory_span(timestamptz,timestamptz,integer),
  public.agent_inventory_lock(uuid,uuid), public.agent_inventory_booking_guard(), public.agent_inventory_blocked_guard()
FROM PUBLIC,anon,authenticated;
-- Pure helper functions are used only by definer guards/read RPCs; no extra grants.

-- AFTER sees the final values after ALL existing BEFORE triggers, protecting
-- against a later trigger rewriting intervals/vehicles/status. Snapshot derivation
-- requires BEFORE; a second AFTER pass validates the final row under the same lock.
CREATE TRIGGER a_agent_inventory_booking_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.agent_inventory_booking_guard();
CREATE TRIGGER z_agent_inventory_booking_guard AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.agent_inventory_booking_guard();
CREATE TRIGGER a_agent_inventory_blocked_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vehicle_blocked_dates
FOR EACH ROW EXECUTE FUNCTION public.agent_inventory_blocked_guard();
CREATE TRIGGER z_agent_inventory_blocked_guard AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_blocked_dates
FOR EACH ROW EXECUTE FUNCTION public.agent_inventory_blocked_guard();
