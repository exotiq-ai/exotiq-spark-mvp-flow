-- Drop all existing policies on conversation_members to fix infinite recursion
DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can manage conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_policy" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_delete_policy" ON public.conversation_members;

-- Create simple, non-recursive policies for conversation_members
-- SELECT: Users can see members if they are authenticated
CREATE POLICY "conversation_members_select"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc 
    WHERE tc.id = conversation_id 
    AND (tc.is_company_wide = true OR tc.created_by = auth.uid())
  )
);

-- INSERT: Users can add members to conversations they created or company-wide
CREATE POLICY "conversation_members_insert"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_conversations tc 
    WHERE tc.id = conversation_id 
    AND (tc.created_by = auth.uid() OR tc.is_company_wide = true)
  )
);

-- UPDATE: Users can update their own membership
CREATE POLICY "conversation_members_update"
ON public.conversation_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can remove themselves or creators can remove others
CREATE POLICY "conversation_members_delete"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc 
    WHERE tc.id = conversation_id 
    AND tc.created_by = auth.uid()
  )
);