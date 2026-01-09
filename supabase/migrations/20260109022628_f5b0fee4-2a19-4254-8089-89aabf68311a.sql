-- Rari Conversations table for storing voice conversation sessions
CREATE TABLE public.rari_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  context_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rari Messages table for storing individual messages
CREATE TABLE public.rari_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.rari_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  entities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_rari_conversations_user_id ON public.rari_conversations(user_id);
CREATE INDEX idx_rari_conversations_session_id ON public.rari_conversations(session_id);
CREATE INDEX idx_rari_messages_conversation_id ON public.rari_messages(conversation_id);

-- Enable RLS
ALTER TABLE public.rari_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rari_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rari_conversations
CREATE POLICY "Users can view own conversations" 
ON public.rari_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" 
ON public.rari_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" 
ON public.rari_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" 
ON public.rari_conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for rari_messages
CREATE POLICY "Users can view own messages" 
ON public.rari_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.rari_conversations 
    WHERE id = rari_messages.conversation_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own messages" 
ON public.rari_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rari_conversations 
    WHERE id = rari_messages.conversation_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own messages" 
ON public.rari_messages 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.rari_conversations 
    WHERE id = rari_messages.conversation_id 
    AND user_id = auth.uid()
  )
);