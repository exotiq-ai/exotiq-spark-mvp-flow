-- Add team_id column to user_invitations table
ALTER TABLE public.user_invitations 
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

-- Create unique index to enforce one active team membership per user
CREATE UNIQUE INDEX IF NOT EXISTS one_active_team_per_user 
ON public.team_members(user_id) 
WHERE is_active = true;

-- Add index for faster lookups on user_invitations
CREATE INDEX IF NOT EXISTS idx_user_invitations_team_id 
ON public.user_invitations(team_id);