-- Auto-assign default role to new users
-- This prevents new users from showing "View Only Mode" badge

-- Create function to automatically assign role when a new user signs up
CREATE OR REPLACE FUNCTION public.assign_default_role_to_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first user in the system
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    -- First user becomes admin with all permissions
    INSERT INTO public.user_roles (user_id, role, permissions, assigned_at)
    VALUES (NEW.id, 'admin', ARRAY['all'], NOW());
  ELSE
    -- Subsequent users get 'operator' role by default
    -- Operators can manage bookings and fleet but not users or billing
    INSERT INTO public.user_roles (user_id, role, permissions, assigned_at)
    VALUES (NEW.id, 'operator', ARRAY[]::text[], NOW());
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to assign role to new user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign role when user is created
DROP TRIGGER IF EXISTS on_new_user_assign_role ON auth.users;
CREATE TRIGGER on_new_user_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role_to_new_user();

-- Backfill existing users without roles (assign them as operators)
INSERT INTO public.user_roles (user_id, role, permissions, assigned_at)
SELECT 
  u.id,
  'operator'::public.app_role,
  ARRAY[]::text[],
  NOW()
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;
