
-- Drop existing tc_select policy and recreate with team scoping for company-wide conversations
DROP POLICY IF EXISTS "tc_select" ON public.team_conversations;

CREATE POLICY "tc_select" ON public.team_conversations
FOR SELECT TO authenticated
USING (
  -- User is the creator
  auth.uid() = created_by
  -- User is a member of the conversation
  OR public.is_conversation_member(id, auth.uid())
  -- Company-wide conversations scoped to user's team
  OR (
    is_company_wide = true 
    AND team_id IS NOT NULL 
    AND public.is_team_member(auth.uid(), team_id)
  )
);
