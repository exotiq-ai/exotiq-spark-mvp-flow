CREATE TABLE public.vehicle_identity_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL UNIQUE REFERENCES public.vehicles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_photo_ids uuid[] NOT NULL DEFAULT '{}',
  model text,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicle_identity_sheets TO authenticated;
GRANT ALL ON public.vehicle_identity_sheets TO service_role;
ALTER TABLE public.vehicle_identity_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members read identity sheets" ON public.vehicle_identity_sheets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = vehicle_identity_sheets.team_id AND tm.user_id = auth.uid())
         OR public.is_super_admin(auth.uid()));

CREATE TABLE public.studio_hero_benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  recipe_version text NOT NULL,
  model text NOT NULL,
  vehicle_id uuid NOT NULL,
  team_id uuid NOT NULL,
  render_url text,
  qc_pass boolean,
  fidelity_score numeric,
  studio_score numeric,
  qc_failures text[] NOT NULL DEFAULT '{}',
  qc_notes text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_hero_benchmark_results TO authenticated;
GRANT ALL ON public.studio_hero_benchmark_results TO service_role;
ALTER TABLE public.studio_hero_benchmark_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read benchmark results" ON public.studio_hero_benchmark_results
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

ALTER TABLE public.hero_render_jobs ADD COLUMN IF NOT EXISTS render_model text;
ALTER TABLE public.hero_render_jobs ADD COLUMN IF NOT EXISTS recipe_version text;