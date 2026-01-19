-- Add indexes for faster team membership lookups (improves RLS performance)
CREATE INDEX IF NOT EXISTS idx_team_members_user_team 
ON team_members(user_id, team_id);

-- Add index for role lookups
CREATE INDEX IF NOT EXISTS idx_team_members_role 
ON team_members(user_id, role);