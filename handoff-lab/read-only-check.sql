-- Actual marked partial PostgreSQL lab only. Synthetic fixtures roll back.
BEGIN;
INSERT INTO public.state_rental_fees VALUES('FL',200,'agent-test FL') ON CONFLICT(state_code) DO UPDATE SET daily_cents=200;
INSERT INTO public.teams(id,name,owner_id,slug,marketplace_visible,marketplace_request_status,business_address)
VALUES('a1400000-0000-4000-8000-000000000001','agent-test handoff operator','a1400000-0000-4000-8000-000000000099','agent-test-handoff',true,'approved','{"region":"FL"}');
INSERT INTO public.vehicles(id,team_id,slug,name,current_rate,marketplace_visible)
SELECT ('b1400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'a1400000-0000-4000-8000-000000000001','agent-test-handoff-car-'||i,'agent-test handoff car '||i,100,true FROM generate_series(1,2)i;
INSERT INTO public.customers(id,user_id,team_id,email,full_name,phone)
VALUES('c1400000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000099','a1400000-0000-4000-8000-000000000001','agent-test-handoff@example.invalid','Synthetic Renter','2025550101');
UPDATE public.external_api_runtime_settings SET external_api_new_writes_enabled=true WHERE singleton;
INSERT INTO public.external_operator_api_settings(operator_id,external_api_enabled) VALUES('a1400000-0000-4000-8000-000000000001',true);
INSERT INTO public.external_customer_links(issuer,subject,operator_id,customer_id,verified_at,verification_method)
VALUES('https://issuer.example.invalid','renter','a1400000-0000-4000-8000-000000000001','c1400000-0000-4000-8000-000000000001',now(),'authenticated_customer_session');

DO $$ DECLARE q public.external_quotes%ROWTYPE;receipt uuid;body jsonb;bid uuid;gid uuid;ref text;
BEGIN
 SELECT * INTO q FROM public.external_create_quote('renter','c1400000-0000-4000-8000-000000000001','https://issuer.example.invalid','https://api.example.invalid/external-booking-api','agent-a','a1400000-0000-4000-8000-000000000001','b1400000-0000-4000-8000-000000000001','2035-01-01T10:00:00-05:00','2035-01-03T11:00:00-05:00','America/New_York','["premium"]');
 PERFORM public.external_hosted_authorize_quote_scopes(q.issuer,q.subject,'hosted',q.audience,q.quote_id,q.terms_hash,'rental_requests:create',repeat('b',64),ARRAY['rental_requests:read']);
 SELECT id INTO receipt FROM public.external_consent_receipts WHERE quote_id=q.quote_id;
 body:=public.external_submit_rental_request_result_customer(q.issuer,q.subject,q.client_id,q.audience,q.quote_id,receipt,'read-only-handoff-key-001','https://api.example.invalid/external-booking-api','https://customer.example.invalid');
 ref:=body->'response'->>'ref';SELECT id INTO bid FROM public.bookings WHERE booking_ref=ref;SELECT grant_id INTO gid FROM public.external_request_idempotency WHERE booking_id=bid;
 IF body->'response'->>'status'<>'pending_documents' OR (SELECT action_scopes FROM public.external_booking_grants WHERE id=gid) IS DISTINCT FROM ARRAY['rental_requests:read']::text[] THEN RAISE EXCEPTION 'read-only consent not retained';END IF;
 BEGIN PERFORM public.external_create_customer_handoff(q.issuer,q.subject,q.client_id,q.audience,ref,'identity',repeat('a',64),'test');RAISE EXCEPTION 'read-only agent gained identity';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 body:=public.external_create_customer_owned_handoff(q.issuer,q.subject,'hosted',q.audience,ref,'identity',repeat('c',64),'test');
 PERFORM public.external_revoke_booking_grant(gid,q.customer_id,q.issuer,q.subject,q.client_id);
 body:=public.external_review_customer_handoff(q.issuer,q.subject,'hosted',q.audience,repeat('c',64));
 IF body->>'status'<>'pending_documents' OR (SELECT action_scopes FROM public.external_booking_grants WHERE id=gid) IS DISTINCT FROM ARRAY['rental_requests:read']::text[] OR EXISTS(SELECT FROM public.identity_verifications WHERE customer_id=q.customer_id) THEN RAISE EXCEPTION 'customer action escalated agent or invoked provider';END IF;
 IF (SELECT count(*) FROM public.bookings WHERE team_id=q.operator_id)<>1 OR (SELECT count(*) FROM public.external_booking_outbox WHERE booking_id=bid)<>1 THEN RAISE EXCEPTION 'customer continuity duplicated request';END IF;
 RAISE NOTICE 'PASS read-only explicit consent, agent identity denied, customer existing-booking identity continuity without agent grant expansion or provider creation';
END $$;
ROLLBACK;
