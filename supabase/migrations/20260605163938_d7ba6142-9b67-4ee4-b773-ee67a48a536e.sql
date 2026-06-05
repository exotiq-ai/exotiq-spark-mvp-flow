
-- 1. Track seat-audit reviews on teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS seat_audit_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS seat_audit_reviewed_by uuid;

-- 2. Platform Pulse (single-row aggregate strip)
CREATE OR REPLACE FUNCTION public.get_super_admin_platform_pulse()
RETURNS TABLE (
  active_rentals_now bigint,
  trials_ending_7d bigint,
  accounts_over_plan bigint,
  stuck_onboarding bigint,
  failed_payments_7d bigint,
  revenue_7d numeric,
  revenue_sparkline jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action(
    'view_platform_pulse',
    jsonb_build_object('at', now())
  );

  RETURN QUERY
  WITH
    rentals AS (
      SELECT count(*) AS n
      FROM public.bookings
      WHERE status IN ('confirmed','active','in_progress','checked_out')
        AND start_date <= now()
        AND end_date >= now()
    ),
    trials AS (
      SELECT count(*) AS n
      FROM public.teams
      WHERE coalesce(is_deleted, false) = false
        AND trial_end IS NOT NULL
        AND trial_end BETWEEN now() AND now() + interval '7 days'
    ),
    over_plan AS (
      SELECT count(*) AS n
      FROM public.teams t
      WHERE coalesce(t.is_deleted, false) = false
        AND coalesce(t.assumed_plan_fleet_size, 0) > 0
        AND (
          SELECT count(*) FROM public.vehicles v
          WHERE v.team_id = t.id
            AND coalesce(v.status, '') <> 'retired'
            AND v.trashed_at IS NULL
        ) > t.assumed_plan_fleet_size
    ),
    stuck AS (
      SELECT count(*) AS n
      FROM public.onboarding_progress
      WHERE completed_at IS NULL
        AND last_activity_at < now() - interval '3 days'
    ),
    failed_pay AS (
      SELECT count(*) AS n
      FROM public.payments
      WHERE payment_status IN ('failed','requires_action','canceled')
        AND created_at >= now() - interval '7 days'
    ),
    rev7 AS (
      SELECT coalesce(sum(amount), 0) AS total
      FROM public.payments
      WHERE payment_status IN ('succeeded','paid','completed','captured')
        AND created_at >= now() - interval '7 days'
    ),
    spark AS (
      SELECT jsonb_agg(jsonb_build_object('d', d::date, 'v', coalesce(amt, 0)) ORDER BY d) AS arr
      FROM (
        SELECT d, (
          SELECT coalesce(sum(amount), 0) FROM public.payments
          WHERE payment_status IN ('succeeded','paid','completed','captured')
            AND created_at::date = d::date
        ) AS amt
        FROM generate_series((now() - interval '6 days')::date, now()::date, interval '1 day') d
      ) s
    )
  SELECT
    rentals.n,
    trials.n,
    over_plan.n,
    stuck.n,
    failed_pay.n,
    rev7.total,
    spark.arr
  FROM rentals, trials, over_plan, stuck, failed_pay, rev7, spark;
END;
$$;

-- 3. Tenant Health list (no PII)
CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_health()
RETURNS TABLE (
  team_id uuid,
  team_name text,
  city text,
  plan_tier text,
  fleet_size_cap integer,
  vehicles_in_use bigint,
  active_rentals bigint,
  util_30d numeric,
  revenue_30d numeric,
  last_login timestamptz,
  trial_end timestamptz,
  is_demo boolean,
  stripe_connected boolean,
  risk_flags text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action('view_tenant_health', jsonb_build_object('at', now()));

  RETURN QUERY
  SELECT
    t.id AS team_id,
    t.name AS team_name,
    NULL::text AS city,
    t.assumed_plan_tier AS plan_tier,
    t.assumed_plan_fleet_size AS fleet_size_cap,
    (SELECT count(*) FROM public.vehicles v
       WHERE v.team_id = t.id
         AND coalesce(v.status,'') <> 'retired'
         AND v.trashed_at IS NULL) AS vehicles_in_use,
    (SELECT count(*) FROM public.bookings b
       WHERE b.team_id = t.id
         AND b.status IN ('confirmed','active','in_progress','checked_out')
         AND b.start_date <= now() AND b.end_date >= now()) AS active_rentals,
    (
      WITH dn AS (
        SELECT count(*)::numeric AS n FROM public.vehicles v
        WHERE v.team_id = t.id
          AND coalesce(v.status,'') <> 'retired'
          AND v.trashed_at IS NULL
      ),
      busy AS (
        SELECT count(DISTINCT b.vehicle_id)::numeric AS n
        FROM public.bookings b
        WHERE b.team_id = t.id
          AND b.status IN ('confirmed','active','in_progress','checked_out','completed')
          AND b.start_date <= now()
          AND b.end_date >= now() - interval '30 days'
      )
      SELECT CASE WHEN dn.n > 0 THEN round((busy.n / dn.n) * 100, 1) ELSE 0 END
      FROM dn, busy
    ) AS util_30d,
    (SELECT coalesce(sum(p.amount),0) FROM public.payments p
       WHERE p.team_id = t.id
         AND p.payment_status IN ('succeeded','paid','completed','captured')
         AND p.created_at >= now() - interval '30 days') AS revenue_30d,
    (SELECT max(u.last_sign_in_at) FROM auth.users u
       JOIN public.team_members tm ON tm.user_id = u.id
       WHERE tm.team_id = t.id) AS last_login,
    t.trial_end,
    coalesce(t.is_demo_account, false) AS is_demo,
    coalesce(t.stripe_charges_enabled, false) AS stripe_connected,
    ARRAY(
      SELECT flag FROM (
        SELECT CASE WHEN t.trial_end IS NOT NULL
                     AND t.trial_end BETWEEN now() AND now() + interval '7 days'
                    THEN 'trial_ending' END AS flag
        UNION ALL
        SELECT CASE WHEN NOT coalesce(t.stripe_charges_enabled, false) THEN 'no_stripe' END
        UNION ALL
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.team_id = t.id
            AND p.payment_status IN ('succeeded','paid','completed','captured')
            AND p.created_at >= now() - interval '30 days'
        ) THEN 'no_payment_30d' END
        UNION ALL
        SELECT CASE WHEN coalesce(t.assumed_plan_fleet_size, 0) > 0
                     AND (SELECT count(*) FROM public.vehicles v
                          WHERE v.team_id = t.id
                            AND coalesce(v.status,'') <> 'retired'
                            AND v.trashed_at IS NULL) > t.assumed_plan_fleet_size
                    THEN 'over_plan' END
        UNION ALL
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM public.onboarding_progress op
          WHERE op.team_id = t.id
            AND op.completed_at IS NULL
            AND op.last_activity_at < now() - interval '3 days'
        ) THEN 'stuck_onboarding' END
        UNION ALL
        SELECT CASE WHEN coalesce(t.is_demo_account, false) THEN 'demo' END
      ) f WHERE flag IS NOT NULL
    ) AS risk_flags
  FROM public.teams t
  WHERE coalesce(t.is_deleted, false) = false
  ORDER BY t.created_at DESC;
