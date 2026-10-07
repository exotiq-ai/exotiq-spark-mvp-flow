-- Synthetic request lab fixtures; direct owner inserts are TEST SETUP ONLY.
INSERT INTO public.state_rental_fees VALUES('FL',200,'agent-test FL fee');
INSERT INTO public.teams(id,name,owner_id,slug,marketplace_visible,marketplace_request_status,business_address,default_mileage_limit,default_mileage_overage_rate)
VALUES('10000000-0000-4000-8000-000000000001','agent-test Miami','10000000-0000-4000-8000-000000000099','agent-test-miami',true,'approved','{"region":"FL"}',100,2);
INSERT INTO public.vehicles(id,team_id,slug,name,current_rate,marketplace_visible)
SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','agent-test-vehicle-'||i,'agent-test Vehicle '||i,100,true FROM generate_series(1,5)i;
INSERT INTO public.customers(id,team_id,email,full_name,phone)
VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','agent-test-renter@example.invalid','agent-test Renter','2025550101');
INSERT INTO public.external_customer_links(issuer,subject,operator_id,customer_id,verified_at,verification_method)
VALUES('https://issuer.example.invalid','renter','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now(),'authenticated_customer_session');
CREATE TABLE public.lab_requests(ordinal integer PRIMARY KEY,quote_id uuid NOT NULL,receipt_id uuid NOT NULL);
DO $$ DECLARE q public.external_quotes%ROWTYPE; receipt uuid; i integer; BEGIN
 FOR i IN 1..5 LOOP
  SELECT * INTO q FROM public.external_create_quote('renter','30000000-0000-4000-8000-000000000001','https://issuer.example.invalid','https://api.example.invalid/v1','client-a','10000000-0000-4000-8000-000000000001',('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,date_trunc('day',now()+interval '30 days')+interval '15 hours',date_trunc('day',now()+interval '32 days')+interval '16 hours','America/New_York','["premium"]',900);
  INSERT INTO public.external_consent_receipts(issuer,subject,client_id,customer_id,operator_id,quote_id,terms_hash,action,csrf_nonce_hash,expires_at)
   VALUES(q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.quote_id,q.terms_hash,'rental_requests:create',repeat('a',64),q.expires_at) RETURNING id INTO receipt;
  INSERT INTO public.lab_requests VALUES(i,q.quote_id,receipt);
 END LOOP;
END $$;
