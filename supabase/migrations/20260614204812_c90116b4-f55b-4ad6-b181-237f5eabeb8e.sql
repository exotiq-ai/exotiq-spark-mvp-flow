
-- 1. data_subject_requests: track generated export
ALTER TABLE public.data_subject_requests
  ADD COLUMN IF NOT EXISTS export_url text,
  ADD COLUMN IF NOT EXISTS export_expires_at timestamptz;

-- 2. retention_sweep_log
CREATE TABLE IF NOT EXISTS public.retention_sweep_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  retention_days integer NOT NULL,
  would_delete_count integer NOT NULL DEFAULT 0,
  deleted_count integer NOT NULL DEFAULT 0,
  dry_run boolean NOT NULL,
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_sweep_log TO authenticated;
GRANT ALL ON public.retention_sweep_log TO service_role;

ALTER TABLE public.retention_sweep_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team admins can view retention sweep log"
  ON public.retention_sweep_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS retention_sweep_log_ran_at_idx
  ON public.retention_sweep_log (ran_at DESC);

-- Immutable log: block updates and deletes
CREATE OR REPLACE FUNCTION public.prevent_retention_sweep_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'retention_sweep_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_retention_sweep_log_mutation
  ON public.retention_sweep_log;
CREATE TRIGGER prevent_retention_sweep_log_mutation
  BEFORE UPDATE OR DELETE ON public.retention_sweep_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_retention_sweep_log_mutation();

-- 3. log_pii_read helper -> existing data_access_log
CREATE OR REPLACE FUNCTION public.log_pii_read(
  p_entity text,
  p_record_id uuid,
  p_fields text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT tm.team_id INTO v_team_id
  FROM public.team_members tm
  WHERE tm.user_id = auth.uid()
  LIMIT 1;

  SELECT p.email INTO v_email
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  INSERT INTO public.data_access_log (
    team_id, actor_user_id, actor_email, entity, record_id, action, metadata
  ) VALUES (
    v_team_id, auth.uid(), v_email, p_entity, p_record_id, 'read',
    COALESCE(jsonb_build_object('fields', p_fields), '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_pii_read(text, uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.log_pii_read(text, uuid, text[]) TO authenticated;

-- 4. Audited read RPCs.
-- Each enforces team membership before returning a row and logs the access.

-- 4a. Customer full record
CREATE OR REPLACE FUNCTION public.get_customer_full(p_customer_id uuid)
RETURNS SETOF public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT tm.team_id INTO v_team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid() LIMIT 1;

  IF v_team_id IS NULL THEN RETURN; END IF;

  PERFORM public.log_pii_read('customers', p_customer_id, NULL);

  RETURN QUERY
  SELECT * FROM public.customers c
  WHERE c.id = p_customer_id AND c.team_id = v_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_full(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_customer_full(uuid) TO authenticated;

-- 4b. Document
CREATE OR REPLACE FUNCTION public.get_document(p_document_id uuid)
RETURNS SETOF public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT tm.team_id INTO v_team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid() LIMIT 1;

  IF v_team_id IS NULL THEN RETURN; END IF;

  PERFORM public.log_pii_read('documents', p_document_id, NULL);

  RETURN QUERY
  SELECT * FROM public.documents d
  WHERE d.id = p_document_id AND d.team_id = v_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_document(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_document(uuid) TO authenticated;

-- 4c. Inspection photo metadata (team scope via parent inspection)
CREATE OR REPLACE FUNCTION public.get_inspection_photo_meta(p_photo_id uuid)
RETURNS SETOF public.inspection_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT tm.team_id INTO v_team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid() LIMIT 1;

  IF v_team_id IS NULL THEN RETURN; END IF;

  PERFORM public.log_pii_read('inspection_photos', p_photo_id, NULL);

  RETURN QUERY
  SELECT ip.*
  FROM public.inspection_photos ip
  JOIN public.vehicle_inspections vi ON vi.id = ip.inspection_id
  WHERE ip.id = p_photo_id AND vi.team_id = v_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inspection_photo_meta(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_inspection_photo_meta(uuid) TO authenticated;

-- 4d. Rari message (team scope via parent conversation)
CREATE OR REPLACE FUNCTION public.get_rari_message(p_message_id uuid)
RETURNS SETOF public.rari_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT tm.team_id INTO v_team_id FROM public.team_members tm
  WHERE tm.user_id = auth.uid() LIMIT 1;

  IF v_team_id IS NULL THEN RETURN; END IF;

  PERFORM public.log_pii_read('rari_messages', p_message_id, NULL);

  RETURN QUERY
  SELECT m.*
  FROM public.rari_messages m
  JOIN public.rari_conversations c ON c.id = m.conversation_id
  WHERE m.id = p_message_id AND c.team_id = v_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rari_message(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_rari_message(uuid) TO authenticated;
