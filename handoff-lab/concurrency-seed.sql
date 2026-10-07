-- Actual marked partial PostgreSQL lab only. Synthetic fixtures roll back.
BEGIN;
CREATE TABLE public.lab_handoff_concurrency(ref text,old_global boolean);
INSERT INTO public.lab_handoff_concurrency(old_global) SELECT external_api_new_writes_enabled FROM public.external_api_runtime_settings WHERE singleton;

INSERT INTO public.state_rental_fees VALUES('FL',200,'agent-test FL') ON CONFLICT(state_code) DO UPDATE SET daily_cents=200;
INSERT INTO public.teams(id,name,owner_id,slug,marketplace_visible,marketplace_request_status,business_address)
VALUES('a1410000-0000-4000-8000-000000000001','agent-test handoff operator','a1410000-0000-4000-8000-000000000099','agent-test-handoff-concurrency',true,'approved','{"region":"FL"}');
INSERT INTO public.vehicles(id,team_id,slug,name,current_rate,marketplace_visible)
SELECT ('b1410000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'a1410000-0000-4000-8000-000000000001','agent-test-handoff-concurrency-car-'||i,'agent-test handoff car '||i,100,true FROM generate_series(1,2)i;
INSERT INTO public.customers(id,user_id,team_id,email,full_name,phone)
VALUES('c1410000-0000-4000-8000-000000000001','a1410000-0000-4000-8000-000000000099','a1410000-0000-4000-8000-000000000001','agent-test-handoff-concurrency@example.invalid','Synthetic Renter','2025550101');
UPDATE public.external_api_runtime_settings SET external_api_new_writes_enabled=true WHERE singleton;
INSERT INTO public.external_operator_api_settings(operator_id,external_api_enabled) VALUES('a1410000-0000-4000-8000-000000000001',true);
INSERT INTO public.external_customer_links(issuer,subject,operator_id,customer_id,verified_at,verification_method)
VALUES('https://issuer.example.invalid','renter','a1410000-0000-4000-8000-000000000001','c1410000-0000-4000-8000-000000000001',now(),'authenticated_customer_session');

DO $$ DECLARE q public.external_quotes%ROWTYPE;receipt uuid;body jsonb;
BEGIN
 SELECT * INTO q FROM public.external_create_quote('renter','c1410000-0000-4000-8000-000000000001','https://issuer.example.invalid','https://api.example.invalid/external-booking-api','agent-a','a1410000-0000-4000-8000-000000000001','b1410000-0000-4000-8000-000000000001','2035-01-01T10:00:00-05:00','2035-01-03T11:00:00-05:00','America/New_York','["premium"]');
 PERFORM public.external_hosted_authorize_quote_scopes(q.issuer,q.subject,'hosted',q.audience,q.quote_id,q.terms_hash,'rental_requests:create',repeat('b',64),ARRAY['rental_requests:read']);
 SELECT id INTO receipt FROM public.external_consent_receipts WHERE quote_id=q.quote_id;
 body:=public.external_submit_rental_request_result_customer(q.issuer,q.subject,q.client_id,q.audience,q.quote_id,receipt,'concurrent-handoff-key-001','https://api.example.invalid/external-booking-api','https://customer.example.invalid');
 UPDATE public.lab_handoff_concurrency SET ref=body->'response'->>'ref';
END $$;
COMMIT;
