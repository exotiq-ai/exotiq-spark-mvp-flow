-- Add is_demo_account column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_demo_account BOOLEAN DEFAULT false;

-- Set demo account for hello@exotiq.ai team
UPDATE teams 
SET is_demo_account = true 
WHERE id = (
  SELECT tm.team_id 
  FROM team_members tm
  JOIN profiles p ON p.id = tm.user_id
  WHERE LOWER(p.email) = 'hello@exotiq.ai'
  AND tm.is_active = true
  LIMIT 1
);