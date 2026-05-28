
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- New teams default to a 14-day trial from creation
ALTER TABLE public.teams
  ALTER COLUMN trial_start SET DEFAULT now(),
  ALTER COLUMN trial_end SET DEFAULT (now() + INTERVAL '14 days');

-- Existing teams: leave NULL = grandfathered (no soft paywall)
