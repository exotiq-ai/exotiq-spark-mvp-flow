-- A real committed ledger fixture; replay after actual short quote expiry.
DO $$ DECLARE q public.external_quotes%ROWTYPE; receipt uuid; before jsonb; after jsonb; BEGIN
 SELECT * INTO q FROM public.external_create_quote('renter','30000000-0000-4000-8000-000000000001','https://issuer.example.invalid','https://api.example.invalid/v1','client-a','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005',date_trunc('day',now()+interval '30 days')+interval '15 hours',date_trunc('day',now()+interval '32 days')+interval '16 hours','America/New_York','["premium"]',1);
 INSERT INTO public.external_consent_receipts(issuer,subject,client_id,customer_id,operator_id,quote_id,terms_hash,action,csrf_nonce_hash,expires_at)
  VALUES(q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.quote_id,q.terms_hash,'rental_requests:create',repeat('a',64),q.expires_at) RETURNING id INTO receipt;
 before:=public.external_submit_rental_request(q.quote_id,receipt,'lost-response-replay-001',q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.audience,'https://api.example.invalid');
 INSERT INTO public.lab_requests VALUES(6,q.quote_id,receipt);
END $$;
