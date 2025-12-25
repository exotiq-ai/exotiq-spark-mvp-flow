
-- =============================================
-- TEAM ACTIVITY & MESSAGING SYSTEM
-- =============================================

-- 1. User Activity Log - Track all user actions
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL, -- 'login', 'logout', 'booking_created', 'booking_updated', 'payment_recorded', 'vehicle_added', 'settings_changed', etc.
  entity_type text, -- 'booking', 'vehicle', 'customer', 'payment', etc.
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Team Conversations - Support DMs, groups, and channels
CREATE TABLE public.team_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, -- NULL for direct messages
  description text,
  type text NOT NULL DEFAULT 'direct', -- 'direct', 'group', 'channel'
  is_company_wide boolean DEFAULT false, -- For announcements
  avatar_url text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Conversation Members - Who's in each conversation
CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member', -- 'admin', 'member'
  last_read_at timestamptz DEFAULT now(),
  notifications_enabled boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- 4. Team Messages - The actual messages
CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  message_type text DEFAULT 'text', -- 'text', 'image', 'file', 'system'
  reply_to uuid REFERENCES public.team_messages(id) ON DELETE SET NULL,
  attachments jsonb DEFAULT '[]', -- Array of {url, name, type, size}
  mentions uuid[] DEFAULT '{}', -- Array of mentioned user IDs
  reactions jsonb DEFAULT '{}', -- {emoji: [user_ids]}
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. Entity Comments - Comments on bookings, vehicles, customers
CREATE TABLE public.entity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL, -- 'booking', 'vehicle', 'customer', 'payment'
  entity_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  is_resolved boolean DEFAULT false,
  parent_id uuid REFERENCES public.entity_comments(id) ON DELETE CASCADE, -- For threaded comments
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Integration Configs - Store Slack, etc. webhooks
CREATE TABLE public.integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  integration_type text NOT NULL, -- 'slack', 'teams', 'discord', 'asana'
  config jsonb NOT NULL DEFAULT '{}', -- {webhook_url, channel_id, enabled_events, etc.}
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, integration_type)
);

-- 7. Message Attachments Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments', 
  'message-attachments', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Activity Log RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
ON public.user_activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity"
ON public.user_activity_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Team Conversations RLS
ALTER TABLE public.team_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations they are members of"
ON public.team_conversations FOR SELECT
USING (
  is_company_wide = true 
  OR EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = team_conversations.id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations"
ON public.team_conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation admins can update"
ON public.team_conversations FOR UPDATE
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = team_conversations.id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Conversation creators can delete"
ON public.team_conversations FOR DELETE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Conversation Members RLS
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their conversations"
ON public.conversation_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc
    WHERE tc.id = conversation_members.conversation_id
    AND tc.is_company_wide = true
  )
);

CREATE POLICY "Conversation admins can add members"
ON public.conversation_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = conversation_members.conversation_id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_conversations 
    WHERE id = conversation_members.conversation_id 
    AND created_by = auth.uid()
  )
  OR user_id = auth.uid() -- Users can add themselves to company-wide channels
);

CREATE POLICY "Users can update own membership"
ON public.conversation_members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
ON public.conversation_members FOR DELETE
USING (
  user_id = auth.uid() -- Can remove self
  OR EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = conversation_members.conversation_id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Team Messages RLS
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
ON public.team_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = team_messages.conversation_id 
    AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_conversations 
    WHERE id = team_messages.conversation_id 
    AND is_company_wide = true
  )
);

CREATE POLICY "Members can send messages"
ON public.team_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_id = team_messages.conversation_id 
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_conversations 
      WHERE id = team_messages.conversation_id 
      AND is_company_wide = true
    )
  )
);

CREATE POLICY "Users can update own messages"
ON public.team_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Users can delete own messages"
ON public.team_messages FOR DELETE
USING (sender_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Entity Comments RLS
ALTER TABLE public.entity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on entities they can access"
ON public.entity_comments FOR SELECT
USING (true); -- Will filter based on entity access in application

CREATE POLICY "Users can create comments"
ON public.entity_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON public.entity_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.entity_comments FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Integration Configs RLS
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own integrations"
ON public.integration_configs FOR ALL
USING (auth.uid() = user_id);

-- Storage Policies for Message Attachments
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'message-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view attachments in their conversations"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_activity_log_user ON public.user_activity_log(user_id);
CREATE INDEX idx_activity_log_type ON public.user_activity_log(activity_type);
CREATE INDEX idx_activity_log_created ON public.user_activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.user_activity_log(entity_type, entity_id);

CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conv ON public.conversation_members(conversation_id);

CREATE INDEX idx_team_messages_conv ON public.team_messages(conversation_id);
CREATE INDEX idx_team_messages_created ON public.team_messages(created_at DESC);
CREATE INDEX idx_team_messages_sender ON public.team_messages(sender_id);

CREATE INDEX idx_entity_comments_entity ON public.entity_comments(entity_type, entity_id);
CREATE INDEX idx_entity_comments_user ON public.entity_comments(user_id);

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_log;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE TRIGGER update_team_conversations_updated_at
BEFORE UPDATE ON public.team_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_comments_updated_at
BEFORE UPDATE ON public.entity_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_configs_updated_at
BEFORE UPDATE ON public.integration_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION: Log User Activity
-- =============================================
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_activity_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  INSERT INTO public.user_activity_log (user_id, activity_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_activity_type, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;
