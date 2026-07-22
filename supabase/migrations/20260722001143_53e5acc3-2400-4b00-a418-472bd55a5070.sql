
-- Local slug helper (avoids clobbering existing public.slugify signature)
CREATE OR REPLACE FUNCTION public._team_slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      lower(coalesce(input, '')),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rename_team(
  _team_id uuid,
  _new_name text,
  _regenerate_slug boolean DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, slug text, slug_changed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trimmed text := btrim(coalesce(_new_name, ''));
  v_team public.teams%ROWTYPE;
  v_authorized boolean;
  v_base_slug text;
  v_candidate text;
  v_suffix int := 1;
  v_should_regen boolean;
  v_old_slug text;
  v_is_super boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_trimmed) < 2 THEN
    RAISE EXCEPTION 'name_too_short';
  END IF;
  IF length(v_trimmed) > 120 THEN
    RAISE EXCEPTION 'name_too_long';
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE teams.id = _team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team_not_found';
  END IF;

  BEGIN
    SELECT EXISTS(SELECT 1 FROM public.super_admins sa WHERE sa.user_id = v_uid)
      INTO v_is_super;
  EXCEPTION WHEN undefined_table THEN
    v_is_super := false;
  END;

  v_authorized :=
    v_team.owner_id = v_uid
    OR v_is_super
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = _team_id
         AND tm.user_id = v_uid
         AND tm.role IN ('owner', 'admin')
    );

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_old_slug := v_team.slug;

  IF _regenerate_slug IS TRUE THEN
    v_should_regen := true;
  ELSIF _regenerate_slug IS FALSE THEN
    v_should_regen := false;
  ELSE
    v_should_regen := NOT COALESCE(v_team.marketplace_visible, false)
      AND COALESCE(v_team.marketplace_request_status::text, 'none') <> 'approved';
  END IF;

  UPDATE public.teams
     SET name = v_trimmed,
         updated_at = now()
   WHERE teams.id = _team_id;

  IF v_should_regen THEN
    v_base_slug := public._team_slugify(v_trimmed);
    IF v_base_slug IS NULL OR length(v_base_slug) = 0 THEN
      v_base_slug := 'team-' || left(_team_id::text, 8);
    END IF;
    v_candidate := v_base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.teams t
       WHERE t.slug = v_candidate AND t.id <> _team_id
    ) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := v_base_slug || '-' || v_suffix::text;
    END LOOP;

    UPDATE public.teams
       SET slug = v_candidate
     WHERE teams.id = _team_id;
  END IF;

  RETURN QUERY
    SELECT t.id, t.name, t.slug, (t.slug IS DISTINCT FROM v_old_slug) AS slug_changed
      FROM public.teams t
     WHERE t.id = _team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_team(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_team(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_team(uuid, text, boolean) TO service_role;

-- Backfill: sync teams.name from profiles.company_name
WITH candidates AS (
  SELECT
    t.id AS team_id,
    btrim(p.company_name) AS trimmed_company,
    COALESCE(t.marketplace_visible, false)
      OR COALESCE(t.marketplace_request_status::text, 'none') = 'approved' AS is_live
  FROM public.teams t
  JOIN public.profiles p ON p.id = t.owner_id
  WHERE p.company_name IS NOT NULL
    AND btrim(p.company_name) <> ''
    AND btrim(p.company_name) <> btrim(t.name)
),
renamed AS (
  UPDATE public.teams t
     SET name = c.trimmed_company,
         updated_at = now()
    FROM candidates c
   WHERE t.id = c.team_id
  RETURNING t.id, c.is_live, c.trimmed_company
),
slug_targets AS (
  SELECT r.id, r.trimmed_company,
         public._team_slugify(r.trimmed_company) AS base_slug
    FROM renamed r
   WHERE r.is_live = false
)
UPDATE public.teams t
   SET slug = sub.new_slug
  FROM (
    SELECT s.id,
           CASE
             WHEN NOT EXISTS (
               SELECT 1 FROM public.teams t2
                WHERE t2.slug = s.base_slug AND t2.id <> s.id
             ) THEN s.base_slug
             ELSE s.base_slug || '-' || left(s.id::text, 6)
           END AS new_slug
      FROM slug_targets s
     WHERE s.base_slug IS NOT NULL AND length(s.base_slug) > 0
  ) sub
 WHERE t.id = sub.id
   AND t.slug IS DISTINCT FROM sub.new_slug;

-- Trim whitespace on any team name (fixes "Exotiq " → "Exotiq")
UPDATE public.teams
   SET name = btrim(name), updated_at = now()
 WHERE name <> btrim(name);
