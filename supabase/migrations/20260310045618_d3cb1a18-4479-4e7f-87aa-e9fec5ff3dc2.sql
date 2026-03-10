
-- Work Orders table
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  assigned_to UUID,
  created_by UUID NOT NULL,
  due_at TIMESTAMPTZ,
  internal_or_outsourced TEXT DEFAULT 'internal',
  vendor_name TEXT,
  estimate_cost NUMERIC(10,2),
  actual_cost NUMERIC(10,2),
  notes TEXT,
  resolution_summary TEXT,
  out_of_rotation BOOLEAN DEFAULT false,
  expected_return_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_work_orders_team_status ON public.work_orders(team_id, status);
CREATE INDEX idx_work_orders_vehicle ON public.work_orders(vehicle_id);
CREATE INDEX idx_work_orders_assigned ON public.work_orders(assigned_to) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_work_orders_due ON public.work_orders(due_at) WHERE status NOT IN ('completed', 'cancelled');

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view work orders" ON public.work_orders FOR SELECT TO authenticated USING (public.is_my_team_member(team_id));
CREATE POLICY "Team members can insert work orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (public.is_my_team_member(team_id));
CREATE POLICY "Team members can update work orders" ON public.work_orders FOR UPDATE TO authenticated USING (public.is_my_team_member(team_id));
CREATE POLICY "Admins can delete work orders" ON public.work_orders FOR DELETE TO authenticated USING (public.is_my_team_admin(team_id));

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;

-- Work Order Events (audit trail)
CREATE TABLE public.work_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wo_events_order ON public.work_order_events(work_order_id, created_at);

ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view events via work order" ON public.work_order_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id = work_order_id AND public.is_my_team_member(wo.team_id)));
CREATE POLICY "Team members can insert events" ON public.work_order_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id = work_order_id AND public.is_my_team_member(wo.team_id)));

-- Recurrence columns on maintenance_schedules
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS recurrence_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_mileage_interval INTEGER,
  ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_completed_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS template_name TEXT;
