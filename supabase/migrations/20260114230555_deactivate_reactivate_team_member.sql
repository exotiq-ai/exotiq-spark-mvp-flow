-- Exported 2026-05-30 from live DB (supabase_migrations.schema_migrations version=20260114230555).
-- Applied directly via the migration tool; was previously not committed to supabase/migrations/.
-- Stored HERE (not in supabase/migrations/) because the Lovable migration system refuses
-- direct file creation under supabase/migrations/. Before any cutover to a new project, move
-- this file to supabase/migrations/20260114230555_deactivate_reactivate_team_member.sql.
--
-- NOTE: The 4-argument deactivate_team_member / reactivate_team_member defined here was later
-- superseded by 1-argument versions currently in the live DB. This file reflects exactly what
-- was applied at this version timestamp.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

CREATE OR REPLACE FUNCTION public.deactivate_team_member(
  p_user_id uuid,
  p_team_id uuid,
  p_deactivated_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role text;
  v_old_permissions text[];
BEGIN
  SELECT role::text, permissions INTO v_old_role, v_old_permissions
  FROM user_roles WHERE user_id = p_user_id;

  UPDATE team_members SET is_active = false
  WHERE user_id = p_user_id AND team_id = p_team_id;

  UPDATE profiles SET is_active = false WHERE id = p_user_id;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  INSERT INTO role_audit_log (
    user_id, changed_by, action, old_role, old_permissions, metadata
  ) VALUES (
    p_user_id, p_deactivated_by, 'user_deactivated',
    v_old_role, v_old_permissions,
    jsonb_build_object('team_id', p_team_id, 'reason', COALESCE(p_reason, 'No reason provided'), 'deactivated_at', now())
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_team_member(
  p_user_id uuid,
  p_team_id uuid,
  p_reactivated_by uuid,
  p_new_role text DEFAULT 'viewer'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE team_members SET is_active = true
  WHERE user_id = p_user_id AND team_id = p_team_id;

  UPDATE profiles SET is_active = true WHERE id = p_user_id;

  INSERT INTO user_roles (user_id, role, permissions)
  VALUES (p_user_id, p_new_role::app_role, ARRAY[]::text[])
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO role_audit_log (
    user_id, changed_by, action, new_role, metadata
  ) VALUES (
    p_user_id, p_reactivated_by, 'user_reactivated', p_new_role,
    jsonb_build_object('team_id', p_team_id, 'reactivated_at', now())
  );

  RETURN true;
END;
$$;
