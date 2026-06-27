
-- 1. Security-definer access helper covering all supported entity types
CREATE OR REPLACE FUNCTION public.can_access_entity(_user_id uuid, _entity_type text, _entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _entity_id IS NULL OR _entity_type IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  RETURN CASE _entity_type
    WHEN 'booking' THEN EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = _entity_id
        AND (b.user_id = _user_id OR public.is_team_member_of_record(_user_id, b.team_id))
    )
    WHEN 'vehicle' THEN EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = _entity_id
        AND (v.user_id = _user_id OR public.is_team_member_of_record(_user_id, v.team_id))
    )
    WHEN 'customer' THEN EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = _entity_id
        AND (c.user_id = _user_id OR public.is_team_member_of_record(_user_id, c.team_id))
    )
    WHEN 'payment' THEN EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = _entity_id
        AND (p.user_id = _user_id OR public.is_team_member_of_record(_user_id, p.team_id))
    )
    WHEN 'damage_claim' THEN EXISTS (
      SELECT 1 FROM public.damage_claims d
      WHERE d.id = _entity_id
        AND (d.user_id = _user_id OR public.is_team_member_of_record(_user_id, d.team_id))
    )
    WHEN 'work_order' THEN EXISTS (
      SELECT 1 FROM public.work_orders w
      WHERE w.id = _entity_id
        AND public.is_team_member_of_record(_user_id, w.team_id)
    )
    WHEN 'vehicle_task' THEN EXISTS (
      SELECT 1 FROM public.vehicle_tasks t
      WHERE t.id = _entity_id
        AND public.is_team_member_of_record(_user_id, t.team_id)
    )
    WHEN 'inspection' THEN EXISTS (
      SELECT 1 FROM public.vehicle_inspections i
      WHERE i.id = _entity_id
        AND (i.user_id = _user_id OR public.is_team_member_of_record(_user_id, i.team_id))
    )
    WHEN 'document' THEN EXISTS (
      SELECT 1 FROM public.tenant_documents td
      WHERE td.id = _entity_id
        AND public.is_team_member_of_record(_user_id, td.team_id)
    )
    WHEN 'customer_note' THEN EXISTS (
      SELECT 1 FROM public.customer_notes cn
      WHERE cn.id = _entity_id AND cn.user_id = _user_id
    )
    WHEN 'partner_payout' THEN EXISTS (
      SELECT 1 FROM public.partner_payouts pp
      WHERE pp.id = _entity_id
        AND public.is_team_member_of_record(_user_id, pp.team_id)
    )
    ELSE false
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_entity(uuid, text, uuid) TO authenticated, service_role;

-- 2. Replace entity_comments policies with helper-backed versions
DROP POLICY IF EXISTS "Users can view accessible comments" ON public.entity_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.entity_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.entity_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.entity_comments;

CREATE POLICY "View comments on accessible records"
  ON public.entity_comments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR public.can_access_entity(auth.uid(), entity_type, entity_id)
  );

CREATE POLICY "Insert comments on accessible records"
  ON public.entity_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_access_entity(auth.uid(), entity_type, entity_id)
  );

-- Damage-claim comments are immutable (audit/legal integrity)
CREATE POLICY "Update own comments (except damage claims)"
  ON public.entity_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND entity_type <> 'damage_claim')
  WITH CHECK (auth.uid() = user_id AND entity_type <> 'damage_claim');

CREATE POLICY "Delete own comments (except damage claims)"
  ON public.entity_comments FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id AND entity_type <> 'damage_claim')
    OR public.is_super_admin(auth.uid())
  );

-- 3. Index for fast thread loads
CREATE INDEX IF NOT EXISTS entity_comments_thread_idx
  ON public.entity_comments (entity_type, entity_id, created_at DESC);

-- 4. Enable realtime
ALTER TABLE public.entity_comments REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'entity_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_comments';
  END IF;
END $$;

-- 5. Per-user read receipts for unread badges
CREATE TABLE IF NOT EXISTS public.entity_comment_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_comment_reads TO authenticated;
GRANT ALL ON public.entity_comment_reads TO service_role;

ALTER TABLE public.entity_comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own read receipts"
  ON public.entity_comment_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Muted threads preference (jsonb array of {entity_type,entity_id})
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS muted_threads jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 7. Relax mention_notifications_log so entity-mention rows can be recorded
--    (conversation_id and message_id are chat-specific)
ALTER TABLE public.mention_notifications_log
  ALTER COLUMN conversation_id DROP NOT NULL,
  ALTER COLUMN message_id DROP NOT NULL;

ALTER TABLE public.mention_notifications_log
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS comment_id uuid;

CREATE INDEX IF NOT EXISTS mention_log_entity_dedupe_idx
  ON public.mention_notifications_log (recipient_id, entity_type, entity_id, sender_id, created_at DESC)
  WHERE entity_type IS NOT NULL;
