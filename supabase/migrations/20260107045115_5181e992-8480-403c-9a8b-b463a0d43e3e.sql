-- Fix RLS infinite recursion by using SECURITY DEFINER functions

-- 1. Create a function to check if user is a member of a conversation (without triggering RLS)
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  );
$$;

-- 2. Create a function to check if user created a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_creator(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_conversations
    WHERE id = p_conversation_id AND created_by = p_user_id
  );
$$;

-- 3. Create a function to check if conversation is company-wide
CREATE OR REPLACE FUNCTION public.is_company_wide_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_company_wide FROM team_conversations WHERE id = p_conversation_id),
    false
  );
$$;

-- 4. Drop existing problematic policies on conversation_members
DROP POLICY IF EXISTS "conversation_members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_update" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_delete" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
DROP POLICY IF EXISTS "Conversation admins can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can delete membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.conversation_members;

-- 5. Drop existing problematic policies on team_conversations
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.team_conversations;
DROP POLICY IF EXISTS "Conversation admins can update" ON public.team_conversations;

-- 6. Create new non-recursive policies for conversation_members
CREATE POLICY "cm_select" ON public.conversation_members
FOR SELECT USING (
  user_id = auth.uid() 
  OR is_conversation_creator(conversation_id, auth.uid())
  OR is_company_wide_conversation(conversation_id)
);

CREATE POLICY "cm_insert" ON public.conversation_members
FOR INSERT WITH CHECK (
  user_id = auth.uid() 
  OR is_conversation_creator(conversation_id, auth.uid())
  OR is_company_wide_conversation(conversation_id)
);

CREATE POLICY "cm_update" ON public.conversation_members
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "cm_delete" ON public.conversation_members
FOR DELETE USING (
  user_id = auth.uid() 
  OR is_conversation_creator(conversation_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 7. Create new non-recursive policies for team_conversations
CREATE POLICY "tc_select" ON public.team_conversations
FOR SELECT USING (
  is_company_wide = true 
  OR created_by = auth.uid()
  OR is_conversation_member(id, auth.uid())
);

CREATE POLICY "tc_update" ON public.team_conversations
FOR UPDATE USING (
  created_by = auth.uid()
);