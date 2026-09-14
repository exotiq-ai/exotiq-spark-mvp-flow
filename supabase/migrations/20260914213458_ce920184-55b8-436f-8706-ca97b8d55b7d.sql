-- 1. Billing state columns on teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_status text,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS billed_tier text,
  ADD COLUMN IF NOT EXISTS billed_quantity integer,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS annual_offer_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS annual_offer_dismissed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_billing_status_check') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_billing_status_check
      CHECK (billing_status IS NULL OR billing_status IN (
        'pending_activation','trialing','active','past_due','unpaid','canceled','grandfathered'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_billing_interval_check') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_billing_interval_check
      CHECK (billing_interval IS NULL OR billing_interval IN ('month','year'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_billed_tier_check') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_billed_tier_check
      CHECK (billed_tier IS NULL OR billed_tier IN ('pro','business','enterprise'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS teams_stripe_customer_id_key
  ON public.teams (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teams_stripe_subscription_id_key
  ON public.teams (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_billing_status ON public.teams (billing_status);

-- 2. Trial dates are written only by Stripe webhooks from now on
ALTER TABLE public.teams
  ALTER COLUMN trial_start DROP DEFAULT,
  ALTER COLUMN trial_end DROP DEFAULT;

-- 3. Grandfather everything that exists today (cutover-date based, not trial_end based)
UPDATE public.teams
   SET billing_status = 'grandfathered'
 WHERE billing_status IS NULL
   AND created_at < '2026-09-15T00:00:00Z';

UPDATE public.teams
   SET billing_status = 'grandfathered'
 WHERE is_demo_account = true
   AND billing_status IS DISTINCT FROM 'grandfathered';

-- 4. Billing email audit log
CREATE TABLE IF NOT EXISTS public.billing_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  stripe_event_id text,
  recipient text NOT NULL,
  resend_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_email_log TO authenticated;
GRANT ALL ON public.billing_email_log TO service_role;

ALTER TABLE public.billing_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read billing email log" ON public.billing_email_log;
CREATE POLICY "Super admins read billing email log"
  ON public.billing_email_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS billing_email_log_event_unique
  ON public.billing_email_log (team_id, email_type, stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_email_log_team ON public.billing_email_log (team_id, email_type, sent_at DESC);

-- 5. Shared definitions: active vehicle count, tier from count, writability
CREATE OR REPLACE FUNCTION public.team_active_vehicle_count(_team_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(1, COUNT(*)::int)
    FROM public.vehicles v
   WHERE v.team_id = _team_id
     AND v.archived_at IS NULL
     AND v.trashed_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.billing_tier_for_count(_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
           WHEN COALESCE(_count, 1) <= 15 THEN 'pro'
           WHEN COALESCE(_count, 1) <= 50 THEN 'business'
           ELSE 'enterprise'
         END;
$$;

-- Writable = billing is in good standing. Pending activation intentionally counts as
-- writable for setup data; renter-facing writes are gated separately.
CREATE OR REPLACE FUNCTION public.team_is_writable(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT t.is_demo_account
        OR t.billing_status IS NULL
        OR t.billing_status IN ('grandfathered','trialing','active','past_due')
       FROM public.teams t
      WHERE t.id = _team_id),
    true
  );
$$;

-- Setup-only writability: everything except a hard-locked account.
CREATE OR REPLACE FUNCTION public.team_can_transact(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT t.is_demo_account
        OR t.billing_status IS NULL
        OR t.billing_status IN ('grandfathered','trialing','active','past_due')
       FROM public.teams t
      WHERE t.id = _team_id),
    true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.team_active_vehicle_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_is_writable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_can_transact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_active_vehicle_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_is_writable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_can_transact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_tier_for_count(integer) TO authenticated, service_role;