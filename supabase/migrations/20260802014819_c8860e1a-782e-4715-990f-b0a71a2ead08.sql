CREATE TABLE public.smoke_test_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario text NOT NULL CHECK (scenario IN ('subscription','marketplace_booking','refund')),
  mode text NOT NULL CHECK (mode IN ('live','test')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed','cancelled')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_cents bigint NOT NULL DEFAULT 0,
  cleanup_state text NOT NULL DEFAULT 'pending' CHECK (cleanup_state IN ('pending','done','failed','not_needed')),
  parent_run_id uuid REFERENCES public.smoke_test_runs(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.smoke_test_runs TO authenticated;
GRANT ALL ON public.smoke_test_runs TO service_role;

ALTER TABLE public.smoke_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage smoke test runs"
ON public.smoke_test_runs
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_smoke_test_runs_created_at ON public.smoke_test_runs (created_at DESC);

CREATE TRIGGER trg_smoke_test_runs_updated_at
BEFORE UPDATE ON public.smoke_test_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();