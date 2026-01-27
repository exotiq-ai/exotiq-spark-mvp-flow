-- Fix recursive RLS on team_members: create non-recursive helper functions

-- Create helper: is current user a member of this team? (no param for target user)
CREATE OR REPLACE FUNCTION public.is_my_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = auth.uid()
      AND team_id = p_team_id
      AND is_active = true
  )
$$;

-- Create helper: is current user an admin/owner of this team?
CREATE OR REPLACE FUNCTION public.is_my_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = auth.uid()
      AND team_id = p_team_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
$$;

-- Drop the problematic recursive SELECT policy
DROP POLICY IF EXISTS "Team members can view team roster" ON public.team_members;

-- Create non-recursive SELECT policy:
-- 1. Users can always read their OWN membership row (auth.uid() = user_id) 
-- 2. Team admins/owners can view all members of their team (via is_my_team_admin)
-- 3. Super admins can view all
CREATE POLICY "Users can view own and team memberships"
ON public.team_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_my_team_admin(team_id)
  OR is_super_admin(auth.uid())
);