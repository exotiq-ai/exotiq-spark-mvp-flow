-- Harden tenant boundaries before Supabase migration cutover.
-- This migration replaces broad role/storage policies with team-scoped checks
-- while preserving compatibility for existing user-prefixed storage objects.

CREATE OR REPLACE FUNCTION public.safe_uuid(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN value::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_same_team(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _target_user_id
    OR EXISTS (
      SELECT 1
      FROM public.team_members actor
      JOIN public.team_members target ON target.team_id = actor.team_id
      WHERE actor.user_id = _user_id
        AND target.user_id = _target_user_id
        AND actor.is_active = true
        AND target.is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.has_shared_team_role(
  _actor_user_id uuid,
  _target_user_id uuid,
  _roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members actor
    JOIN public.team_members target ON target.team_id = actor.team_id
    WHERE actor.user_id = _actor_user_id
      AND target.user_id = _target_user_id
      AND actor.is_active = true
      AND target.is_active = true
      AND actor.role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_team_or_user_storage_path(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH first_folder AS (
    SELECT public.safe_uuid((storage.foldername(_object_name))[1]) AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM first_folder f
    WHERE f.id IS NOT NULL
      AND (
        f.id = _user_id
        OR public.is_team_member(_user_id, f.id)
        OR public.is_same_team(_user_id, f.id)
        OR public.is_super_admin(_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_team_or_user_storage_path(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH first_folder AS (
    SELECT public.safe_uuid((storage.foldername(_object_name))[1]) AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM first_folder f
    WHERE f.id IS NOT NULL
      AND (
        f.id = _user_id
        OR public.is_team_member(_user_id, f.id)
        OR public.is_super_admin(_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team_or_user_storage_path(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH first_folder AS (
    SELECT public.safe_uuid((storage.foldername(_object_name))[1]) AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM first_folder f
    WHERE f.id IS NOT NULL
      AND (
        f.id = _user_id
        OR public.is_super_admin(_user_id)
        OR EXISTS (
          SELECT 1
          FROM public.team_members actor
          WHERE actor.user_id = _user_id
            AND actor.team_id = f.id
            AND actor.is_active = true
            AND actor.role IN ('owner', 'admin', 'manager')
        )
        OR public.has_shared_team_role(
          _user_id,
          f.id,
          ARRAY['owner', 'admin', 'manager']::public.app_role[]
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(
  _user_id uuid,
  _conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = _conversation_id
      AND cm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = _conversation_id
      AND tc.is_company_wide = true
      AND (
        tc.team_id IS NULL
        OR public.is_team_member(_user_id, tc.team_id)
      )
  )
  OR public.is_super_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_read_message_attachment_path(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH first_folder AS (
    SELECT public.safe_uuid((storage.foldername(_object_name))[1]) AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM first_folder f
    WHERE f.id IS NOT NULL
      AND (
        public.can_access_conversation(_user_id, f.id)
        OR public.can_read_team_or_user_storage_path(_user_id, _object_name)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_message_attachment_path(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH first_folder AS (
    SELECT public.safe_uuid((storage.foldername(_object_name))[1]) AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM first_folder f
    WHERE f.id IS NOT NULL
      AND public.can_access_conversation(_user_id, f.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(
  _user_id uuid,
  _topic text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _topic = ANY(ARRAY[
      'activity-updates',
      'maintenance-windows-admin',
      'maintenance-windows-watch',
      'notifications-realtime',
      'presence-changes',
      'rari-insights-count',
      'rari_insight_action_items_changes',
      'rari_insights_changes',
      'unmatched-photos-changes',
      'vehicle-photos-changes',
      'vehicle_tasks_changes',
      'work_orders_rt'
    ])
    OR _topic = ('profile-' || _user_id::text)
    OR (
      _topic LIKE 'fleet-realtime-%'
      AND split_part(replace(_topic, 'fleet-realtime-', ''), ':', 1) = _user_id::text
      AND (
        split_part(replace(_topic, 'fleet-realtime-', ''), ':', 2) = 'no-team'
        OR public.is_team_member(
          _user_id,
          public.safe_uuid(split_part(replace(_topic, 'fleet-realtime-', ''), ':', 2))
        )
      )
    )
    OR (
      _topic LIKE 'expense-review-%'
      AND public.is_team_member(_user_id, public.safe_uuid(replace(_topic, 'expense-review-', '')))
    )
    OR (
      _topic LIKE 'messages-%'
      AND public.can_access_conversation(_user_id, public.safe_uuid(replace(_topic, 'messages-', '')))
    )
    OR (
      _topic LIKE 'read-receipts-%'
      AND public.can_access_conversation(_user_id, public.safe_uuid(replace(_topic, 'read-receipts-', '')))
    )
    OR (
      _topic LIKE 'pinned-%'
      AND public.can_access_conversation(_user_id, public.safe_uuid(replace(_topic, 'pinned-', '')))
    )
$$;

-- Live inventory reports this column exists; keep the repo rebuild path safe too.
ALTER TABLE public.user_activity_log
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

UPDATE public.user_activity_log ual
SET team_id = tm.team_id
FROM public.team_members tm
WHERE ual.team_id IS NULL
  AND tm.user_id = ual.user_id
  AND tm.is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_activity_log_team_id
ON public.user_activity_log(team_id);

-- Storage: customer documents.
DROP POLICY IF EXISTS "Users can view their customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their customer documents" ON storage.objects;

CREATE POLICY "Team-scoped users can view customer documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND public.can_read_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Team-scoped users can upload customer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-documents'
  AND public.can_write_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Team managers can update customer documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
)
WITH CHECK (
  bucket_id = 'customer-documents'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
);

CREATE POLICY "Team managers can delete customer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND public.can_manage_team_or_user_storage_path(auth.uid(), name)
);

-- Storage: message attachments.
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;

CREATE POLICY "Conversation members can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND public.can_read_message_attachment_path(auth.uid(), name)
);

CREATE POLICY "Conversation members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND public.can_write_message_attachment_path(auth.uid(), name)
);

CREATE POLICY "Conversation members can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    public.can_write_message_attachment_path(auth.uid(), name)
    OR auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_super_admin(auth.uid())
  )
);

-- Profiles.
DROP POLICY IF EXISTS "Users can view own or admin can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own or team profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    id,
    ARRAY['owner', 'admin', 'manager']::public.app_role[]
  )
);

-- User roles.
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own or team roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    user_id,
    ARRAY['owner', 'admin']::public.app_role[]
  )
);

CREATE POLICY "Team admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    user_id,
    ARRAY['owner', 'admin']::public.app_role[]
  )
);

CREATE POLICY "Team admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    user_id,
    ARRAY['owner', 'admin']::public.app_role[]
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    user_id,
    ARRAY['owner', 'admin']::public.app_role[]
  )
);

CREATE POLICY "Team admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_shared_team_role(
    auth.uid(),
    user_id,
    ARRAY['owner', 'admin']::public.app_role[]
  )
);

-- Invitations.
DROP POLICY IF EXISTS "Admins can view invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can insert invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.user_invitations;

CREATE POLICY "Team admins can view invitations"
ON public.user_invitations FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_team_admin(auth.uid(), team_id)
);

CREATE POLICY "Team admins can insert invitations"
ON public.user_invitations FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_team_admin(auth.uid(), team_id)
);

CREATE POLICY "Team admins can update invitations"
ON public.user_invitations FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_team_admin(auth.uid(), team_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_team_admin(auth.uid(), team_id)
);

CREATE POLICY "Team admins can delete invitations"
ON public.user_invitations FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_team_admin(auth.uid(), team_id)
);

-- Conversation and comment admin actions.
DROP POLICY IF EXISTS "Users can delete own messages" ON public.team_messages;
DROP POLICY IF EXISTS "Conversation creators can delete" ON public.team_conversations;
DROP POLICY IF EXISTS "cm_delete" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.entity_comments;

CREATE POLICY "Users can delete own or team-admin messages"
ON public.team_messages FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = team_messages.conversation_id
      AND tc.team_id IS NOT NULL
      AND public.is_team_admin(auth.uid(), tc.team_id)
  )
);

CREATE POLICY "Conversation creators or team admins can delete"
ON public.team_conversations FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
);

CREATE POLICY "Conversation members can be removed by scoped admins"
ON public.conversation_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.is_conversation_creator(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.conversation_members actor
    WHERE actor.conversation_id = conversation_members.conversation_id
      AND actor.user_id = auth.uid()
      AND actor.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_members.conversation_id
      AND tc.team_id IS NOT NULL
      AND public.is_team_admin(auth.uid(), tc.team_id)
  )
);

