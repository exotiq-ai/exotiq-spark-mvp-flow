WITH t AS (
  SELECT 'Exotiq Terms and Conditions v2026-09-16: per-vehicle subscription pricing (Pro 1-15, Business 16-50, Enterprise 51+), 30-day free trial with payment method required, vehicle count recalculated at renewal, rate protection tied to the tier rate at activation.'::text AS body
)
INSERT INTO public.legal_document_versions (document_type, version, effective_date, url, content_text, content_hash, hash_algorithm, published_at)
SELECT 'terms', '2026-09-16', '2026-09-16', '/terms', t.body,
       encode(sha256(convert_to(t.body, 'UTF8')), 'hex'), 'sha256', now()
FROM t
ON CONFLICT DO NOTHING;