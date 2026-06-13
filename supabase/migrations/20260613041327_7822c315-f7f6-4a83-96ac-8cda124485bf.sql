
CREATE TABLE public.uptime_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('up','down')),
  http_status INT,
  latency_ms INT,
  failure_reason TEXT,
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uptime_checks_checked_at ON public.uptime_checks (checked_at DESC);

GRANT SELECT ON public.uptime_checks TO authenticated;
GRANT ALL ON public.uptime_checks TO service_role;

ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read uptime checks"
ON public.uptime_checks FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
