
-- 1) Fix is_same_team()
CREATE OR REPLACE FUNCTION public.is_same_team(_user_id uuid, _target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR _target_user_id IS NULL THEN false
    WHEN _user_id = _target_user_id THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.team_members a
      JOIN public.team_members b ON b.team_id = a.team_id
      WHERE a.user_id = _user_id AND b.user_id = _target_user_id
        AND a.is_active = true AND b.is_active = true
    )
  END
$function$;

-- 2) is_admin_over_user()
CREATE OR REPLACE FUNCTION public.is_admin_over_user(_actor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _actor IS NULL OR _target IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.team_members a
      JOIN public.team_members b ON b.team_id = a.team_id
      WHERE a.user_id = _actor AND b.user_id = _target
        AND a.is_active = true AND b.is_active = true
        AND a.role IN ('owner','admin')
    )
  END
$function$;
REVOKE ALL ON FUNCTION public.is_admin_over_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_over_user(uuid, uuid) TO authenticated, service_role;

-- 3) is_manager_over_user() — for activity log access
CREATE OR REPLACE FUNCTION public.is_manager_over_user(_actor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _actor IS NULL OR _target IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.team_members a
      JOIN public.team_members b ON b.team_id = a.team_id
      WHERE a.user_id = _actor AND b.user_id = _target
        AND a.is_active = true AND b.is_active = true
        AND a.role IN ('owner','admin','manager')
    )
  END
$function$;
REVOKE ALL ON FUNCTION public.is_manager_over_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_over_user(uuid, uuid) TO authenticated, service_role;

-- 4) user_invitations
DROP POLICY IF EXISTS "Admins can view invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can insert invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.user_invitations;

CREATE POLICY "Team admins view invitations" ON public.user_invitations
FOR SELECT TO authenticated
USING (
  (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Team admins insert invitations" ON public.user_invitations
FOR INSERT TO authenticated
WITH CHECK (
  (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Team admins update invitations" ON public.user_invitations
FOR UPDATE TO authenticated
USING (
  (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Team admins delete invitations" ON public.user_invitations
FOR DELETE TO authenticated
USING (
  (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
  OR public.is_super_admin(auth.uid())
);

-- 5) user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "View own role or admin over user" ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin_over_user(auth.uid(), user_id)
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Admins over user can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_over_user(auth.uid(), user_id)
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Admins over user can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  public.is_admin_over_user(auth.uid(), user_id)
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY "Admins over user can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
  public.is_admin_over_user(auth.uid(), user_id)
  OR public.is_super_admin(auth.uid())
);

-- 6) profiles
DROP POLICY IF EXISTS "Users can view own or admin can view all profiles" ON public.profiles;
CREATE POLICY "View own profile or teammate or super admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_same_team(auth.uid(), id)
  OR public.is_super_admin(auth.uid())
);

-- 7) team_messages DELETE
DROP POLICY IF EXISTS "Users can delete own messages" ON public.team_messages;
CREATE POLICY "Users can delete own messages" ON public.team_messages
FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc
    WHERE tc.id = team_messages.conversation_id
      AND tc.team_id IS NOT NULL
      AND public.is_team_admin(auth.uid(), tc.team_id)
  )
);

-- 8) team_conversations DELETE
DROP POLICY IF EXISTS "Conversation creators can delete" ON public.team_conversations;
CREATE POLICY "Conversation creators or team admins can delete" ON public.team_conversations
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
);

-- 9) conversation_members DELETE
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;
CREATE POLICY "cm_delete" ON public.conversation_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_conversation_creator(conversation_id, auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_conversations tc
    WHERE tc.id = conversation_members.conversation_id
      AND tc.team_id IS NOT NULL
      AND public.is_team_admin(auth.uid(), tc.team_id)
  )
);

-- 10) entity_comments DELETE
DROP POLICY IF EXISTS "Users can delete own comments" ON public.entity_comments;
CREATE POLICY "Users can delete own comments" ON public.entity_comments
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
);

-- 11) role_audit_log INSERT — drop the global-admin bypass
DROP POLICY IF EXISTS "Team members can insert audit logs" ON public.role_audit_log;
CREATE POLICY "Team members can insert audit logs" ON public.role_audit_log
FOR INSERT TO authenticated
WITH CHECK (
  (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Team members can view own audit logs" ON public.role_audit_log;
CREATE POLICY "Team members can view own audit logs" ON public.role_audit_log
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
);

-- 12) user_activity_log SELECT (no team_id column — use admin-over-user helper)
DROP POLICY IF EXISTS "Admins can view all activity" ON public.user_activity_log;
CREATE POLICY "Self or team manager can view activity" ON public.user_activity_log
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR public.is_manager_over_user(auth.uid(), user_id)
);
