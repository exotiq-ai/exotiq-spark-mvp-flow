-- Phase 2: jurisdiction-aware state rental fee.
CREATE TABLE IF NOT EXISTS public.state_rental_fees (
  state_code text PRIMARY KEY,
  daily_cents bigint NOT NULL DEFAULT 0,
  label text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.state_rental_fees TO anon;
GRANT SELECT ON public.state_rental_fees TO authenticated;
GRANT ALL ON public.state_rental_fees TO service_role;

ALTER TABLE public.state_rental_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "state fees are publicly readable" ON public.state_rental_fees;
CREATE POLICY "state fees are publicly readable"
  ON public.state_rental_fees FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super admins manage state fees" ON public.state_rental_fees;
CREATE POLICY "super admins manage state fees"
  ON public.state_rental_fees FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Resolve a team's jurisdiction: default active location state, else business_address region.
CREATE OR REPLACE FUNCTION public.team_state_code(_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT upper(nullif(btrim(coalesce(
    (SELECT loc.state
       FROM public.locations loc
      WHERE loc.team_id = _team_id
        AND coalesce(loc.is_active, true)
        AND nullif(btrim(loc.state), '') IS NOT NULL
      ORDER BY loc.is_default DESC NULLS LAST, loc.created_at
      LIMIT 1),
    (SELECT t.business_address->>'region' FROM public.teams t WHERE t.id = _team_id)
  )), ''))
$$;

CREATE OR REPLACE FUNCTION public.team_state_fee_daily_cents(_team_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT f.daily_cents
       FROM public.state_rental_fees f
      WHERE f.state_code = public.team_state_code(_team_id)),
    0::bigint)
$$;