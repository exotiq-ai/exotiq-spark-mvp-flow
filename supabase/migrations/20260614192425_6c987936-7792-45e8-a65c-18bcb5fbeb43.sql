INSERT INTO public.legal_document_versions (document_type, version, url, content_hash, effective_date, content_text)
VALUES (
  'dmca'::public.legal_document_type,
  '2026-01-01',
  '/dmca',
  'c0d8e47a35fb7082d03d0d32712ddac26620d5d42f1280a22713c5dc86fd01d2',
  '2026-01-01',
  'Exotiq Inc. DMCA and Copyright Policy v2026-01-01. Full text rendered at /dmca; canonical hash recorded in content_hash.'
)
ON CONFLICT (document_type, version) DO NOTHING;