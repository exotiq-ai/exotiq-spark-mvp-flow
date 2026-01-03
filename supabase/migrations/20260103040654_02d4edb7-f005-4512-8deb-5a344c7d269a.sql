-- Phase 1b: Create Multi-Tenancy Tables

-- 1.2 Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  settings JSONB DEFAULT '{}',
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  deletion_scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Create locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  timezone TEXT,
  phone TEXT,
  email TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Create team_members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(team_id, user_id)
);

-- 1.5 Create location_staff table
CREATE TABLE public.location_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID,
  UNIQUE(location_id, user_id)
);

-- 1.6 Create vehicle_transfers table
CREATE TABLE public.vehicle_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  from_location_id UUID REFERENCES public.locations(id),
  to_location_id UUID REFERENCES public.locations(id) NOT NULL,
  transferred_by UUID NOT NULL,
  transferred_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  notes TEXT,
  odometer_reading INTEGER
);

-- 1.7 Create team_integrations table
CREATE TABLE public.team_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  integration_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  configured_by UUID,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, integration_type)
);

-- 1.8 Create deletion_requests table
CREATE TABLE public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  confirmation_token TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  scheduled_deletion_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.9 Create indexes
CREATE INDEX idx_teams_owner ON public.teams(owner_id);
CREATE INDEX idx_teams_slug ON public.teams(slug);
CREATE INDEX idx_teams_is_deleted ON public.teams(is_deleted);
CREATE INDEX idx_locations_team ON public.locations(team_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_location_staff_location ON public.location_staff(location_id);
CREATE INDEX idx_location_staff_user ON public.location_staff(user_id);
CREATE INDEX idx_vehicle_transfers_vehicle ON public.vehicle_transfers(vehicle_id);
CREATE INDEX idx_vehicle_transfers_to_location ON public.vehicle_transfers(to_location_id);
CREATE INDEX idx_team_integrations_team ON public.team_integrations(team_id);
CREATE INDEX idx_deletion_requests_team ON public.deletion_requests(team_id);

-- 2.0 Helper functions

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id 
    AND team_id = _team_id 
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id UUID, _team_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id 
    AND team_id = _team_id 
    AND role = _role
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id 
    AND team_id = _team_id 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id 
    AND team_id = _team_id 
    AND role = 'owner'
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_location(_user_id UUID, _location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.location_staff ls
    WHERE ls.user_id = _user_id AND ls.location_id = _location_id
  ) OR EXISTS (
    SELECT 1 FROM public.locations l
    JOIN public.team_members tm ON tm.team_id = l.team_id
    WHERE l.id = _location_id 
    AND tm.user_id = _user_id 
    AND tm.role IN ('owner', 'admin')
    AND tm.is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_teams(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members
  WHERE user_id = _user_id AND is_active = true
$$;

-- 3.0 Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- 4.0 RLS Policies for teams
CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (
  is_team_member(auth.uid(), id) 
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Only owners can update team settings"
ON public.teams FOR UPDATE
USING (
  is_team_owner(auth.uid(), id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can create teams"
ON public.teams FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admins can delete teams"
ON public.teams FOR DELETE
USING (is_super_admin(auth.uid()));

-- 4.1 RLS Policies for locations
CREATE POLICY "Team members can view locations"
ON public.locations FOR SELECT
USING (
  is_team_member(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can create locations"
ON public.locations FOR INSERT
WITH CHECK (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can update locations"
ON public.locations FOR UPDATE
USING (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team owners can delete locations"
ON public.locations FOR DELETE
USING (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

-- 4.2 RLS Policies for team_members
CREATE POLICY "Team members can view team roster"
ON public.team_members FOR SELECT
USING (
  is_team_member(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can add members"
ON public.team_members FOR INSERT
WITH CHECK (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can update members"
ON public.team_members FOR UPDATE
USING (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can remove members"
ON public.team_members FOR DELETE
USING (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

-- 4.3 RLS Policies for location_staff
CREATE POLICY "Team members can view location staff"
ON public.location_staff FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = location_id
    AND is_team_member(auth.uid(), l.team_id)
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can assign staff"
ON public.location_staff FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = location_id
    AND is_team_admin(auth.uid(), l.team_id)
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can update staff assignments"
ON public.location_staff FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = location_id
    AND is_team_admin(auth.uid(), l.team_id)
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team admins can remove staff"
ON public.location_staff FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = location_id
    AND is_team_admin(auth.uid(), l.team_id)
  )
  OR is_super_admin(auth.uid())
);

-- 4.4 RLS Policies for vehicle_transfers
CREATE POLICY "Team members can view transfers"
ON public.vehicle_transfers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = vehicle_transfers.to_location_id
    AND is_team_member(auth.uid(), l.team_id)
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Operators can create transfers"
ON public.vehicle_transfers FOR INSERT
WITH CHECK (
  transferred_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = to_location_id
    AND (
      can_access_location(auth.uid(), to_location_id)
      OR is_team_admin(auth.uid(), l.team_id)
    )
  )
);

-- 4.5 RLS Policies for team_integrations
CREATE POLICY "Team admins can view integrations"
ON public.team_integrations FOR SELECT
USING (
  is_team_admin(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team owners can create integrations"
ON public.team_integrations FOR INSERT
WITH CHECK (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team owners can update integrations"
ON public.team_integrations FOR UPDATE
USING (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team owners can delete integrations"
ON public.team_integrations FOR DELETE
USING (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

-- 4.6 RLS Policies for deletion_requests
CREATE POLICY "Team owners can view deletion requests"
ON public.deletion_requests FOR SELECT
USING (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Team owners can create deletion requests"
ON public.deletion_requests FOR INSERT
WITH CHECK (
  is_team_owner(auth.uid(), team_id)
  AND requested_by = auth.uid()
);

CREATE POLICY "Team owners can update deletion requests"
ON public.deletion_requests FOR UPDATE
USING (
  is_team_owner(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

-- 5.0 Triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_integrations_updated_at
  BEFORE UPDATE ON public.team_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();