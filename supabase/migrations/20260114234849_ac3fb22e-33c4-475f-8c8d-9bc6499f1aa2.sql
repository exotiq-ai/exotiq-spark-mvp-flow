-- Create function to deactivate a team member (soft delete)
CREATE OR REPLACE FUNCTION public.deactivate_team_member(target_user_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can deactivate team members';
  END IF;

  -- Prevent deactivating yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot deactivate yourself';
  END IF;

  -- Update profile to inactive
  UPDATE public.profiles
  SET is_active = false,
      updated_at = now()
  WHERE id = target_user_id;

  -- Update team_members to inactive
  UPDATE public.team_members
  SET is_active = false
  WHERE user_id = target_user_id;

  -- Log to audit trail
  INSERT INTO public.role_audit_log (
    user_id,
    changed_by,
    action,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    'user_deactivated',
    jsonb_build_object('reason', COALESCE(reason, 'No reason provided'))
  );
END;
$$;

-- Create function to reactivate a team member
CREATE OR REPLACE FUNCTION public.reactivate_team_member(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reactivate team members';
  END IF;

  -- Update profile to active
  UPDATE public.profiles
  SET is_active = true,
      updated_at = now()
  WHERE id = target_user_id;

  -- Update team_members to active
  UPDATE public.team_members
  SET is_active = true
  WHERE user_id = target_user_id;

  -- Log to audit trail
  INSERT INTO public.role_audit_log (
    user_id,
    changed_by,
    action,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    'user_reactivated',
    jsonb_build_object()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deactivate_team_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_team_member(uuid) TO authenticated;