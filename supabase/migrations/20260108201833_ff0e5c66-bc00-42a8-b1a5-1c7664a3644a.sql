-- Create rari_insights table for AI-generated proactive insights
CREATE TABLE public.rari_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pricing', 'utilization', 'maintenance', 'revenue', 'customer', 'compliance', 'booking')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items JSONB DEFAULT '[]'::jsonb,
  related_entity_type TEXT,
  related_entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rari_insights ENABLE ROW LEVEL SECURITY;

-- Users can view their own insights or team insights
CREATE POLICY "Users can view own insights" ON public.rari_insights
  FOR SELECT USING (
    auth.uid() = user_id OR 
    (team_id IS NOT NULL AND is_team_member(auth.uid(), team_id))
  );

-- Users can update their own insights (mark as read/dismissed)
CREATE POLICY "Users can update own insights" ON public.rari_insights
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System/edge functions can insert insights
CREATE POLICY "Service role can insert insights" ON public.rari_insights
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_rari_insights_user_id ON public.rari_insights(user_id);
CREATE INDEX idx_rari_insights_team_id ON public.rari_insights(team_id);
CREATE INDEX idx_rari_insights_priority ON public.rari_insights(priority);
CREATE INDEX idx_rari_insights_unread ON public.rari_insights(user_id, is_read, is_dismissed) WHERE is_read = false AND is_dismissed = false;

-- Add updated_at trigger
CREATE TRIGGER update_rari_insights_updated_at
  BEFORE UPDATE ON public.rari_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rari_insights;