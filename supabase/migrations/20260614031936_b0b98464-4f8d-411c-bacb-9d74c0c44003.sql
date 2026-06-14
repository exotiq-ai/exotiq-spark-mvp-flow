
-- Enums
DO $$ BEGIN
  CREATE TYPE public.legal_document_type AS ENUM ('terms','privacy','aup','dpa','order_form');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.terms_acceptance_event AS ENUM ('signup','reacceptance','terms_update','order_form');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.terms_acceptance_method AS ENUM ('checkbox_click','button_click');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Versioned document archive
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type public.legal_document_type NOT NULL,
  version text NOT NULL,
  effective_date date NOT NULL,
  url text NOT NULL,
  content_hash text NOT NULL,
  content_text text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

GRANT SELECT ON public.legal_document_versions TO anon, authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legal versions are world-readable"
  ON public.legal_document_versions FOR SELECT
  USING (true);

-- Immutable acceptance ledger
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  actor_email text,
  actor_display_name text,
  event_type public.terms_acceptance_event NOT NULL,
  documents_accepted jsonb NOT NULL,
  acceptance_method public.terms_acceptance_method NOT NULL DEFAULT 'checkbox_click',
  consent_statement text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  page_url text,
  auth_context text,
  is_authorized_representative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_team ON public.terms_acceptances (team_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON public.terms_acceptances (user_id, accepted_at DESC);

-- App role can only read; inserts come from edge function (service_role)
GRANT SELECT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own acceptances"
  ON public.terms_acceptances FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))
  );

-- Belt-and-suspenders immutability
CREATE OR REPLACE FUNCTION public.prevent_terms_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION 'terms_acceptances is append-only';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_terms_acceptances_no_update ON public.terms_acceptances;
CREATE TRIGGER trg_terms_acceptances_no_update
  BEFORE UPDATE OR DELETE ON public.terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_terms_acceptance_mutation();

-- Seed initial published versions (placeholder hashes; refreshed by hash-docs script)
INSERT INTO public.legal_document_versions
  (document_type, version, effective_date, url, content_hash, content_text)
VALUES
  ('terms',   '2026-03-01', '2026-03-01', '/terms',
    'pending-hash-terms-2026-03-01',
    'Exotiq Command Center Terms and Conditions, effective 2026-03-01. See /terms for the full text.'),
  ('privacy', '2026-03-01', '2026-03-01', '/privacy',
    'pending-hash-privacy-2026-03-01',
    'Exotiq Privacy Policy, effective 2026-03-01. See /privacy for the full text.'),
  ('aup',     '2026-03-01', '2026-03-01', '/acceptable-use',
    'pending-hash-aup-2026-03-01',
    'Exotiq Acceptable Use Policy, effective 2026-03-01. See /acceptable-use for the full text.')
ON CONFLICT (document_type, version) DO NOTHING;
