-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Conversation admins can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;

-- Recreate the INSERT policy without recursion
CREATE POLICY "Conversation admins can add members" ON public.conversation_members
FOR INSERT WITH CHECK (
  -- User can add themselves
  user_id = auth.uid()
  OR
  -- Creator of the conversation can add members
  EXISTS (
    SELECT 1 FROM team_conversations tc
    WHERE tc.id = conversation_members.conversation_id 
    AND tc.created_by = auth.uid()
  )
);

-- Recreate the DELETE policy without recursion  
CREATE POLICY "Admins can remove members" ON public.conversation_members
FOR DELETE USING (
  -- User can remove themselves
  user_id = auth.uid()
  OR
  -- Creator of the conversation can remove members
  EXISTS (
    SELECT 1 FROM team_conversations tc
    WHERE tc.id = conversation_members.conversation_id 
    AND tc.created_by = auth.uid()
  )
);