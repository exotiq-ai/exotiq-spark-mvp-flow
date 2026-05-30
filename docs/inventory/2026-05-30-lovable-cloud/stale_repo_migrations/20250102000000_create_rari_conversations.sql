-- Create Rari Conversations table
CREATE TABLE IF NOT EXISTS public.rari_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  message_count INTEGER DEFAULT 0,
  entities_detected JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Rari Messages table
CREATE TABLE IF NOT EXISTS public.rari_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.rari_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  entities JSONB DEFAULT '[]'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rari_conversations_user_id ON public.rari_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_rari_conversations_started_at ON public.rari_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rari_conversations_session_id ON public.rari_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_rari_messages_conversation_id ON public.rari_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rari_messages_timestamp ON public.rari_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rari_messages_entities ON public.rari_messages USING GIN(entities);

-- Enable Row Level Security
ALTER TABLE public.rari_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rari_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rari_conversations
CREATE POLICY "Users view own conversations"
  ON public.rari_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON public.rari_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.rari_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON public.rari_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for rari_messages
CREATE POLICY "Users view own messages"
  ON public.rari_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.rari_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own messages"
  ON public.rari_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.rari_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own messages"
  ON public.rari_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.rari_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete own messages"
  ON public.rari_messages FOR DELETE
  USING (
    conversation_id IN (
      SELECT id FROM public.rari_conversations WHERE user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE public.rari_conversations IS 'Stores Rari AI assistant conversation sessions';
COMMENT ON TABLE public.rari_messages IS 'Stores individual messages within Rari conversations';
