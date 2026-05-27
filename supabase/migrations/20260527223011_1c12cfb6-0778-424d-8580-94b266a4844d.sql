
-- 1. Vehicles: add archive/trash columns + last-known name snapshot
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_known_name TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_archived_at ON public.vehicles (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_trashed_at ON public.vehicles (trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_purge_at ON public.vehicles (purge_at) WHERE purge_at IS NOT NULL;

-- One-time backfill: fold legacy `retired` into Archived
UPDATE public.vehicles
SET archived_at = COALESCE(archived_at, updated_at, now())
WHERE status = 'retired' AND archived_at IS NULL;

-- 2. Daily billing snapshots
CREATE TABLE IF NOT EXISTS public.vehicle_billing_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  active_count INTEGER NOT NULL DEFAULT 0,
  trashed_count INTEGER NOT NULL DEFAULT 0,
  total_billable INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_vbs_team_date ON public.vehicle_billing_snapshots (team_id, snapshot_date DESC);

GRANT SELECT ON public.vehicle_billing_snapshots TO authenticated;
GRANT ALL ON public.vehicle_billing_snapshots TO service_role;

ALTER TABLE public.vehicle_billing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins view billing snapshots"
ON public.vehicle_billing_snapshots
FOR SELECT
TO authenticated
USING (public.is_team_admin(auth.uid(), team_id) OR public.is_super_admin(auth.uid()));

-- 3. Purged-VIN fingerprints (30-day cooldown)
CREATE TABLE IF NOT EXISTS public.purged_vehicle_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  vin TEXT NOT NULL,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prior_peak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvf_team_vin ON public.purged_vehicle_fingerprints (team_id, vin);
CREATE INDEX IF NOT EXISTS idx_pvf_purged_at ON public.purged_vehicle_fingerprints (purged_at);

GRANT SELECT ON public.purged_vehicle_fingerprints TO authenticated;
GRANT ALL ON public.purged_vehicle_fingerprints TO service_role;

ALTER TABLE public.purged_vehicle_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins view purged fingerprints"
ON public.purged_vehicle_fingerprints
FOR SELECT
TO authenticated
USING (public.is_team_admin(auth.uid(), team_id) OR public.is_super_admin(auth.uid()));

-- 4. RPC functions for archive/trash lifecycle with strict role enforcement
CREATE OR REPLACE FUNCTION public.archive_vehicle(p_vehicle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team UUID;
BEGIN
  SELECT team_id INTO v_team FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_team IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;
  IF NOT public.is_team_member(auth.uid(), v_team) THEN
    RAISE EXCEPTION 'Not authorized for this team';
  END IF;
  -- Manager+ via team_members role
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid() AND team_id = v_team AND is_active = true
      AND role IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Manager role or higher required to archive vehicles';
  END IF;

  UPDATE public.vehicles
  SET archived_at = now(), trashed_at = NULL, purge_at = NULL, updated_at = now()
  WHERE id = p_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_vehicle_from_archive(p_vehicle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team UUID;
BEGIN
  SELECT team_id INTO v_team FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid() AND team_id = v_team AND is_active = true
      AND role IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Manager role or higher required';
  END IF;

  UPDATE public.vehicles
  SET archived_at = NULL, updated_at = now(),
      status = CASE WHEN status = 'retired' THEN 'available' ELSE status END
  WHERE id = p_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trash_vehicle(p_vehicle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team UUID;
  v_name TEXT;
  v_active_bookings INTEGER;
BEGIN
  SELECT team_id, name INTO v_team, v_name FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT public.is_team_owner(auth.uid(), v_team) THEN
    RAISE EXCEPTION 'Only the team owner can delete vehicles';
  END IF;

  -- Block if active or future bookings exist
  SELECT COUNT(*) INTO v_active_bookings
  FROM public.bookings
  WHERE vehicle_id = p_vehicle_id
    AND status IN ('pending', 'confirmed', 'active')
    AND end_date >= now();

  IF v_active_bookings > 0 THEN
    RAISE EXCEPTION 'Vehicle has % active or future booking(s). Cancel or complete them before deleting.', v_active_bookings;
  END IF;

  UPDATE public.vehicles
  SET trashed_at = now(),
      purge_at = now() + INTERVAL '30 days',
      last_known_name = v_name,
      archived_at = NULL,
      updated_at = now()
  WHERE id = p_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_vehicle_from_trash(p_vehicle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team UUID;
BEGIN
  SELECT team_id INTO v_team FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT public.is_team_owner(auth.uid(), v_team) THEN
    RAISE EXCEPTION 'Only the team owner can restore from trash';
  END IF;

  UPDATE public.vehicles
  SET trashed_at = NULL, purge_at = NULL, updated_at = now()
  WHERE id = p_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_vehicle_now(p_vehicle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team UUID;
  v_vin TEXT;
  v_peak INTEGER;
BEGIN
  SELECT team_id, vin INTO v_team, v_vin FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT public.is_team_owner(auth.uid(), v_team) THEN
    RAISE EXCEPTION 'Only the team owner can permanently delete vehicles';
  END IF;

  -- Capture prior peak for VIN cooldown (last 60d window is plenty)
  SELECT COALESCE(MAX(total_billable), 0) INTO v_peak
  FROM public.vehicle_billing_snapshots
  WHERE team_id = v_team AND snapshot_date >= (CURRENT_DATE - INTERVAL '60 days');

  IF v_vin IS NOT NULL AND length(trim(v_vin)) > 0 THEN
    INSERT INTO public.purged_vehicle_fingerprints (team_id, vin, prior_peak)
    VALUES (v_team, v_vin, v_peak);
  END IF;

  DELETE FROM public.vehicles WHERE id = p_vehicle_id;
END;
$$;

-- 5. Daily snapshot rollup (called by cron / edge fn). SECURITY DEFINER so cron context can write.
CREATE OR REPLACE FUNCTION public.snapshot_vehicle_billing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.vehicle_billing_snapshots (team_id, snapshot_date, active_count, trashed_count, total_billable)
  SELECT
    team_id,
    CURRENT_DATE,
    COUNT(*) FILTER (WHERE archived_at IS NULL AND trashed_at IS NULL),
    COUNT(*) FILTER (WHERE trashed_at IS NOT NULL),
    COUNT(*) FILTER (WHERE archived_at IS NULL)  -- active + trashed; excludes archived
  FROM public.vehicles
  WHERE team_id IS NOT NULL
  GROUP BY team_id
  ON CONFLICT (team_id, snapshot_date) DO UPDATE
    SET active_count = EXCLUDED.active_count,
        trashed_count = EXCLUDED.trashed_count,
        total_billable = EXCLUDED.total_billable;
END;
$$;

-- 6. Auto-purge vehicles past their purge_at date
CREATE OR REPLACE FUNCTION public.auto_purge_expired_vehicles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
  v_peak INTEGER;
BEGIN
  FOR r IN
    SELECT id, team_id, vin FROM public.vehicles
    WHERE trashed_at IS NOT NULL AND purge_at IS NOT NULL AND purge_at < now()
  LOOP
    SELECT COALESCE(MAX(total_billable), 0) INTO v_peak
    FROM public.vehicle_billing_snapshots
    WHERE team_id = r.team_id AND snapshot_date >= (CURRENT_DATE - INTERVAL '60 days');

    IF r.vin IS NOT NULL AND length(trim(r.vin)) > 0 THEN
      INSERT INTO public.purged_vehicle_fingerprints (team_id, vin, prior_peak)
      VALUES (r.team_id, r.vin, v_peak);
    END IF;

    DELETE FROM public.vehicles WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
