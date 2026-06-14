-- Add transfer_addendum to the legal document type enum
ALTER TYPE public.legal_document_type ADD VALUE IF NOT EXISTS 'transfer_addendum';
