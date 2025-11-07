-- Create storage bucket for dashboard banners
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dashboard-banners', 'dashboard-banners', true);

-- Create table to store user dashboard preferences
CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_dashboard_preferences
CREATE POLICY "Users can view their own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Storage policies for dashboard-banners bucket
CREATE POLICY "Users can view dashboard banners"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'dashboard-banners');

CREATE POLICY "Users can upload their own dashboard banners"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'dashboard-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own dashboard banners"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'dashboard-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own dashboard banners"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'dashboard-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_dashboard_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_dashboard_preferences_updated_at
  BEFORE UPDATE ON public.user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dashboard_preferences_updated_at();