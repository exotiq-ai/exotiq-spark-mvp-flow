-- Allow admins to view all profiles for user management
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view own or admin can view all profiles" 
ON profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- Create function to get current user's role (for frontend)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TABLE (role app_role, permissions text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, permissions 
  FROM public.user_roles 
  WHERE user_id = auth.uid()
  LIMIT 1
$$;