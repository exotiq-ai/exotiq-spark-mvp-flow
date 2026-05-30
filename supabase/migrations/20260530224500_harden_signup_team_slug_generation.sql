-- Prevent auth-created profiles with missing display metadata from creating
-- blank team slugs. This keeps signup/import rehearsals from failing on the
-- second user when multiple profiles lack full_name/company_name.

UPDATE public.teams
SET slug = 'team-' || LEFT(id::text, 8)
WHERE slug IS NULL OR btrim(slug) = '';

CREATE OR REPLACE FUNCTION public.create_team_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team_id uuid;
  v_location_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 0;
BEGIN
  -- Skip team creation if user has a pending invitation
  -- (their team membership will be handled by accept-invite flow).
  IF EXISTS (
    SELECT 1
    FROM public.user_invitations
    WHERE email = NEW.email
      AND status = 'pending'
  ) THEN
    RAISE NOTICE 'User % has pending invitation, skipping team creation', NEW.email;
    RETURN NEW;
  END IF;

  -- Only create team if user doesn't already have one.
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = NEW.id) THEN
    v_base_slug := COALESCE(
      NULLIF(
        lower(
          trim(
            both '-' from regexp_replace(
              COALESCE(
                NULLIF(btrim(NEW.company_name), ''),
                NULLIF(btrim(NEW.full_name), ''),
                'fleet-' || LEFT(NEW.id::text, 8)
              ),
              '[^a-zA-Z0-9]+',
              '-',
              'g'
            )
          )
        ),
        ''
      ),
      'fleet-' || LEFT(NEW.id::text, 8)
    );

    v_slug := v_base_slug;
    WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = v_slug) LOOP
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix::text;
    END LOOP;

    INSERT INTO public.teams (owner_id, name, slug, timezone)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(btrim(NEW.company_name), ''), NULLIF(btrim(NEW.full_name), '') || '''s Fleet', 'My Fleet'),
      v_slug,
      'America/New_York'
    )
    RETURNING id INTO v_team_id;

    INSERT INTO public.locations (team_id, name, is_default, is_active)
    VALUES (v_team_id, 'Main Location', true, true)
    RETURNING id INTO v_location_id;

    INSERT INTO public.team_members (team_id, user_id, role, invited_by, is_active)
    VALUES (v_team_id, NEW.id, 'owner', NEW.id, true);

    INSERT INTO public.location_staff (location_id, user_id, is_primary, assigned_by)
    VALUES (v_location_id, NEW.id, true, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
