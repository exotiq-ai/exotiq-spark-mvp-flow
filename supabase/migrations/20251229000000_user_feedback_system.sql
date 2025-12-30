-- Enhanced User Feedback and Suggestion System
-- This migration enhances the existing rari_feedback table and adds new tables for comprehensive feedback tracking

-- Add additional columns to the existing rari_feedback table
ALTER TABLE public.rari_feedback 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'feature_request' CHECK (category IN ('feature_request', 'bug_report', 'improvement', 'question', 'other')),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS estimated_effort TEXT CHECK (estimated_effort IN ('small', 'medium', 'large', 'xlarge')),
ADD COLUMN IF NOT EXISTS target_version TEXT,
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_by TEXT,
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create table for feedback comments/updates
CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.rari_feedback(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for feedback attachments
CREATE TABLE IF NOT EXISTS public.feedback_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.rari_feedback(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for feedback upvotes
CREATE TABLE IF NOT EXISTS public.feedback_upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.rari_feedback(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

-- Create table for admin notification preferences
CREATE TABLE IF NOT EXISTS public.admin_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  email_new_feedback BOOLEAN DEFAULT true,
  email_high_priority BOOLEAN DEFAULT true,
  email_critical_priority BOOLEAN DEFAULT true,
  slack_new_feedback BOOLEAN DEFAULT true,
  slack_high_priority BOOLEAN DEFAULT true,
  slack_critical_priority BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.rari_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.rari_feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON public.rari_feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.rari_feedback;

-- RLS Policies for rari_feedback
-- All authenticated users can view feedback (for upvoting and viewing popular requests)
CREATE POLICY "Authenticated users can view all feedback"
ON public.rari_feedback
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON public.rari_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON public.rari_feedback
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id);

-- Admins can update any feedback
CREATE POLICY "Admins can update any feedback"
ON public.rari_feedback
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()::text
    AND role IN ('admin', 'manager')
  )
);

-- RLS Policies for feedback_comments
CREATE POLICY "Users can view feedback comments"
ON public.feedback_comments
FOR SELECT
TO authenticated
USING (
  NOT is_internal OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()::text
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Users can insert comments on feedback"
ON public.feedback_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Admins can update comments"
ON public.feedback_comments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()::text
    AND role IN ('admin', 'manager')
  )
);

-- RLS Policies for feedback_attachments
CREATE POLICY "Users can view feedback attachments"
ON public.feedback_attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can upload attachments to feedback"
ON public.feedback_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = uploaded_by);

-- RLS Policies for feedback_upvotes
CREATE POLICY "Users can view upvotes"
ON public.feedback_upvotes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can upvote feedback"
ON public.feedback_upvotes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can remove their upvotes"
ON public.feedback_upvotes
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- RLS Policies for admin_notification_settings
CREATE POLICY "Admins can view their own notification settings"
ON public.admin_notification_settings
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()::text
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins can manage their notification settings"
ON public.admin_notification_settings
FOR ALL
TO authenticated
USING (
  auth.uid()::text = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()::text
    AND role IN ('admin', 'manager')
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rari_feedback_user_id ON public.rari_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_rari_feedback_status ON public.rari_feedback(status);
CREATE INDEX IF NOT EXISTS idx_rari_feedback_priority ON public.rari_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_rari_feedback_category ON public.rari_feedback(category);
CREATE INDEX IF NOT EXISTS idx_rari_feedback_created_at ON public.rari_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON public.feedback_comments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_attachments_feedback_id ON public.feedback_attachments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_feedback_id ON public.feedback_upvotes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_user_id ON public.feedback_upvotes(user_id);

-- Create function to update upvote count
CREATE OR REPLACE FUNCTION update_feedback_upvotes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.rari_feedback
    SET upvotes = upvotes + 1
    WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rari_feedback
    SET upvotes = upvotes - 1
    WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for upvote count
DROP TRIGGER IF EXISTS trigger_update_feedback_upvotes ON public.feedback_upvotes;
CREATE TRIGGER trigger_update_feedback_upvotes
AFTER INSERT OR DELETE ON public.feedback_upvotes
FOR EACH ROW
EXECUTE FUNCTION update_feedback_upvotes();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on rari_feedback
DROP TRIGGER IF EXISTS trigger_update_feedback_timestamp ON public.rari_feedback;
CREATE TRIGGER trigger_update_feedback_timestamp
BEFORE UPDATE ON public.rari_feedback
FOR EACH ROW
EXECUTE FUNCTION update_feedback_updated_at();

-- Create trigger for updated_at on feedback_comments
DROP TRIGGER IF EXISTS trigger_update_feedback_comments_timestamp ON public.feedback_comments;
CREATE TRIGGER trigger_update_feedback_comments_timestamp
BEFORE UPDATE ON public.feedback_comments
FOR EACH ROW
EXECUTE FUNCTION update_feedback_updated_at();

-- Create trigger for updated_at on admin_notification_settings
DROP TRIGGER IF EXISTS trigger_update_admin_settings_timestamp ON public.admin_notification_settings;
CREATE TRIGGER trigger_update_admin_settings_timestamp
BEFORE UPDATE ON public.admin_notification_settings
FOR EACH ROW
EXECUTE FUNCTION update_feedback_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.rari_feedback IS 'Stores user feedback, feature requests, and suggestions with enhanced tracking';
COMMENT ON TABLE public.feedback_comments IS 'Comments and updates on feedback items';
COMMENT ON TABLE public.feedback_attachments IS 'File attachments for feedback items';
COMMENT ON TABLE public.feedback_upvotes IS 'User upvotes for feedback items';
COMMENT ON TABLE public.admin_notification_settings IS 'Admin notification preferences for feedback alerts';