CREATE POLICY "Users can delete own or team comments"
ON public.entity_comments FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (
    entity_type = 'booking'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = entity_comments.entity_id
        AND b.team_id IS NOT NULL
        AND public.is_team_admin(auth.uid(), b.team_id)
    )
  )
  OR (
    entity_type = 'vehicle'
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = entity_comments.entity_id
        AND v.team_id IS NOT NULL
        AND public.is_team_admin(auth.uid(), v.team_id)
    )
  )
  OR (
    entity_type = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = entity_comments.entity_id
        AND c.team_id IS NOT NULL
        AND public.is_team_admin(auth.uid(), c.team_id)
    )
  )
  OR (
    entity_type = 'payment'
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = entity_comments.entity_id
        AND p.team_id IS NOT NULL
        AND public.is_team_admin(auth.uid(), p.team_id)
    )
  )
  OR (
    entity_type = 'damage_claim'
    AND EXISTS (
      SELECT 1 FROM public.damage_claims d
      WHERE d.id = entity_comments.entity_id
        AND d.team_id IS NOT NULL
        AND public.is_team_admin(auth.uid(), d.team_id)
    )
  )
);

-- Role audit log.
DROP POLICY IF EXISTS "Team members can view own audit logs" ON public.role_audit_log;
DROP POLICY IF EXISTS "Team members can insert audit logs" ON public.role_audit_log;

CREATE POLICY "Team admins can view audit logs"
ON public.role_audit_log FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = role_audit_log.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Team admins can insert audit logs"
ON public.role_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    changed_by = auth.uid()
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = role_audit_log.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
);

-- Activity log.
DROP POLICY IF EXISTS "Admins can view all activity" ON public.user_activity_log;

CREATE POLICY "Users can view own or team activity"
ON public.user_activity_log FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = user_activity_log.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin', 'manager')
    )
  )
);

-- Realtime channel authorization.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to scoped app topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can publish to scoped app topics" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to scoped app topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic(auth.uid(), realtime.topic()));

CREATE POLICY "Authenticated users can publish to scoped app topics"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (public.can_access_realtime_topic(auth.uid(), realtime.topic()));
