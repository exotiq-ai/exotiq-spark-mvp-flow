ALTER TABLE public.tenant_document_audit DROP CONSTRAINT tenant_document_audit_event_type_check;
ALTER TABLE public.tenant_document_audit ADD CONSTRAINT tenant_document_audit_event_type_check
  CHECK (event_type = ANY (ARRAY['sent'::text, 'opened'::text, 'viewed_page'::text, 'scrolled_complete'::text, 'signed'::text, 'downloaded'::text, 'voided'::text, 'email_sent'::text, 'email_failed'::text]));