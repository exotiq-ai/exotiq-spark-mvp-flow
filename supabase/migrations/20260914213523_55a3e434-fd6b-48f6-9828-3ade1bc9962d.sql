-- Setup writes: allowed unless the account is hard-locked.
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
        OR t.billing_status IN ('grandfathered','pending_activation','trialing','active','past_due')
       FROM public.teams t
      WHERE t.id = _team_id),
    true
  );
$$;

-- Bookings, payments, renter-facing writes: requires an activated account.
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

CREATE OR REPLACE FUNCTION public.billing_tier_for_count(_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN COALESCE(_count, 1) <= 15 THEN 'pro'
           WHEN COALESCE(_count, 1) <= 50 THEN 'business'
           ELSE 'enterprise'
         END;
$$;