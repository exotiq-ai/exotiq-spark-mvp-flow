-- Phase 3: Enhanced Onboarding - Database Foundation

-- 1. Create onboarding_progress table for cross-device state persistence
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  
  -- Step tracking
  current_step INTEGER NOT NULL DEFAULT 1,
  steps_completed INTEGER[] DEFAULT '{}',
  
  -- Form data persisted between sessions
  form_data JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  source TEXT DEFAULT 'web',
  referral_code TEXT,
  onboarding_type TEXT DEFAULT 'owner',
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own progress
CREATE POLICY "Users can manage own onboarding progress"
  ON public.onboarding_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Enhance import_batches for recovery features
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS column_mappings JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS failed_rows JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS original_file_url TEXT,
  ADD COLUMN IF NOT EXISTS can_retry BOOLEAN DEFAULT false;

-- 3. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id 
  ON public.onboarding_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_import_batches_team_created 
  ON public.import_batches(team_id, created_at DESC);

-- 4. Update function for last_activity tracking
CREATE OR REPLACE FUNCTION public.update_onboarding_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_onboarding_progress_activity
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_activity();