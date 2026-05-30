
-- maintenance_windows: tracks active global or per-tenant maintenance periods
CREATE TABLE public.maintenance_windows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant')),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  message TEXT,
  eta TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_requires_team CHECK (
    (scope = 'tenant' AND team_id IS NOT NULL) OR
    (scope = 'global' AND team_id IS NULL)
  )
);

CREATE INDEX idx_maintenance_windows_active_scope ON public.maintenance_windows (is_active, scope);
CREATE INDEX idx_maintenance_windows_active_team ON public.maintenance_windows (is_active, team_id) WHERE team_id IS NOT NULL;

GRANT SELECT ON public.maintenance_windows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_windows TO authenticated;
GRANT ALL ON public.maintenance_windows TO service_role;

ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

-- All signed-in users can see active windows (needed to render the overlay)
CREATE POLICY "Authenticated users can view maintenance windows"
ON public.maintenance_windows
FOR SELECT
TO authenticated
USING (true);

-- Only super admins can create/update/delete
CREATE POLICY "Super admins can insert maintenance windows"
ON public.maintenance_windows
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update maintenance windows"
ON public.maintenance_windows
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete maintenance windows"
ON public.maintenance_windows
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_maintenance_windows_updated_at
BEFORE UPDATE ON public.maintenance_windows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime so the overlay reacts within ~1s
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_windows;

-- maintenance_notify_subscribers: emails to notify when window ends
CREATE TABLE public.maintenance_notify_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_id UUID NOT NULL REFERENCES public.maintenance_windows(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (window_id, email)
);

CREATE INDEX idx_maintenance_notify_window ON public.maintenance_notify_subscribers (window_id) WHERE notified_at IS NULL;

GRANT INSERT ON public.maintenance_notify_subscribers TO anon;
GRANT INSERT ON public.maintenance_notify_subscribers TO authenticated;
GRANT ALL ON public.maintenance_notify_subscribers TO service_role;

ALTER TABLE public.maintenance_notify_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (anon + authenticated) — write-only
CREATE POLICY "Anyone can subscribe to maintenance updates"
ON public.maintenance_notify_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Super admins can read subscriber counts
CREATE POLICY "Super admins can view subscribers"
ON public.maintenance_notify_subscribers
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
