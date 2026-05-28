ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_assumed_plan_tier_check;

UPDATE public.teams SET assumed_plan_tier = 'pro' WHERE assumed_plan_tier = 'starter';
UPDATE public.teams SET assumed_plan_tier = 'business' WHERE assumed_plan_tier = 'professional';

ALTER TABLE public.teams
  ADD CONSTRAINT teams_assumed_plan_tier_check
  CHECK (assumed_plan_tier IS NULL OR assumed_plan_tier IN ('pro','business','enterprise'));