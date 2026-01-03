
-- Phase 2: Add team_id and location_id to existing tables and migrate data

-- ============================================
-- Step 1: Add team_id and location_id columns
-- ============================================

-- Vehicles: Add team_id and location_id (current location of vehicle)
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);

-- Bookings: Add team_id and location references
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS dropoff_location_id UUID REFERENCES public.locations(id);

-- Customers: Add team_id
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Payments: Add team_id
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Documents: Add team_id
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Damage Claims: Add team_id
ALTER TABLE public.damage_claims 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Maintenance Schedules: Add team_id and location_id
ALTER TABLE public.maintenance_schedules 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id);

-- Vehicle Inspections: Add team_id
ALTER TABLE public.vehicle_inspections 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Messages: Add team_id
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Team Conversations: Add team_id (for team-scoped channels)
ALTER TABLE public.team_conversations 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- ============================================
-- Step 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vehicles_team_id ON public.vehicles(team_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_location_id ON public.vehicles(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_team_id ON public.bookings(team_id);
CREATE INDEX IF NOT EXISTS idx_customers_team_id ON public.customers(team_id);
CREATE INDEX IF NOT EXISTS idx_payments_team_id ON public.payments(team_id);
CREATE INDEX IF NOT EXISTS idx_documents_team_id ON public.documents(team_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_team_id ON public.damage_claims(team_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_team_id ON public.maintenance_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_team_id ON public.vehicle_inspections(team_id);
CREATE INDEX IF NOT EXISTS idx_messages_team_id ON public.messages(team_id);
CREATE INDEX IF NOT EXISTS idx_team_conversations_team_id ON public.team_conversations(team_id);

-- ============================================
-- Step 3: Data Migration Function
-- ============================================

CREATE OR REPLACE FUNCTION public.migrate_users_to_teams()
RETURNS TABLE(
  users_migrated INTEGER,
  teams_created INTEGER,
  locations_created INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_team_id UUID;
  v_location_id UUID;
  v_users_count INTEGER := 0;
  v_teams_count INTEGER := 0;
  v_locations_count INTEGER := 0;
BEGIN
  -- Loop through each user in profiles who doesn't already have a team
  FOR v_user IN 
    SELECT p.id, p.email, p.full_name, p.company_name
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = p.id
    )
  LOOP
    -- Create a team for this user
    INSERT INTO teams (
      owner_id,
      name,
      slug,
      timezone
    ) VALUES (
      v_user.id,
      COALESCE(v_user.company_name, v_user.full_name || '''s Fleet', 'My Fleet'),
      LOWER(REGEXP_REPLACE(COALESCE(v_user.company_name, v_user.full_name, 'fleet-' || LEFT(v_user.id::text, 8)), '[^a-zA-Z0-9]', '-', 'g')),
      'America/New_York'
    )
    RETURNING id INTO v_team_id;
    
    v_teams_count := v_teams_count + 1;
    
    -- Create a default location for this team
    INSERT INTO locations (
      team_id,
      name,
      is_default,
      is_active
    ) VALUES (
      v_team_id,
      'Main Location',
      true,
      true
    )
    RETURNING id INTO v_location_id;
    
    v_locations_count := v_locations_count + 1;
    
    -- Add user as owner in team_members
    INSERT INTO team_members (
      team_id,
      user_id,
      role,
      invited_by,
      is_active
    ) VALUES (
      v_team_id,
      v_user.id,
      'owner',
      v_user.id,
      true
    );
    
    -- Assign user to the default location
    INSERT INTO location_staff (
      location_id,
      user_id,
      is_primary,
      assigned_by
    ) VALUES (
      v_location_id,
      v_user.id,
      true,
      v_user.id
    );
    
    -- Update all vehicles owned by this user
    UPDATE vehicles 
    SET team_id = v_team_id, location_id = v_location_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all bookings
    UPDATE bookings 
    SET team_id = v_team_id, 
        pickup_location_id = v_location_id,
        dropoff_location_id = v_location_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all customers
    UPDATE customers 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all payments
    UPDATE payments 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all documents
    UPDATE documents 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all damage claims
    UPDATE damage_claims 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all maintenance schedules
    UPDATE maintenance_schedules 
    SET team_id = v_team_id, location_id = v_location_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all vehicle inspections
    UPDATE vehicle_inspections 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update all messages
    UPDATE messages 
    SET team_id = v_team_id
    WHERE user_id = v_user.id AND team_id IS NULL;
    
    -- Update team conversations created by this user
    UPDATE team_conversations 
    SET team_id = v_team_id
    WHERE created_by = v_user.id AND team_id IS NULL;
    
    v_users_count := v_users_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_users_count, v_teams_count, v_locations_count;
END;
$$;

-- ============================================
-- Step 4: Function to auto-create team on new user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.create_team_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team_id UUID;
  v_location_id UUID;
BEGIN
  -- Only create team if user doesn't already have one (wasn't invited)
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.id) THEN
    -- Create team
    INSERT INTO teams (owner_id, name, slug, timezone)
    VALUES (
      NEW.id,
      COALESCE(NEW.company_name, NEW.full_name || '''s Fleet', 'My Fleet'),
      LOWER(REGEXP_REPLACE(COALESCE(NEW.company_name, NEW.full_name, 'fleet-' || LEFT(NEW.id::text, 8)), '[^a-zA-Z0-9]', '-', 'g')),
      'America/New_York'
    )
    RETURNING id INTO v_team_id;
    
    -- Create default location
    INSERT INTO locations (team_id, name, is_default, is_active)
    VALUES (v_team_id, 'Main Location', true, true)
    RETURNING id INTO v_location_id;
    
    -- Add user as owner
    INSERT INTO team_members (team_id, user_id, role, invited_by, is_active)
    VALUES (v_team_id, NEW.id, 'owner', NEW.id, true);
    
    -- Assign to default location
    INSERT INTO location_staff (location_id, user_id, is_primary, assigned_by)
    VALUES (v_location_id, NEW.id, true, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_profile_created_create_team ON public.profiles;
CREATE TRIGGER on_profile_created_create_team
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_team_for_new_user();

-- ============================================
-- Step 5: Run the migration for existing users
-- ============================================

SELECT * FROM public.migrate_users_to_teams();
