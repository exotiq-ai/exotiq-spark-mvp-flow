-- Update get_my_role() to check team_members first (new multi-tenant system)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TABLE(role app_role, permissions text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_role app_role;
BEGIN
  -- First check team_members (new multi-tenant system)
  SELECT tm.role INTO team_role
  FROM team_members tm
  WHERE tm.user_id = auth.uid()
    AND tm.is_active = true
  LIMIT 1;
  
  IF team_role IS NOT NULL THEN
    RETURN QUERY SELECT team_role, ARRAY[]::text[];
    RETURN;
  END IF;
  
  -- Fall back to legacy user_roles table
  RETURN QUERY
  SELECT ur.role, COALESCE(ur.permissions, ARRAY[]::text[]) as permissions
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  LIMIT 1;
END;
$$;