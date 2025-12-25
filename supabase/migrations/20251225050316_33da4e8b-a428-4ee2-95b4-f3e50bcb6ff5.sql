-- Add read_at field for read receipts and is_typing for typing indicators
-- Also add index for better performance on message queries

-- Add index for message pagination performance
CREATE INDEX IF NOT EXISTS idx_team_messages_conversation_created 
ON public.team_messages (conversation_id, created_at DESC);

-- Add index for unread count performance
CREATE INDEX IF NOT EXISTS idx_team_messages_created_at 
ON public.team_messages (created_at);

-- Add index for conversation members
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id 
ON public.conversation_members (user_id);

-- Create a table for tracking who has read each message (read receipts)
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for read receipts
CREATE POLICY "Users can view read receipts for messages in their conversations"
ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_messages tm
    JOIN public.conversation_members cm ON cm.conversation_id = tm.conversation_id
    WHERE tm.id = message_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own read receipts"
ON public.message_read_receipts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create presence table for online/offline status and typing indicators
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID NOT NULL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  typing_in_conversation UUID REFERENCES public.team_conversations(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for presence
CREATE POLICY "Anyone can view presence"
ON public.user_presence
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create table for pinned messages
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, message_id)
);

-- Enable RLS
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for pinned messages
CREATE POLICY "Users can view pinned messages in their conversations"
ON public.pinned_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = pinned_messages.conversation_id AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc
    WHERE tc.id = pinned_messages.conversation_id AND tc.is_company_wide = true
  )
);

CREATE POLICY "Users can pin messages in their conversations"
ON public.pinned_messages
FOR INSERT
WITH CHECK (
  auth.uid() = pinned_by AND
  (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = pinned_messages.conversation_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.team_conversations tc
      WHERE tc.id = pinned_messages.conversation_id AND tc.is_company_wide = true
    )
  )
);

CREATE POLICY "Users can unpin messages in their conversations"
ON public.pinned_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = pinned_messages.conversation_id AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc
    WHERE tc.id = pinned_messages.conversation_id AND tc.is_company_wide = true
  )
);

-- Enable realtime for presence and read receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;