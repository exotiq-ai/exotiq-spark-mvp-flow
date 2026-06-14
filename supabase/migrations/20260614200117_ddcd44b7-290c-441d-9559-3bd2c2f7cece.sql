
-- 1. Immutability trigger on terms_acceptances
CREATE OR REPLACE FUNCTION public.prevent_terms_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'terms_acceptances rows are immutable (legal evidentiary record)';
END;
$$;

DROP TRIGGER IF EXISTS terms_acceptances_no_update ON public.terms_acceptances;
CREATE TRIGGER terms_acceptances_no_update
  BEFORE UPDATE ON public.terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_terms_acceptance_mutation();

DROP TRIGGER IF EXISTS terms_acceptances_no_delete ON public.terms_acceptances;
CREATE TRIGGER terms_acceptances_no_delete
  BEFORE DELETE ON public.terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_terms_acceptance_mutation();

-- 2. Reserve sms_opt_out event_type for STOP-reply revocations
ALTER TYPE public.terms_acceptance_event ADD VALUE IF NOT EXISTS 'sms_opt_out';

-- 3. Annotate hash provenance on legal_document_versions so auditors can distinguish
-- real SHA-256 from earlier placeholder hashes that pre-date our hashing pipeline.
ALTER TABLE public.legal_document_versions
  ADD COLUMN IF NOT EXISTS hash_algorithm text NOT NULL DEFAULT 'sha256';

-- Mark all historical rows whose hash is not a 64-char hex SHA-256 as legacy placeholders.
UPDATE public.legal_document_versions
SET hash_algorithm = 'legacy-placeholder'
WHERE length(content_hash) <> 64 OR content_hash !~ '^[a-f0-9]{64}$';
