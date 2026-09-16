CREATE OR REPLACE FUNCTION public.get_super_admin_subscription_health()
RETURNS TABLE (
  team_id uuid,
  team_name text,
  owner_email text,
  billing_status text,
  billed_tier text,
  billing_interval text,
  billed_quantity integer,
  active_vehicles integer,
  expected_tier text,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  activated_at timestamptz,
  is_demo_account boolean,
  has_subscription boolean,
  quantity_mismatch boolean,
  over_cap boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can read subscription health';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    COALESCE(t.name, 'Unnamed')::text,
    p.email::text,
    t.billing_status::text,
    t.billed_tier::text,
    t.billing_interval::text,
    t.billed_quantity::integer,
    public.team_active_vehicle_count(t.id)::integer AS active_vehicles,
    public.billing_tier_for_count(public.team_active_vehicle_count(t.id))::text AS expected_tier,
    t.trial_end,
    t.current_period_end,
    COALESCE(t.cancel_at_period_end, false),
    t.activated_at,
    COALESCE(t.is_demo_account, false),
    (t.stripe_subscription_id IS NOT NULL) AS has_subscription,
    (
      t.stripe_subscription_id IS NOT NULL
      AND COALESCE(t.billed_quantity, 0)
          <> LEAST(public.team_active_vehicle_count(t.id), 50)
    ) AS quantity_mismatch,
    (public.team_active_vehicle_count(t.id) > 50) AS over_cap
  FROM public.teams t
  LEFT JOIN public.profiles p ON p.id = t.owner_id
  ORDER BY
    (public.team_active_vehicle_count(t.id) > 50) DESC,
    t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_super_admin_subscription_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_super_admin_subscription_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_subscription_health() TO service_role;