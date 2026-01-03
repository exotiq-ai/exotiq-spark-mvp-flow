-- ============================================================================
-- SUPER ADMIN SYSTEM - Phase 1: Core Tables and Functions
-- Created: 2026-01-03
-- Purpose: Enable support team to manage customers and troubleshoot issues
-- ============================================================================

-- ============================================================================
-- Step 1: Create super_admins table
-- ============================================================================

-- Super admins table (separate from customer user_roles)
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  permissions TEXT[] DEFAULT ARRAY['view_all', 'impersonate', 'manage_billing', 'view_logs'],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT -- For tracking why this person is a super admin
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON public.super_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON public.super_admins(email);
CREATE INDEX IF NOT EXISTS idx_super_admins_is_active ON public.super_admins(is_active) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON TABLE public.super_admins IS 'Super administrators who can access all customer data for support purposes. Separate from customer role system.';
COMMENT ON COLUMN public.super_admins.permissions IS 'Array of permissions: view_all, impersonate, manage_billing, view_logs, manage_admins';
COMMENT ON COLUMN public.super_admins.is_active IS 'Inactive admins cannot access super admin features';

-- ============================================================================
-- Step 2: Enable RLS on super_admins table
-- ============================================================================

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all super admins
CREATE POLICY "super_admins_select_policy"
ON public.super_admins FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
  )
);

-- Policy: Only super admins with 'manage_admins' permission can add new admins
CREATE POLICY "super_admins_insert_policy"
ON public.super_admins FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
    AND 'manage_admins' = ANY(sa.permissions)
  )
);

-- Policy: Super admins with 'manage_admins' can update other admins
CREATE POLICY "super_admins_update_policy"
ON public.super_admins FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
    AND 'manage_admins' = ANY(sa.permissions)
  )
);

-- Policy: Super admins with 'manage_admins' can deactivate (not delete) admins
CREATE POLICY "super_admins_delete_policy"
ON public.super_admins FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
    AND 'manage_admins' = ANY(sa.permissions)
  )
);

-- ============================================================================
-- Step 3: Create audit log table
-- ============================================================================

-- Admin audit log - tracks ALL super admin actions for compliance
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'impersonate', 'view_customer', 'modify_subscription', etc.
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email TEXT,
  details JSONB DEFAULT '{}', -- Additional context (what changed, why, etc.)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action);

-- Add comments
COMMENT ON TABLE public.admin_audit_log IS 'Audit trail of all super admin actions. Required for compliance and security.';
COMMENT ON COLUMN public.admin_audit_log.action IS 'Action performed: impersonate, view_customer, modify_subscription, update_billing, etc.';
COMMENT ON COLUMN public.admin_audit_log.details IS 'JSON object with action-specific details';

-- ============================================================================
-- Step 4: Enable RLS on audit log
-- ============================================================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all audit logs
CREATE POLICY "audit_log_select_policy"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
    AND 'view_logs' = ANY(sa.permissions)
  )
);

-- Policy: Any super admin can insert audit logs (auto-logging)
CREATE POLICY "audit_log_insert_policy"
ON public.admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  admin_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.super_admins sa
    WHERE sa.user_id = auth.uid() 
    AND sa.is_active = true
  )
);

-- No UPDATE or DELETE policies - audit logs are immutable

-- ============================================================================
-- Step 5: Create helper functions
-- ============================================================================

-- Function: Check if user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = check_user_id 
    AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_super_admin IS 'Check if a user is an active super admin. Defaults to current user.';

-- Function: Check if super admin has specific permission
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
    SELECT 1 FROM public.super_admins 
    WHERE user_id = check_user_id 
    AND is_active = true
    AND permission_name = ANY(permissions)
  );
$$;

COMMENT ON FUNCTION public.super_admin_has_permission IS 'Check if super admin has a specific permission (view_all, impersonate, etc.)';

-- Function: Log admin action (called by other functions and Edge Functions)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_email TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
  admin_email TEXT;
BEGIN
  -- Verify caller is a super admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can log actions';
  END IF;

  -- Get admin email
  SELECT email INTO admin_email 
  FROM super_admins 
  WHERE user_id = auth.uid()
  AND is_active = true;
  
  IF admin_email IS NULL THEN
    RAISE EXCEPTION 'Super admin email not found';
  END IF;

  -- Insert audit log
  INSERT INTO admin_audit_log (
    admin_user_id,
    admin_email,
    action,
    target_user_id,
    target_email,
    details
  ) VALUES (
    auth.uid(),
    admin_email,
    p_action,
    p_target_user_id,
    p_target_email,
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_admin_action IS 'Log a super admin action to audit trail. Automatically captures admin info.';

-- ============================================================================
-- Step 6: Create get_my_role function for super admins
-- ============================================================================

-- Function: Get current user's role (works for both customers and super admins)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TABLE (
  role app_role,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is a super admin first
  IF public.is_super_admin(auth.uid()) THEN
    -- Return admin role for super admins
    RETURN QUERY
    SELECT 
      'admin'::app_role as role,
      ARRAY['all']::text[] as permissions;
  ELSE
    -- Return regular user role
    RETURN QUERY
    SELECT 
      ur.role,
      ur.permissions
    FROM user_roles ur
    WHERE ur.user_id = auth.uid();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_my_role IS 'Get current user role. Returns admin for super admins, regular role for customers.';

-- ============================================================================
-- Verification Queries (commented out - run manually to verify)
-- ============================================================================

-- Verify tables exist:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('super_admins', 'admin_audit_log');

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('super_admins', 'admin_audit_log');

-- Verify functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN ('is_super_admin', 'super_admin_has_permission', 'log_admin_action', 'get_my_role');

-- Test is_super_admin function (should return false before seed):
-- SELECT public.is_super_admin(auth.uid());
