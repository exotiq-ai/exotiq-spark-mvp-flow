CREATE TABLE IF NOT EXISTS public.hero_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  source_photo_id UUID REFERENCES public.vehicle_photos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','rendering','qc','passed','failed','escalated','cancelled')),
  attempt_number INT NOT NULL DEFAULT 1,
  prompt_version TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  qc_passed BOOLEAN,
  qc_failure_reasons TEXT[],
  render_photo_id UUID REFERENCES public.vehicle_photos(id) ON DELETE SET NULL,
  mirrored_source BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hero_render_jobs_vehicle ON public.hero_render_jobs(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hero_render_jobs_team ON public.hero_render_jobs(team_id, status);

GRANT SELECT, INSERT ON public.hero_render_jobs TO authenticated;
GRANT ALL ON public.hero_render_jobs TO service_role;

ALTER TABLE public.hero_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY hero_render_jobs_select ON public.hero_render_jobs
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

CREATE POLICY hero_render_jobs_insert ON public.hero_render_jobs
  FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS studio_hero_opt_out BOOLEAN NOT NULL DEFAULT false;