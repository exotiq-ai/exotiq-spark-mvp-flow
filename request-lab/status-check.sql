-- Actual PostgreSQL checks; all actor/customer/booking fixtures are synthetic.
BEGIN;
DO $$ DECLARE first jsonb; replay jsonb; result jsonb; ref text; bid uuid; gid uuid; next_grant uuid; x record;
BEGIN
 SELECT public.external_submit_rental_request_result('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',quote_id,receipt_id,'status-owned-key-001','https://api.example.invalid') INTO first FROM public.lab_requests WHERE ordinal=1;
 SELECT public.external_submit_rental_request_result('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',quote_id,receipt_id,'status-owned-key-001','https://api.example.invalid') INTO replay FROM public.lab_requests WHERE ordinal=1;
 IF first->'created'<>'true'::jsonb OR replay->'created'<>'false'::jsonb OR first->'response' IS DISTINCT FROM replay->'response' THEN RAISE EXCEPTION 'first/replay metadata incorrect';END IF;
 ref:=first->'response'->>'ref';SELECT id INTO bid FROM public.bookings WHERE booking_ref=ref;SELECT grant_id INTO gid FROM public.external_request_idempotency WHERE booking_id=bid;
 result:=public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);
 IF result->>'status'<>'pending_documents' OR result->'authoritative'<>'true'::jsonb OR result->'identity_verified'<>'false'::jsonb OR result->'operator_payment'->'present'<>'false'::jsonb THEN RAISE EXCEPTION 'current authoritative state incorrect:%',result;END IF;
 IF result::text LIKE '%confirmation_token%' OR result::text LIKE '%customer_email%' OR result::text LIKE '%client_secret%' THEN RAISE EXCEPTION 'secret disclosure';END IF;
 FOR x IN SELECT * FROM (VALUES ('https://evil.example.invalid','renter','client-a','https://api.example.invalid/v1'),('https://issuer.example.invalid','other','client-a','https://api.example.invalid/v1'),('https://issuer.example.invalid','renter','other','https://api.example.invalid/v1'),('https://issuer.example.invalid','renter','client-a','https://wrong.example.invalid')) AS misses(issuer,subject,client_id,audience) LOOP
  BEGIN PERFORM public.external_read_rental_request(x.issuer,x.subject,x.client_id,x.audience,ref);RAISE EXCEPTION 'cross-actor read allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
  BEGIN PERFORM public.external_begin_request_grant_recovery(x.issuer,x.subject,x.client_id,x.audience,ref,repeat('a',64),'https://customer.example.invalid');RAISE EXCEPTION 'cross-actor recovery allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 END LOOP;
 -- Intent ID/redirect/paid_at never produces settled authority.
 UPDATE public.bookings SET status='pending_payment',payment_due_at=clock_timestamp()+interval '2 hours',operator_payment_intent_id='pi_synthetic_pending',payment_stripe_mode='test' WHERE id=bid;
 result:=public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);
 IF result->'operator_payment'->'present'<>'true'::jsonb OR result->'operator_payment'->'settled'<>'false'::jsonb OR result->>'status'<>'pending_payment' THEN RAISE EXCEPTION 'intent reference became settlement';END IF;
 -- Known owner receives recoverable expiration, same ledger/booking persists.
 -- Fixture-only replacement respects grant immutability (no disabled trigger).
 INSERT INTO public.external_booking_grants(issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,created_at,expires_at) SELECT issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,now()-interval '25 hours',now()-interval '1 hour' FROM public.external_booking_grants WHERE id=gid RETURNING id INTO next_grant;
 UPDATE public.external_request_idempotency SET grant_id=next_grant WHERE booking_id=bid;DELETE FROM public.external_booking_grants WHERE id=gid;gid:=next_grant;
 BEGIN PERFORM public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);RAISE EXCEPTION 'expired grant read allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'grant_expired' THEN RAISE;END IF;END;
 result:=public.external_begin_request_grant_recovery('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref,repeat('a',64),'https://customer.example.invalid');
 IF result->>'state'<>'authorization_required' OR result->>'customer_url' NOT LIKE 'https://customer.example.invalid/agent/authorization/%' THEN RAISE EXCEPTION 'no concrete hosted renewal';END IF;
 IF EXISTS(SELECT FROM public.external_booking_grants WHERE booking_id=bid AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'recovery autoapproved';END IF;
 PERFORM public.external_revoke_booking_grant(gid,'30000000-0000-4000-8000-000000000001','https://issuer.example.invalid','renter','client-a');
 BEGIN PERFORM public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);RAISE EXCEPTION 'revoked grant read allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'grant_revoked' THEN RAISE;END IF;END;
 -- Simulated independently authorized fresh grant (SQL FIXTURE ONLY), never
 -- resurrection. Existing expired/revoked UUID remains withdrawn.
 INSERT INTO public.external_booking_grants(issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,expires_at) VALUES('https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',bid,ARRAY['rental_requests:read'],clock_timestamp()+interval '1 hour') RETURNING id INTO next_grant;
 PERFORM public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);
 IF NOT EXISTS(SELECT FROM public.external_booking_grants WHERE id=gid AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'old grant resurrected';END IF;
 IF (SELECT count(*) FROM public.bookings)<>1 OR (SELECT count(*) FROM public.external_booking_outbox)<>1 THEN RAISE EXCEPTION 'status/recovery created booking or email';END IF;
 UPDATE public.external_customer_links SET revoked_at=clock_timestamp() WHERE subject='renter';
 BEGIN PERFORM public.external_read_rental_request('https://issuer.example.invalid','renter','client-a','https://api.example.invalid/v1',ref);RAISE EXCEPTION 'revoked customer link allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
END $$;
DO $$ DECLARE f regprocedure; role_name text; BEGIN
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('external_submit_rental_request_result','external_read_rental_request','external_begin_request_grant_recovery') LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP IF has_function_privilege(role_name,f,'EXECUTE') THEN RAISE EXCEPTION 'public execute:%:%',role_name,f;END IF;END LOOP;
  IF NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'narrow service execute missing:%',f;END IF;
  IF NOT (SELECT proconfig @> ARRAY['lock_timeout=500ms','statement_timeout=4s'] FROM pg_proc WHERE oid=f) THEN RAISE EXCEPTION 'runtime timeout missing:%',f;END IF;
 END LOOP;
 IF has_function_privilege('service_role','public.external_request_owner(text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'private owner helper callable';END IF;
END $$;
ROLLBACK;
