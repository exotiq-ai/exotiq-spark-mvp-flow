CREATE TABLE public.vehicle_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vehicle_change_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vehicle_change_log_vehicle ON public.vehicle_change_log (vehicle_id, created_at DESC);
CREATE INDEX idx_vehicle_change_log_team ON public.vehicle_change_log (team_id, created_at DESC);

CREATE POLICY "Team members can view vehicle changes"
  ON public.vehicle_change_log FOR SELECT TO authenticated
  USING (is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can insert vehicle change logs"
  ON public.vehicle_change_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);