-- Add ops_status to vehicles for operational readiness tracking
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS ops_status text DEFAULT 'clean_ready' 
CHECK (ops_status IN ('pending_inspection', 'needs_wash', 'washing', 'needs_fuel', 'clean_ready', 'check_out_ready', 'renter_has', 'check_in_required'));

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS last_ops_update timestamp with time zone DEFAULT now();

-- Create vehicle_tasks table for ticketing/assignments
CREATE TABLE IF NOT EXISTS public.vehicle_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    task_type text NOT NULL CHECK (task_type IN ('wash', 'fuel', 'inspection', 'maintenance', 'check_in', 'check_out', 'detail', 'repair', 'other')),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    title text NOT NULL,
    notes text,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on vehicle_tasks
ALTER TABLE public.vehicle_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle_tasks
-- Team members can view tasks for their team
CREATE POLICY "Team members can view team tasks"
ON public.vehicle_tasks
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

-- Team members can create tasks for their team
CREATE POLICY "Team members can create tasks"
ON public.vehicle_tasks
FOR INSERT
TO authenticated
WITH CHECK (
    team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND is_active = true
    )
);

-- Task creator, assignee, or admin/manager can update tasks
CREATE POLICY "Authorized users can update tasks"
ON public.vehicle_tasks
FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role IN ('admin', 'manager')
    )
);

-- Only admin/manager can delete tasks
CREATE POLICY "Admins can delete tasks"
ON public.vehicle_tasks
FOR DELETE
TO authenticated
USING (
    team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role IN ('admin', 'manager')
    )
);

-- Create updated_at trigger for vehicle_tasks
CREATE TRIGGER update_vehicle_tasks_updated_at
BEFORE UPDATE ON public.vehicle_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for vehicle_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_tasks;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_vehicle_tasks_vehicle_id ON public.vehicle_tasks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_tasks_team_id ON public.vehicle_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_tasks_assigned_to ON public.vehicle_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vehicle_tasks_status ON public.vehicle_tasks(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_ops_status ON public.vehicles(ops_status);