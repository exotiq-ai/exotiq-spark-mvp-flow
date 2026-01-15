-- Phase 1: Create user_settings table for persisting all settings
-- This table stores settings for AI, Team, and System configurations

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('ai', 'team', 'system')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings
CREATE POLICY "Users can read own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own settings"
ON public.user_settings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Also create data_backups table for Phase 4 (Data Management)
CREATE TABLE public.data_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  backup_name TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'automatic')),
  file_size_bytes BIGINT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on data_backups
ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

-- Users can read their own backups
CREATE POLICY "Users can read own backups"
ON public.data_backups
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own backups
CREATE POLICY "Users can create own backups"
ON public.data_backups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);