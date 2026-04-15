-- Add team_id column
ALTER TABLE public.role_audit_log
ADD COLUMN team_id UUID REFERENCES public.teams(id);

-- Backfill existing rows
UPDATE public.role_audit_log ral
SET team_id = (
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE tm.user_id = ral.changed_by AND tm.is_active = true
  LIMIT 1
);

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.role_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.role_audit_log;

-- New SELECT policy scoped to team
CREATE POLICY "Team members can view own audit logs"
ON public.role_audit_log FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT tm.team_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.is_active = true
  )
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid())
);

-- New INSERT policy scoped to team
CREATE POLICY "Team members can insert audit logs"
ON public.role_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  team_id IN (
    SELECT tm.team_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.is_active = true
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);