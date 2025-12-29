-- Create table for tracking user tool and feature requests
CREATE TABLE IF NOT EXISTS public.user_request_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('tool_request', 'feature_suggestion', 'help_query', 'general_feedback')),
  request_content TEXT NOT NULL,
  request_keywords TEXT[] DEFAULT '{}',
  context JSONB DEFAULT '{}',
  module_id TEXT,
  priority_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'planned', 'in_progress', 'completed', 'rejected')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ai_response TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_user_id ON public.user_request_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_request_type ON public.user_request_analytics(request_type);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_status ON public.user_request_analytics(status);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_created_at ON public.user_request_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_priority ON public.user_request_analytics(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_module_id ON public.user_request_analytics(module_id);
CREATE INDEX IF NOT EXISTS idx_user_request_analytics_keywords ON public.user_request_analytics USING GIN(request_keywords);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_request_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_request_analytics_updated_at
  BEFORE UPDATE ON public.user_request_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_user_request_analytics_updated_at();

-- Add RLS policies
ALTER TABLE public.user_request_analytics ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read own requests"
  ON public.user_request_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON public.user_request_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all requests
CREATE POLICY "Admins can read all requests"
  ON public.user_request_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admins can update all requests
CREATE POLICY "Admins can update all requests"
  ON public.user_request_analytics
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create analytics aggregation view
CREATE OR REPLACE VIEW public.user_request_analytics_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  request_type,
  module_id,
  COUNT(*) as total_requests,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(priority_score) as avg_priority,
  COUNT(CASE WHEN resolved THEN 1 END) as resolved_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM public.user_request_analytics
GROUP BY DATE_TRUNC('day', created_at), request_type, module_id;

-- Create keyword frequency view for trending topics
CREATE OR REPLACE VIEW public.user_request_keywords_trending AS
SELECT 
  keyword,
  COUNT(*) as frequency,
  request_type,
  MAX(created_at) as last_requested,
  COUNT(DISTINCT user_id) as unique_requesters
FROM public.user_request_analytics,
  UNNEST(request_keywords) as keyword
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY keyword, request_type
ORDER BY frequency DESC, last_requested DESC;

-- Add comments for documentation
COMMENT ON TABLE public.user_request_analytics IS 'Tracks user tool requests, feature suggestions, and feedback for analytics and prioritization';
COMMENT ON COLUMN public.user_request_analytics.request_type IS 'Type of request: tool_request, feature_suggestion, help_query, or general_feedback';
COMMENT ON COLUMN public.user_request_analytics.request_keywords IS 'Array of extracted keywords for pattern analysis';
COMMENT ON COLUMN public.user_request_analytics.priority_score IS 'Calculated priority score (0-100) based on frequency and user demand';
COMMENT ON COLUMN public.user_request_analytics.sentiment IS 'Sentiment analysis: positive, neutral, or negative';
