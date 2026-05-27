
-- Columns on teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS billing_dunning_stage TEXT
    CHECK (billing_dunning_stage IN ('reminder','notice','restriction')),
  ADD COLUMN IF NOT EXISTS billing_dunning_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_dunning_set_by UUID,
  ADD COLUMN IF NOT EXISTS billing_dunning_message TEXT,
  ADD COLUMN IF NOT EXISTS billing_dunning_notes TEXT,
  ADD COLUMN IF NOT EXISTS assumed_plan_tier TEXT
    CHECK (assumed_plan_tier IN ('starter','professional','business','enterprise')),
  ADD COLUMN IF NOT EXISTS assumed_plan_fleet_size INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS assumed_plan_is_annual BOOLEAN DEFAULT false;

-- Audit table
CREATE TABLE IF NOT EXISTS public.billing_dunning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL, -- 'set','cleared','auto_cleared'
  from_stage TEXT,
  to_stage TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.billing_dunning_events TO authenticated;
GRANT ALL ON public.billing_dunning_events TO service_role;

ALTER TABLE public.billing_dunning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view dunning events"
  ON public.billing_dunning_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins insert dunning events"
  ON public.billing_dunning_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_billing_dunning_events_team
  ON public.billing_dunning_events(team_id, created_at DESC);

-- Set stage (super-admin only)
CREATE OR REPLACE FUNCTION public.set_billing_dunning_stage(
  p_team_id UUID,
  p_stage TEXT,
  p_assumed_plan_tier TEXT DEFAULT NULL,
  p_assumed_plan_fleet_size INTEGER DEFAULT NULL,
  p_assumed_plan_is_annual BOOLEAN DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old TEXT;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can set billing dunning stage';
  END IF;
  IF p_stage NOT IN ('reminder','notice','restriction') THEN
    RAISE EXCEPTION 'Invalid stage: %', p_stage;
  END IF;

  SELECT billing_dunning_stage INTO v_old FROM public.teams WHERE id = p_team_id;

  UPDATE public.teams
  SET billing_dunning_stage = p_stage,
      billing_dunning_set_at = now(),
      billing_dunning_set_by = auth.uid(),
      billing_dunning_message = COALESCE(p_message, billing_dunning_message),
      billing_dunning_notes = COALESCE(p_notes, billing_dunning_notes),
      assumed_plan_tier = COALESCE(p_assumed_plan_tier, assumed_plan_tier),
      assumed_plan_fleet_size = COALESCE(p_assumed_plan_fleet_size, assumed_plan_fleet_size),
      assumed_plan_is_annual = COALESCE(p_assumed_plan_is_annual, assumed_plan_is_annual),
      updated_at = now()
  WHERE id = p_team_id;

  INSERT INTO public.billing_dunning_events (team_id, actor_id, action, from_stage, to_stage, note)
  VALUES (p_team_id, auth.uid(), 'set', v_old, p_stage, p_notes);
END;
$$;

-- Clear (super-admin only)
CREATE OR REPLACE FUNCTION public.clear_billing_dunning(
  p_team_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old TEXT;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can clear billing dunning stage';
  END IF;

  SELECT billing_dunning_stage INTO v_old FROM public.teams WHERE id = p_team_id;

  UPDATE public.teams
  SET billing_dunning_stage = NULL,
      billing_dunning_set_at = NULL,
      billing_dunning_set_by = NULL,
      billing_dunning_message = NULL,
      updated_at = now()
  WHERE id = p_team_id;

  INSERT INTO public.billing_dunning_events (team_id, actor_id, action, from_stage, to_stage, note)
  VALUES (p_team_id, auth.uid(), 'cleared', v_old, NULL, p_note);
END;
$$;

-- Auto-clear when payment becomes active (called from check-subscription edge function via service role)
CREATE OR REPLACE FUNCTION public.auto_clear_billing_dunning_for_email(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_old TEXT;
BEGIN
  -- Find team owned by user with this email
  SELECT t.id, t.billing_dunning_stage INTO v_team_id, v_old
  FROM public.teams t
  JOIN public.profiles p ON p.id = t.owner_id
  WHERE LOWER(p.email) = LOWER(p_email)
    AND t.billing_dunning_stage IS NOT NULL
  LIMIT 1;

  IF v_team_id IS NULL THEN RETURN; END IF;

  UPDATE public.teams
  SET billing_dunning_stage = NULL,
      billing_dunning_set_at = NULL,
      billing_dunning_set_by = NULL,
      billing_dunning_message = NULL,
      updated_at = now()
  WHERE id = v_team_id;

  INSERT INTO public.billing_dunning_events (team_id, actor_id, action, from_stage, to_stage, note)
  VALUES (v_team_id, NULL, 'auto_cleared', v_old, NULL, 'Auto-cleared: subscription became active');
END;
$$;
