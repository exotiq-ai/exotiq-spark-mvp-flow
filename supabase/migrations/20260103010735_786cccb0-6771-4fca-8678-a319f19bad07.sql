-- Create a trigger function to auto-assign admin role to new users
-- This runs after a profile is created (which happens after auth.users insert)
CREATE OR REPLACE FUNCTION public.auto_assign_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Check if user was invited (has pending invitation with their email)
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE email = NEW.email
    AND status = 'pending'
  LIMIT 1;
  
  IF v_invitation.id IS NOT NULL THEN
    -- User was invited - role will be assigned via accept-invite flow
    -- Don't auto-assign role here, let the invitation process handle it
    RAISE NOTICE 'User % has pending invitation, skipping auto-role assignment', NEW.email;
    RETURN NEW;
  END IF;
  
  -- Check if user already has a role
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.id) THEN
    RAISE NOTICE 'User % already has a role, skipping', NEW.id;
    RETURN NEW;
  END IF;
  
  -- New signup (not invited) - make them admin of their own account
  INSERT INTO user_roles (user_id, role, permissions, assigned_by)
  VALUES (
    NEW.id,
    'admin',
    ARRAY['manage_users', 'manage_vehicles', 'manage_bookings', 'view_reports', 'manage_settings'],
    NEW.id  -- They assigned themselves (they're the account owner)
  );
  
  RAISE NOTICE 'Auto-assigned admin role to new user %', NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (fires after profile is created)
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON profiles;
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_user_role();