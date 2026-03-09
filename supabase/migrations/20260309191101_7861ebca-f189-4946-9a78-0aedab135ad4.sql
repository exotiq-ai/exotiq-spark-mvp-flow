
-- Fix search_path for generate_doc_ref function
CREATE OR REPLACE FUNCTION generate_doc_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.doc_ref IS NULL THEN
    NEW.doc_ref := 'EXQ-DOC-' || EXTRACT(YEAR FROM NOW())::TEXT
      || '-' || LPAD(nextval('public.document_ref_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