END;
$$;

-- 4. Tenant Detail (includes owner email — every call logged)
CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_detail(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action(
    'open_tenant_detail',
    jsonb_build_object('team_id', p_team_id, 'at', now())
  );

  SELECT jsonb_build_object(
    'team_id', t.id,
    'team_name', t.name,
    'plan_tier', t.assumed_plan_tier,
    'fleet_size_cap', t.assumed_plan_fleet_size,
    'is_annual', t.assumed_plan_is_annual,
    'trial_start', t.trial_start,
    'trial_end', t.trial_end,
    'is_demo', coalesce(t.is_demo_account, false),
    'stripe_connected', coalesce(t.stripe_charges_enabled, false),
    'created_at', t.created_at,
    'owner', jsonb_build_object(
      'user_id', t.owner_id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone
    ),
    'fleet', (
      SELECT jsonb_build_object(
        'total', count(*),
        'active', count(*) FILTER (WHERE coalesce(v.status,'') NOT IN ('retired','maintenance')),
        'maintenance', count(*) FILTER (WHERE v.status = 'maintenance'),
        'retired', count(*) FILTER (WHERE v.status = 'retired'),
        'missing_hero_photo', count(*) FILTER (WHERE v.image_url IS NULL OR v.image_url = '')
      ) FROM public.vehicles v
      WHERE v.team_id = t.id AND v.trashed_at IS NULL
    ),
    'bookings', (
      SELECT jsonb_build_object(
        'active_now', count(*) FILTER (
          WHERE b.status IN ('confirmed','active','in_progress','checked_out')
            AND b.start_date <= now() AND b.end_date >= now()
        ),
        'pending', count(*) FILTER (WHERE b.status = 'pending'),
        'this_week', count(*) FILTER (WHERE b.created_at >= date_trunc('week', now())),
        'last_week', count(*) FILTER (
          WHERE b.created_at >= date_trunc('week', now()) - interval '7 days'
            AND b.created_at <  date_trunc('week', now())
        )
      ) FROM public.bookings b WHERE b.team_id = t.id
    ),
    'revenue_30d', (
      SELECT coalesce(sum(amount), 0) FROM public.payments
      WHERE team_id = t.id
        AND payment_status IN ('succeeded','paid','completed','captured')
        AND created_at >= now() - interval '30 days'
    ),
    'last_payment_at', (
      SELECT max(created_at) FROM public.payments
      WHERE team_id = t.id
        AND payment_status IN ('succeeded','paid','completed','captured')
    ),
    'last_login', (
      SELECT max(u.last_sign_in_at) FROM auth.users u
      JOIN public.team_members tm ON tm.user_id = u.id
      WHERE tm.team_id = t.id
    ),
    'active_users_7d', (
      SELECT count(DISTINCT u.id) FROM auth.users u
      JOIN public.team_members tm ON tm.user_id = u.id
      WHERE tm.team_id = t.id
        AND u.last_sign_in_at >= now() - interval '7 days'
    ),
    'onboarding_pct', (
      SELECT CASE
        WHEN op.completed_at IS NOT NULL THEN 100
        WHEN op.steps_completed IS NULL THEN 0
        ELSE LEAST(100, coalesce(array_length(op.steps_completed, 1), 0) * 20)
      END
      FROM public.onboarding_progress op
      WHERE op.team_id = t.id
      ORDER BY op.last_activity_at DESC NULLS LAST
      LIMIT 1
    ),
    'seat_audit_reviewed_at', t.seat_audit_reviewed_at
  )
  INTO result
  FROM public.teams t
  LEFT JOIN public.profiles p ON p.id = t.owner_id
  WHERE t.id = p_team_id;

  RETURN result;
END;
$$;

-- 5. Vehicle Audit (seat compliance)
CREATE OR REPLACE FUNCTION public.get_super_admin_vehicle_audit()
RETURNS TABLE (
  team_id uuid,
  team_name text,
  plan_tier text,
  fleet_size_cap integer,
  vehicles_in_use bigint,
  overage bigint,
  trial_end timestamptz,
  is_demo boolean,
  seat_audit_reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action('view_vehicle_audit', jsonb_build_object('at', now()));

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.assumed_plan_tier,
    t.assumed_plan_fleet_size,
    in_use.n,
    GREATEST(0, in_use.n - coalesce(t.assumed_plan_fleet_size, 0))::bigint AS overage,
    t.trial_end,
    coalesce(t.is_demo_account, false),
    t.seat_audit_reviewed_at
  FROM public.teams t
  CROSS JOIN LATERAL (
    SELECT count(*)::bigint AS n FROM public.vehicles v
    WHERE v.team_id = t.id
      AND coalesce(v.status,'') <> 'retired'
      AND v.trashed_at IS NULL
  ) in_use
  WHERE coalesce(t.is_deleted, false) = false
  ORDER BY GREATEST(0, in_use.n - coalesce(t.assumed_plan_fleet_size, 0)) DESC,
           in_use.n DESC;
END;
$$;

-- 6. Mark seat-audit reviewed
CREATE OR REPLACE FUNCTION public.mark_tenant_seat_review(p_team_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.teams
     SET seat_audit_reviewed_at = now(),
         seat_audit_reviewed_by = auth.uid()
   WHERE id = p_team_id;

  PERFORM public.log_admin_action(
    'mark_seat_review',
    jsonb_build_object('team_id', p_team_id, 'note', p_note, 'at', now())
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_super_admin_platform_pulse() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_tenant_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_tenant_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_vehicle_audit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tenant_seat_review(uuid, text) TO authenticated;
