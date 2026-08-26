CREATE TABLE public.rari_selftest_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  ran_by uuid,
  ran_by_email text,
  suites text[] NOT NULL DEFAULT '{}',
  tenants jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  elapsed_ms integer,
  is_green boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rari_selftest_runs_ran_at ON public.rari_selftest_runs (ran_at DESC);
CREATE INDEX idx_rari_selftest_runs_green ON public.rari_selftest_runs (is_green, ran_at DESC);

GRANT SELECT ON public.rari_selftest_runs TO authenticated;
GRANT ALL ON public.rari_selftest_runs TO service_role;

ALTER TABLE public.rari_selftest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read self-test runs"
ON public.rari_selftest_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.is_active = true
      AND (sa.user_id = auth.uid() OR sa.email = (auth.jwt() ->> 'email'))
  )
);