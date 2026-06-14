
-- ============================================================================
-- Phase 1 EU/UK compliance foundation
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Teams: jurisdiction + data region + AI minimization level
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS primary_jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS data_region TEXT NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS ai_data_minimization_level TEXT NOT NULL DEFAULT 'standard';

-- Soft validation via trigger (CHECK constraints are fine here since values are static)
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_data_region_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_data_region_check
  CHECK (data_region IN ('us', 'eu'));

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_ai_min_level_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_ai_min_level_check
  CHECK (ai_data_minimization_level IN ('standard', 'strict'));

-- ---------------------------------------------------------------------------
-- 2. sub_processors (global registry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sub_processors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  region TEXT NOT NULL,
  transfer_mechanism TEXT,
  dpa_url TEXT,
  privacy_policy_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sub_processors TO authenticated;
GRANT ALL ON public.sub_processors TO service_role;

ALTER TABLE public.sub_processors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Any authenticated user can read sub processors" ON public.sub_processors;
CREATE POLICY "Any authenticated user can read sub processors"
  ON public.sub_processors FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 3. data_processing_inventory (global manifest mirror)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_processing_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  field TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  lawful_basis TEXT NOT NULL,
  retention_days INTEGER,
  sub_processor_names TEXT[] NOT NULL DEFAULT '{}',
  region_partitionable BOOLEAN NOT NULL DEFAULT true,
  never_transfer BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity, field)
);

GRANT SELECT ON public.data_processing_inventory TO authenticated;
GRANT ALL ON public.data_processing_inventory TO service_role;

ALTER TABLE public.data_processing_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Any authenticated user can read data inventory"
  ON public.data_processing_inventory;
CREATE POLICY "Any authenticated user can read data inventory"
  ON public.data_processing_inventory FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 4. ai_transfer_log (immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_transfer_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID,
  caller TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_region TEXT,
  minimization_level TEXT NOT NULL DEFAULT 'standard',
  payload_field_hashes JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_count INTEGER,
  redacted_field_count INTEGER,
  request_bytes INTEGER,
  response_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_transfer_log_team_idx
  ON public.ai_transfer_log (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_transfer_log_user_idx
  ON public.ai_transfer_log (user_id, created_at DESC);

GRANT SELECT ON public.ai_transfer_log TO authenticated;
GRANT ALL ON public.ai_transfer_log TO service_role;

ALTER TABLE public.ai_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view their team's AI transfer log"
  ON public.ai_transfer_log;
CREATE POLICY "Team members can view their team's AI transfer log"
  ON public.ai_transfer_log FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = ai_transfer_log.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_ai_transfer_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_transfer_log rows are immutable (op=%)', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_ai_transfer_log_update ON public.ai_transfer_log;
CREATE TRIGGER prevent_ai_transfer_log_update
  BEFORE UPDATE OR DELETE ON public.ai_transfer_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_transfer_log_mutation();

-- ---------------------------------------------------------------------------
-- 5. data_subject_requests (immutable per-row after fulfilment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL,
  subject_email TEXT,
  subject_user_id UUID,
  subject_customer_id UUID,
  requester_user_id UUID,
  requester_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  evidence_url TEXT,
  fulfilled_at TIMESTAMPTZ,
  scheduled_purge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_subject_requests_team_idx
  ON public.data_subject_requests (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_subject_requests_subject_idx
  ON public.data_subject_requests (subject_user_id);

GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subjects can view requests about themselves"
  ON public.data_subject_requests;
CREATE POLICY "Subjects can view requests about themselves"
  ON public.data_subject_requests FOR SELECT
  TO authenticated
  USING (subject_user_id = auth.uid() OR requester_user_id = auth.uid());

DROP POLICY IF EXISTS "Team admins can view their team's DSRs"
  ON public.data_subject_requests;
CREATE POLICY "Team admins can view their team's DSRs"
  ON public.data_subject_requests FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Subjects and team admins can open requests"
  ON public.data_subject_requests;
CREATE POLICY "Subjects and team admins can open requests"
  ON public.data_subject_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND (
      subject_user_id = auth.uid()
      OR (team_id IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Block destructive mutation; status-only updates handled via edge function (service_role)
CREATE OR REPLACE FUNCTION public.guard_dsr_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'data_subject_requests rows cannot be deleted';
  END IF;
  -- Allow status/notes/evidence_url/fulfilled_at/scheduled_purge_at updates only
  IF NEW.id <> OLD.id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.request_type <> OLD.request_type
     OR NEW.subject_email IS DISTINCT FROM OLD.subject_email
     OR NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id
     OR NEW.subject_customer_id IS DISTINCT FROM OLD.subject_customer_id
     OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
     OR NEW.requester_email IS DISTINCT FROM OLD.requester_email
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Immutable DSR fields cannot be modified';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS guard_dsr_mutation ON public.data_subject_requests;
CREATE TRIGGER guard_dsr_mutation
  BEFORE UPDATE OR DELETE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_dsr_mutation();

-- ---------------------------------------------------------------------------
-- 6. retention_policies (global, edited by service role / admin tooling)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  basis TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'anonymize',
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  last_run_dry_run BOOLEAN,
  last_affected_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Any authenticated user can read retention policies"
  ON public.retention_policies;
CREATE POLICY "Any authenticated user can read retention policies"
  ON public.retention_policies FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 7. data_access_log (immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  actor_user_id UUID,
  actor_email TEXT,
  entity TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_access_log_team_idx
  ON public.data_access_log (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_access_log_entity_idx
  ON public.data_access_log (entity, record_id);

GRANT SELECT ON public.data_access_log TO authenticated;
GRANT ALL ON public.data_access_log TO service_role;

ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team admins can view their team's access log"
  ON public.data_access_log;
CREATE POLICY "Team admins can view their team's access log"
  ON public.data_access_log FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.prevent_data_access_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'data_access_log rows are immutable (op=%)', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_data_access_log_mutation ON public.data_access_log;
CREATE TRIGGER prevent_data_access_log_mutation
  BEFORE UPDATE OR DELETE ON public.data_access_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_data_access_log_mutation();

-- ---------------------------------------------------------------------------
-- 8. updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS touch_sub_processors_updated_at ON public.sub_processors;
CREATE TRIGGER touch_sub_processors_updated_at
  BEFORE UPDATE ON public.sub_processors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_data_processing_inventory_updated_at
  ON public.data_processing_inventory;
CREATE TRIGGER touch_data_processing_inventory_updated_at
  BEFORE UPDATE ON public.data_processing_inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_retention_policies_updated_at
  ON public.retention_policies;
CREATE TRIGGER touch_retention_policies_updated_at
  BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
