
-- 1. Human-readable document reference sequence
CREATE SEQUENCE IF NOT EXISTS document_ref_seq START 1;

-- 2. Add signing columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_ref TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS signing_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_default ON documents(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_documents_doc_ref ON documents(doc_ref);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_document_id);

-- 4. Auto-generate doc_ref trigger
CREATE OR REPLACE FUNCTION generate_doc_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.doc_ref IS NULL THEN
    NEW.doc_ref := 'EXQ-DOC-' || EXTRACT(YEAR FROM NOW())::TEXT
      || '-' || LPAD(nextval('document_ref_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_doc_ref ON documents;
CREATE TRIGGER set_doc_ref
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION generate_doc_ref();
