-- ============================================================================
-- SEED FIRST SUPER ADMIN - Auto-assign first user as super admin
-- Created: 2026-01-03
-- Purpose: Automatically make the first user who signs up a super admin
-- ============================================================================

-- ============================================================================
-- Option 1: Manual Seed (if you know your email)
-- ============================================================================

-- UNCOMMENT AND UPDATE WITH YOUR EMAIL:
-- INSERT INTO public.super_admins (user_id, email, full_name, permissions, notes)
-- SELECT 
--   id,
--   email,
--   raw_user_meta_data->>'full_name',
--   ARRAY['view_all', 'impersonate', 'manage_billing', 'view_logs', 'manage_admins'],
--   'First super admin - auto-seeded'
-- FROM auth.users
-- WHERE email = 'your-email@example.com'  -- CHANGE THIS TO YOUR EMAIL
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Option 2: Automatic Trigger (makes first user super admin)
-- ============================================================================

-- Function to auto-assign first user as super admin
CREATE OR REPLACE FUNCTION public.auto_assign_first_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the very first user AND no super admins exist yet
  IF NOT EXISTS (SELECT 1 FROM public.super_admins LIMIT 1) THEN
    -- Make this user a super admin with all permissions
    INSERT INTO public.super_admins (
      user_id,
      email,
      full_name,
      permissions,
      notes
    ) VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      ARRAY['view_all', 'impersonate', 'manage_billing', 'view_logs', 'manage_admins'],
      'First user - auto-assigned super admin'
    );
    
    RAISE NOTICE 'First user % has been assigned super admin privileges', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run on new user signup
DROP TRIGGER IF EXISTS on_first_user_make_super_admin ON auth.users;
CREATE TRIGGER on_first_user_make_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_assign_first_super_admin();

COMMENT ON FUNCTION public.auto_assign_first_super_admin IS 'Automatically assigns the first user to sign up as a super admin';

-- ============================================================================
-- Verification
-- ============================================================================

-- After creating your first account, verify super admin was assigned:
-- SELECT 
--   sa.email,
--   sa.permissions,
--   sa.created_at,
--   sa.notes
-- FROM public.super_admins sa
-- ORDER BY sa.created_at ASC;

-- Test the is_super_admin function (run after logging in):
-- SELECT public.is_super_admin(auth.uid());
