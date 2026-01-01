-- Drop remaining conflicting policies
DROP POLICY IF EXISTS "Users can update own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can delete membership" ON public.conversation_members;

-- Recreate them
CREATE POLICY "Users can update own membership"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete membership"
ON public.conversation_members
FOR DELETE
USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);