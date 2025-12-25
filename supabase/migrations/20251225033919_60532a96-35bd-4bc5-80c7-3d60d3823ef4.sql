-- Create function to check if this is the last admin
CREATE OR REPLACE FUNCTION public.count_admins()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.user_roles WHERE role = 'admin'
$$;

-- Create trigger function to prevent self-demotion and last admin removal
CREATE OR REPLACE FUNCTION public.prevent_admin_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Check if this is an UPDATE that changes role from admin to something else
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
    -- Prevent self-demotion
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot remove your own admin role';
    END IF;
    
    -- Count remaining admins after this change
    SELECT COUNT(*) INTO admin_count 
    FROM public.user_roles 
    WHERE role = 'admin' AND user_id != OLD.user_id;
    
    IF admin_count < 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin. At least one admin must exist.';
    END IF;
  END IF;
  
  -- Check if this is a DELETE of an admin role
  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    -- Prevent self-deletion of admin role
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot delete your own admin role';
    END IF;
    
    -- Count remaining admins after this delete
    SELECT COUNT(*) INTO admin_count 
    FROM public.user_roles 
    WHERE role = 'admin' AND user_id != OLD.user_id;
    
    IF admin_count < 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin. At least one admin must exist.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_admin_demotion_trigger ON public.user_roles;
CREATE TRIGGER prevent_admin_demotion_trigger
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_demotion();