-- Explicit synthetic fixture cleanup, never arbitrary tenant selection.
BEGIN;
DELETE FROM public.external_customer_handoffs WHERE operator_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.external_booking_outbox WHERE booking_id IN(SELECT id FROM public.bookings WHERE team_id='a1410000-0000-4000-8000-000000000001');
DELETE FROM public.external_request_idempotency WHERE operator_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.external_booking_grants WHERE operator_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.external_consent_receipts WHERE operator_id='a1410000-0000-4000-8000-000000000001';
-- Superuser laboratory cleanup only: the production immutable quote trigger
-- correctly refuses DELETE. Its transactional disable is limited to this
-- exact synthetic tenant deletion and immediately restored before COMMIT.
ALTER TABLE public.external_quotes DISABLE TRIGGER external_quote_immutable;
DELETE FROM public.external_quotes WHERE operator_id='a1410000-0000-4000-8000-000000000001';
ALTER TABLE public.external_quotes ENABLE TRIGGER external_quote_immutable;
DELETE FROM public.bookings WHERE team_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.external_customer_links WHERE operator_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.customers WHERE team_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.vehicles WHERE team_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.external_operator_api_settings WHERE operator_id='a1410000-0000-4000-8000-000000000001';
DELETE FROM public.teams WHERE id='a1410000-0000-4000-8000-000000000001';
UPDATE public.external_api_runtime_settings SET external_api_new_writes_enabled=(SELECT old_global FROM public.lab_handoff_concurrency) WHERE singleton;
DROP TABLE public.lab_handoff_concurrency;
COMMIT;
