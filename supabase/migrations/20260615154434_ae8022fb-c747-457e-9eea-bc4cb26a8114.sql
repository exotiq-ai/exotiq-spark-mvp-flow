-- =====================================================================
-- Tenant e-signature: Exotiq -> Tenant document send-and-sign workflow
-- =====================================================================

-- Human-readable reference sequence (separate from internal documents)
CREATE SEQUENCE IF NOT EXISTS public.tenant_document_ref_seq START 1;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.tenant_document_template AS ENUM ('order_form', 'addendum', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_document_status AS ENUM ('sent', 'viewed', 'signed', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- tenant_documents
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sent_by_super_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  doc_ref TEXT UNIQUE,
  title TEXT NOT NULL,
  template public.tenant_document_template NOT NULL DEFAULT 'custom',
  original_storage_path TEXT NOT NULL,           -- path inside exotiq-compliance bucket
  signed_storage_path TEXT,                      -- signed copy in exotiq-compliance
  signed_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  signer_name TEXT,
  signer_title TEXT,
  signer_email TEXT,
  status public.tenant_document_status NOT NULL DEFAULT 'sent',
  field_overlay JSONB NOT NULL DEFAULT '[]'::jsonb,
  original_sha256 TEXT,
  signed_sha256 TEXT,
  signing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  voided_reason TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_documents_team_id ON public.tenant_documents(team_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_status ON public.tenant_documents(status);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_sent_at ON public.tenant_documents(sent_at DESC);

GRANT SELECT, UPDATE ON public.tenant_documents TO authenticated;
GRANT ALL ON public.tenant_documents TO service_role;

ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

-- Tenant owners/admins can read their team's documents
CREATE POLICY "Tenant admins read own team documents"
  ON public.tenant_documents FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_team_admin(auth.uid(), team_id)
  );

-- Tenant owners/admins can update status fields (viewed_at, signed_at handled by edge fn)
-- but RLS still allows direct status flip from 'sent' -> 'viewed' from the client.
CREATE POLICY "Tenant admins mark documents viewed"
  ON public.tenant_documents FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_team_admin(auth.uid(), team_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_team_admin(auth.uid(), team_id)
  );

-- Doc ref trigger
CREATE OR REPLACE FUNCTION public.generate_tenant_doc_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.doc_ref IS NULL THEN
    NEW.doc_ref := 'EXQ-TDOC-' || EXTRACT(YEAR FROM NOW())::TEXT
      || '-' || LPAD(nextval('public.tenant_document_ref_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_doc_ref ON public.tenant_documents;
CREATE TRIGGER set_tenant_doc_ref
  BEFORE INSERT ON public.tenant_documents
  FOR EACH ROW EXECUTE FUNCTION public.generate_tenant_doc_ref();

-- updated_at trigger (reuse existing pattern if a generic exists; otherwise inline)
CREATE OR REPLACE FUNCTION public.touch_tenant_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_tenant_documents ON public.tenant_documents;
CREATE TRIGGER trg_touch_tenant_documents
  BEFORE UPDATE ON public.tenant_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenant_documents_updated_at();

-- =====================================================================
-- tenant_document_audit (append-only)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenant_document_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_document_id UUID NOT NULL REFERENCES public.tenant_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent','opened','viewed_page','scrolled_complete','signed','downloaded','voided'
  )),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tda_tenant_document ON public.tenant_document_audit(tenant_document_id, created_at DESC);

GRANT SELECT ON public.tenant_document_audit TO authenticated;
GRANT ALL ON public.tenant_document_audit TO service_role;

ALTER TABLE public.tenant_document_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins read own audit"
  ON public.tenant_document_audit FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_documents td
      WHERE td.id = tenant_document_audit.tenant_document_id
        AND public.is_team_admin(auth.uid(), td.team_id)
    )
  );

-- Direct inserts forbidden from client; service role only.
-- (No INSERT policy => only service_role can insert via GRANT ALL.)

-- Block updates and deletes on audit (append-only)
CREATE POLICY "Audit is append-only - no update"
  ON public.tenant_document_audit FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Audit is append-only - no delete"
  ON public.tenant_document_audit FOR DELETE
  TO authenticated
  USING (false);
