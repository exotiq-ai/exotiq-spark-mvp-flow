-- Create Rari Action Items table
CREATE TABLE IF NOT EXISTS public.rari_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.rari_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.rari_messages(id) ON DELETE SET NULL,
  action_text TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rari_action_items_user_id ON public.rari_action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_rari_action_items_conversation_id ON public.rari_action_items(conversation_id);
CREATE INDEX IF NOT EXISTS idx_rari_action_items_completed ON public.rari_action_items(completed);
CREATE INDEX IF NOT EXISTS idx_rari_action_items_due_date ON public.rari_action_items(due_date);

-- Enable RLS
ALTER TABLE public.rari_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own action items"
  ON public.rari_action_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own action items"
  ON public.rari_action_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own action items"
  ON public.rari_action_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own action items"
  ON public.rari_action_items FOR DELETE
  USING (auth.uid() = user_id);

-- Add tags column to conversations for categorization
ALTER TABLE public.rari_conversations 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create index on tags
CREATE INDEX IF NOT EXISTS idx_rari_conversations_tags 
ON public.rari_conversations USING GIN(tags);

COMMENT ON TABLE public.rari_action_items IS 'Action items detected from Rari conversations';
COMMENT ON COLUMN public.rari_conversations.tags IS 'Conversation category tags for analytics';
