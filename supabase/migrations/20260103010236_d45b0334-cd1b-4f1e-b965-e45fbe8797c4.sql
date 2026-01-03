-- Create super_admins table
CREATE TABLE IF NOT EXISTS public.super_admins (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can read this table (via service role)
-- No public access needed

-- Insert gregory@exotiq.ai as super admin
INSERT INTO public.super_admins (email, notes) 
VALUES ('gregory@exotiq.ai', 'Platform founder - full super admin access')
ON CONFLICT (email) DO NOTHING;

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM super_admins sa
    JOIN profiles p ON LOWER(p.email) = LOWER(sa.email)
    WHERE p.id = check_user_id
  )
$$;

-- Create log_admin_action function for audit logging
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_user_email text;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email FROM profiles WHERE id = auth.uid();
  
  -- Log to role_audit_log (reusing existing table)
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
      'details', p_details,
      'timestamp', now()
    )
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;