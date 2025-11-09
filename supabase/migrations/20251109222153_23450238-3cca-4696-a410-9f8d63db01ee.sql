-- Create table for user dashboard layouts
CREATE TABLE IF NOT EXISTS public.user_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  visible_widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Policies for user_dashboard_layouts
CREATE POLICY "Users can view their own dashboard layout"
  ON public.user_dashboard_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard layout"
  ON public.user_dashboard_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard layout"
  ON public.user_dashboard_layouts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_user_dashboard_layouts_user_id ON public.user_dashboard_layouts(user_id);