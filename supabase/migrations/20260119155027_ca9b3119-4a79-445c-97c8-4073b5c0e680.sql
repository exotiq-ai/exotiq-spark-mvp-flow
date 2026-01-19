-- Fix user_presence RLS: Replace overly permissive "Anyone can view presence" policy
-- with team-scoped authenticated policy

-- Drop the insecure policy that allows anyone to view all presence
DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;

-- Create new policy: Users can only view presence of teammates
-- This requires authentication and team membership check
CREATE POLICY "Users can view team presence"
ON public.user_presence
FOR SELECT
TO authenticated
USING (
  -- User can always see their own presence
  auth.uid() = user_id
  OR
  -- User can see presence of users in same team
  EXISTS (
    SELECT 1 FROM public.team_members tm1
    WHERE tm1.user_id = auth.uid()
    AND tm1.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.team_members tm2
      WHERE tm2.user_id = user_presence.user_id
      AND tm2.team_id = tm1.team_id
      AND tm2.is_active = true
    )
  )
);