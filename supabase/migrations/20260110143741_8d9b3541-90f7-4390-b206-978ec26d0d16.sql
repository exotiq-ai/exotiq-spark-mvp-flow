-- Add is_active column to team_members if it doesn't exist
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;