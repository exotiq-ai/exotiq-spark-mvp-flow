CREATE OR REPLACE FUNCTION public.create_team_for_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id UUID;
  v_location_id UUID;
BEGIN
  -- Skip team creation if user has a pending invitation
  -- (their team membership will be handled by accept-invite flow)
  IF EXISTS (
    SELECT 1 FROM user_invitations
    WHERE email = NEW.email AND status = 'pending'
  ) THEN
    RAISE NOTICE 'User % has pending invitation, skipping team creation', NEW.email;
    RETURN NEW;
  END IF;

  -- Only create team if user doesn't already have one
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
$function$;