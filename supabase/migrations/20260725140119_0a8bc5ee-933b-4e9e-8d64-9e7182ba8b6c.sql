
-- Phase 3: hard guard so a vehicle with historical bookings can't be
-- deleted. Ops archive path is the RPC archive_vehicle().
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'public.bookings'::regclass
     AND contype = 'f'
     AND conname LIKE '%vehicle_id%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;

-- Phase 5: deposit resolution (tenant default + per-vehicle override).
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS default_deposit_cents bigint;
COMMENT ON COLUMN public.teams.default_deposit_cents IS
  'Tenant-wide default security deposit hold in cents. NULL falls back to the platform default (100000 = $1,000).';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS deposit_override_cents bigint;
COMMENT ON COLUMN public.vehicles.deposit_override_cents IS
  'Per-vehicle security deposit override in cents. NULL falls back to teams.default_deposit_cents.';

ALTER TABLE public.teams
  ADD CONSTRAINT teams_default_deposit_nonneg CHECK (default_deposit_cents IS NULL OR default_deposit_cents >= 0);
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_deposit_override_nonneg CHECK (deposit_override_cents IS NULL OR deposit_override_cents >= 0);

CREATE OR REPLACE FUNCTION public.resolve_deposit_cents(_vehicle_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    v.deposit_override_cents,
    t.default_deposit_cents,
    100000  -- $1,000 platform fallback
  )
  FROM public.vehicles v
  JOIN public.teams t ON t.id = v.team_id
  WHERE v.id = _vehicle_id;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_deposit_cents(uuid) TO authenticated, service_role;
