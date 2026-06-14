
INSERT INTO public.legal_document_versions (document_type, version, url, content_hash, effective_date, content_text)
VALUES
  ('terms'::public.legal_document_type,    '2026-06-14', '/terms',           '409c363010211008088c2187d960b65009099eaf48b6324ce6fc1b00ac132418', '2026-01-01', 'Exotiq Inc. Terms and Conditions v2026-06-14. Full text rendered at /terms; canonical hash recorded in content_hash.'),
  ('privacy'::public.legal_document_type,  '2026-06-14', '/privacy',         'db6a05844c14ba37d85b4331cd4256ac28235795eca61e6f8006e4cd8947033c', '2026-01-01', 'Exotiq Inc. Privacy Policy v2026-06-14. Full text rendered at /privacy; canonical hash recorded in content_hash.'),
  ('aup'::public.legal_document_type,      '2026-06-14', '/acceptable-use',  '72ec8a9782bd5eb26d73448096b3d3ff92f993672035e8714a07930fc34300b3', '2026-01-01', 'Exotiq Inc. Acceptable Use Policy v2026-06-14. Full text rendered at /acceptable-use; canonical hash recorded in content_hash.'),
  ('dpa'::public.legal_document_type,      '2026-06-14', '/data-processing', '7efe973fedddca1c893c3666dd0c7fa353c748dfaec3109c52aba67d51b67a16', '2026-01-01', 'Exotiq Inc. Data Processing Agreement v2026-06-14. Full text rendered at /data-processing; canonical hash recorded in content_hash.'),
  ('sms'::public.legal_document_type,      '2026-06-14', '/sms',             'a3ec3a0a8adba7f3601baa70fca80475fefb2b0189873c253ee57c80e9b97c8f', '2026-01-01', 'Exotiq Inc. SMS Policy v2026-06-14. Full text rendered at /sms; canonical hash recorded in content_hash.'),
  ('cookies'::public.legal_document_type,  '2026-06-14', '/cookies',         'a33da2a54e435e4df74d15ab2d54af3fd8a87fa15a61632ef3a59eeae9d2eafb', '2026-01-01', 'Exotiq Inc. Cookie Policy v2026-06-14. Full text rendered at /cookies; canonical hash recorded in content_hash.'),
  ('dmca'::public.legal_document_type,     '2026-06-14', '/dmca',            'd729c0d122ac7be7e17bef2faa8784e2a6c2363402b53517ba0cc25f13f9e537', '2026-01-01', 'Exotiq Inc. DMCA and Copyright Policy v2026-06-14. Full text rendered at /dmca; canonical hash recorded in content_hash.')
ON CONFLICT (document_type, version) DO NOTHING;
