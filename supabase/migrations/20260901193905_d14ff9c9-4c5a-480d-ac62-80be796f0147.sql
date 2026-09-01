-- 1. Per-location tax overrides (nullable = inherit team defaults)
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric,
  ADD COLUMN IF NOT EXISTS tax_label text,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean;

-- 2. Manual vehicle blocked dates
CREATE TABLE IF NOT EXISTS public.vehicle_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'other',
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_blocked_dates_range_valid CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_blocked_dates_vehicle
  ON public.vehicle_blocked_dates (vehicle_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_blocked_dates_team
  ON public.vehicle_blocked_dates (team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_blocked_dates TO authenticated;
GRANT ALL ON public.vehicle_blocked_dates TO service_role;

ALTER TABLE public.vehicle_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view blocked dates"
  ON public.vehicle_blocked_dates FOR SELECT TO authenticated
  USING (
    public.is_team_member_of_record(auth.uid(), team_id)
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Managers can create blocked dates"
  ON public.vehicle_blocked_dates FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_team_member_of_record(auth.uid(), team_id)
      AND (
        public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
    )
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Managers can update blocked dates"
  ON public.vehicle_blocked_dates FOR UPDATE TO authenticated
  USING (
    (
      public.is_team_member_of_record(auth.uid(), team_id)
      AND (
        public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
    )
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Managers can delete blocked dates"
  ON public.vehicle_blocked_dates FOR DELETE TO authenticated
  USING (
    (
      public.is_team_member_of_record(auth.uid(), team_id)
      AND (
        public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
    )
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER update_vehicle_blocked_dates_updated_at
  BEFORE UPDATE ON public.vehicle_blocked_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
