-- Update vehicle_inspections RLS policies to use team-based access
DROP POLICY IF EXISTS "Users can view own inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Users can insert own inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Users can update own inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Users can delete own inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Team members can view team inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Team members can insert team inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Team members can update team inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Team admins can delete team inspections" ON public.vehicle_inspections;

-- Team members can view all team inspections
CREATE POLICY "Team members can view team inspections" 
ON public.vehicle_inspections 
FOR SELECT 
USING (
  auth.uid() = user_id
  OR is_team_member_of_record(auth.uid(), team_id)
);

-- Team members can insert inspections for their team
CREATE POLICY "Team members can insert team inspections" 
ON public.vehicle_inspections 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
  AND (team_id IS NULL OR is_team_member_of_record(auth.uid(), team_id))
);

-- Team members can update team inspections
CREATE POLICY "Team members can update team inspections" 
ON public.vehicle_inspections 
FOR UPDATE 
USING (
  auth.uid() = user_id
  OR is_team_member_of_record(auth.uid(), team_id)
);

-- Team admins can delete team inspections, users can delete their own
CREATE POLICY "Team admins can delete team inspections" 
ON public.vehicle_inspections 
FOR DELETE 
USING (
  auth.uid() = user_id
  OR is_team_admin(auth.uid(), team_id)
);

-- Update customer_notes RLS policies to use team-based access via customer's team_id
DROP POLICY IF EXISTS "Users can view own customer notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Users can insert own customer notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Users can update own customer notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Users can delete own customer notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Team members can view team customer notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Team members can insert team customer notes" ON public.customer_notes;

-- Team members can view notes for customers in their team
CREATE POLICY "Team members can view team customer notes" 
ON public.customer_notes 
FOR SELECT 
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_notes.customer_id 
    AND is_team_member_of_record(auth.uid(), c.team_id)
  )
);

-- Team members can insert notes for team customers
CREATE POLICY "Team members can insert team customer notes" 
ON public.customer_notes 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_notes.customer_id 
    AND (c.user_id = auth.uid() OR is_team_member_of_record(auth.uid(), c.team_id))
  )
);

-- Users can update their own notes
CREATE POLICY "Users can update own customer notes" 
ON public.customer_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete own customer notes" 
ON public.customer_notes 
FOR DELETE 
USING (auth.uid() = user_id);