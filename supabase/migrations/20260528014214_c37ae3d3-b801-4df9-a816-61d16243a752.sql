ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['view_all', 'manage_billing', 'view_logs'],
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE public.super_admins sa
SET user_id = p.id,
    full_name = COALESCE(sa.full_name, p.full_name),
    permissions = COALESCE(sa.permissions, ARRAY['view_all', 'manage_billing', 'view_logs']),
    is_active = COALESCE(sa.is_active, true)
FROM public.profiles p
WHERE lower(p.email) = lower(sa.email)
  AND sa.user_id IS NULL;

UPDATE public.super_admins
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.super_admins
SET permissions = ARRAY['view_all', 'manage_billing', 'view_logs'],
    is_active = true
WHERE permissions IS NULL OR is_active IS NULL;

ALTER TABLE public.super_admins
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN permissions SET DEFAULT ARRAY['view_all', 'manage_billing', 'view_logs'],
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'super_admins_pkey'
      AND conrelid = 'public.super_admins'::regclass
  ) THEN
    ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'super_admins_user_id_key'
      AND conrelid = 'public.super_admins'::regclass
  ) THEN
    ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON public.super_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON public.super_admins(lower(email));
CREATE INDEX IF NOT EXISTS idx_super_admins_is_active ON public.super_admins(is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE COALESCE(sa.is_active, true) = true
      AND (
        sa.user_id = check_user_id
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = check_user_id
            AND lower(p.email) = lower(sa.email)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.super_admin_has_permission(
  permission_name TEXT,
  check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE COALESCE(sa.is_active, true) = true
      AND permission_name = ANY(COALESCE(sa.permissions, ARRAY[]::TEXT[]))
      AND (
        sa.user_id = check_user_id
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = check_user_id
            AND lower(p.email) = lower(sa.email)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS TABLE(
  total_customers BIGINT,
  new_this_week BIGINT,
  total_vehicles BIGINT,
  total_bookings BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT p.id) FILTER (WHERE public.is_super_admin(auth.uid())) AS total_customers,
    COUNT(DISTINCT p.id) FILTER (WHERE public.is_super_admin(auth.uid()) AND p.created_at >= now() - interval '7 days') AS new_this_week,
    COUNT(DISTINCT v.id) FILTER (WHERE public.is_super_admin(auth.uid())) AS total_vehicles,
    COUNT(DISTINCT b.id) FILTER (WHERE public.is_super_admin(auth.uid())) AS total_bookings
  FROM public.profiles p
  FULL JOIN public.vehicles v ON false
  FULL JOIN public.bookings b ON false;
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_customers()
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    COALESCE(tm.role::TEXT, ur.role::TEXT, 'viewer') AS role
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT role
    FROM public.team_members
    WHERE user_id = p.id AND is_active = true
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1
  ) tm ON true
  LEFT JOIN LATERAL (
    SELECT role
    FROM public.user_roles
    WHERE user_id = p.id
    LIMIT 1
  ) ur ON true
  WHERE public.is_super_admin(auth.uid())
  ORDER BY p.created_at DESC NULLS LAST
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_billing_tenants()
RETURNS TABLE(
  id UUID,
  name TEXT,
  owner_email TEXT,
  billing_dunning_stage TEXT,
  billing_dunning_set_at TIMESTAMPTZ,
  billing_dunning_message TEXT,
  billing_dunning_notes TEXT,
  assumed_plan_tier TEXT,
  assumed_plan_fleet_size INTEGER,
  assumed_plan_is_annual BOOLEAN,
  is_demo_account BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    p.email AS owner_email,
    t.billing_dunning_stage,
    t.billing_dunning_set_at,
    t.billing_dunning_message,
    t.billing_dunning_notes,
    t.assumed_plan_tier,
    t.assumed_plan_fleet_size,
    t.assumed_plan_is_annual,
    t.is_demo_account
  FROM public.teams t
  LEFT JOIN public.profiles p ON p.id = t.owner_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.name ASC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_audit_logs()
RETURNS TABLE(
  id UUID,
  action TEXT,
  user_id UUID,
  changed_by UUID,
  created_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ral.id,
    ral.action,
    ral.user_id,
    ral.changed_by,
    ral.created_at,
    ral.metadata
  FROM public.role_audit_log ral
  WHERE public.is_super_admin(auth.uid())
  ORDER BY ral.created_at DESC NULLS LAST
  LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(p_action TEXT, p_details JSONB DEFAULT '{}'::JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can log admin actions';
  END IF;

  SELECT email INTO v_user_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.role_audit_log (
    user_id,
    changed_by,
    action,
    metadata
  ) VALUES (
    auth.uid(),
    auth.uid(),
    p_action,
    jsonb_build_object(
      'admin_email', v_user_email,
      'details', COALESCE(p_details, '{}'::JSONB),
      'timestamp', now()
    )
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_has_permission(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_billing_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, JSONB) TO authenticated;