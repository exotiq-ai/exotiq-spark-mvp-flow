-- Create storage bucket for damage claim photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('damage-photos', 'damage-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for damage-photos bucket
CREATE POLICY "Users can upload damage photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'damage-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their damage photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'damage-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their damage photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'damage-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photo_urls column to damage_claims table
ALTER TABLE damage_claims 
ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';

-- Create RARI feedback table for logging feature requests
CREATE TABLE IF NOT EXISTS rari_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'feature_request',
  keywords TEXT[],
  user_query TEXT,
  rari_response TEXT,
  context JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rari_feedback
ALTER TABLE rari_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for rari_feedback
CREATE POLICY "Users can insert own rari feedback"
ON rari_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own rari feedback"
ON rari_feedback FOR SELECT
USING (auth.uid() = user_id);