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
DO $$ DECLARE
 iss text:='https://issuer.example.invalid';aud text:='https://api.example.invalid/external-booking-api';
 op uuid:='a1400000-0000-4000-8000-000000000001';customer uuid:='c1400000-0000-4000-8000-000000000001';q public.external_quotes%ROWTYPE;
 receipt uuid;bid uuid;legacy_bid uuid;gid uuid;ref text;body jsonb;replay jsonb;claim jsonb;ctx jsonb;old_count int;recorded boolean;z record;
BEGIN
 SELECT * INTO q FROM public.external_create_quote('renter',customer,iss,aud,'agent-a',op,'b1400000-0000-4000-8000-000000000001','2035-01-01T10:00:00-05:00','2035-01-03T11:00:00-05:00','America/New_York','["premium"]');
 PERFORM public.external_hosted_authorize_quote_scopes(iss,'renter','hosted',aud,q.quote_id,q.terms_hash,'rental_requests:create',repeat('b',64),ARRAY['rental_requests:read','identity:handoff']);
 SELECT id INTO receipt FROM public.external_consent_receipts WHERE quote_id=q.quote_id;
 BEGIN PERFORM public.external_hosted_authorize_quote_scopes(iss,'renter','hosted',aud,q.quote_id,q.terms_hash,'rental_requests:create',repeat('b',64),ARRAY['rental_requests:read','checkout:handoff']);RAISE EXCEPTION 'receipt scopes changed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'consent_mismatch' THEN RAISE;END IF;END;
 body:=public.external_submit_rental_request_result_customer(iss,'renter','agent-a',aud,q.quote_id,receipt,'handoff-fixture-key-001','https://api.example.invalid/external-booking-api','https://customer.example.invalid');
 replay:=public.external_submit_rental_request_result_customer(iss,'renter','agent-a',aud,q.quote_id,receipt,'handoff-fixture-key-001','https://api.example.invalid/external-booking-api','https://changed-customer.example.invalid');
 IF body->'response' IS DISTINCT FROM replay->'response' OR body->'response'->'links'->>'customer_account' NOT LIKE 'https://customer.example.invalid/agent/account/%?ref=%' THEN RAISE EXCEPTION 'durable account link/replay mismatch';END IF;
 ref:=body->'response'->>'ref';SELECT id INTO bid FROM public.bookings WHERE booking_ref=ref;SELECT grant_id INTO gid FROM public.external_request_idempotency WHERE booking_id=bid;
 IF (SELECT action_scopes FROM public.external_booking_grants WHERE id=gid) IS DISTINCT FROM ARRAY['rental_requests:read','identity:handoff']::text[] THEN RAISE EXCEPTION 'grant scopes not explicit consent';END IF;
 INSERT INTO public.external_customer_handoffs(nonce_hash,issuer,subject,client_id,audience,customer_id,operator_id,booking_id,grant_id,action,mode,created_at,expires_at,provider_attempt_created_at)
 VALUES(repeat('f',64),iss,'renter','agent-a',aud,customer,op,bid,gid,'identity','test',now(),now()+interval '10 minutes',now()-interval '25 hours');
 BEGIN PERFORM public.external_create_customer_handoff(iss,'renter','agent-a',aud,ref,'identity',repeat('0',64),'test');RAISE EXCEPTION 'unknown old provider attempt age refreshed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE;END IF;END;
 DELETE FROM public.external_customer_handoffs WHERE nonce_hash=repeat('f',64);
 body:=public.external_create_customer_handoff(iss,'renter','agent-a',aud,ref,'identity',repeat('a',64),'test');
 IF (SELECT count(*) FROM public.identity_verifications WHERE customer_id=customer)<>0 THEN RAISE EXCEPTION 'nonce creation started identity';END IF;
 body:=public.external_review_customer_handoff(iss,'renter','hosted',aud,repeat('a',64));
 IF body->>'status'<>'pending_documents' OR body->>'operator_name'<>'agent-test handoff operator' OR body::text LIKE '%confirmation_token%' THEN RAISE EXCEPTION 'review authority/secret mismatch';END IF;
 FOR z IN SELECT * FROM (VALUES(iss,'other',aud),(iss,'renter','https://wrong.example.invalid'),('https://evil.example.invalid','renter',aud)) AS misses(issuer,subject,audience) LOOP
  BEGIN PERFORM public.external_review_customer_handoff(z.issuer,z.subject,'hosted',z.audience,repeat('a',64));RAISE EXCEPTION 'cross-owner nonce read';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 END LOOP;
 claim:=public.external_claim_customer_handoff(iss,'renter','hosted',aud,repeat('a',64));
 BEGIN PERFORM public.external_claim_customer_handoff(iss,'renter','hosted',aud,repeat('a',64));RAISE EXCEPTION 'parallel lease admitted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN PERFORM public.external_provider_handoff_context(repeat('a',64),gen_random_uuid(),'identity');RAISE EXCEPTION 'wrong lease admitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 recorded:=public.external_record_handoff_provider_session(repeat('a',64),(claim->>'claim_token')::uuid,'identity','vs_synthetic','test');
 IF recorded IS NOT TRUE OR NOT EXISTS(SELECT FROM public.identity_verifications WHERE stripe_verification_session_id='vs_synthetic' AND booking_ref=ref AND customer_id=customer AND status='created') THEN RAISE EXCEPTION 'identity record lacks exact booking provenance';END IF;
 body:=public.external_complete_customer_handoff(iss,'renter','hosted',aud,repeat('a',64),(claim->>'claim_token')::uuid,'vs_synthetic');
 BEGIN PERFORM public.external_claim_customer_handoff(iss,'renter','hosted',aud,repeat('a',64));RAISE EXCEPTION 'consumed nonce reused';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 body:=public.external_create_customer_handoff(iss,'renter','agent-a',aud,ref,'identity',repeat('c',64),'test');
 IF (SELECT provider_session_ref FROM public.external_customer_handoffs WHERE nonce_hash=repeat('c',64))<>'vs_synthetic' THEN RAISE EXCEPTION 'new nonce lost persisted provider retry';END IF;
 IF (SELECT provider_attempt_created_at FROM public.external_customer_handoffs WHERE nonce_hash=repeat('c',64)) IS DISTINCT FROM (SELECT provider_attempt_created_at FROM public.external_customer_handoffs WHERE nonce_hash=repeat('a',64)) THEN RAISE EXCEPTION 'nonce rotation refreshed provider attempt time';END IF;
 PERFORM public.external_revoke_booking_grant(gid,customer,iss,'renter','agent-a');
 BEGIN PERFORM public.external_review_customer_handoff(iss,'renter','hosted',aud,repeat('c',64));RAISE EXCEPTION 'revoked agent nonce admitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'grant_revoked' THEN RAISE;END IF;END;
 -- Customer owns existing request independently of revoked agent delegation.
 body:=public.external_customer_rental_status(iss,'renter','hosted',aud,ref);
 IF body->>'ref'<>ref THEN RAISE EXCEPTION 'customer stranded after revocation';END IF;
 body:=public.external_create_customer_owned_handoff(iss,'renter','hosted',aud,ref,'identity',repeat('d',64),'test');
 IF NOT EXISTS(SELECT FROM public.external_customer_handoffs WHERE nonce_hash=repeat('d',64) AND authority='customer_session' AND grant_id IS NULL) THEN RAISE EXCEPTION 'customer action expanded agent delegation';END IF;
 -- Independent explicit customer identity completion is represented by source
 -- verification evidence ONLY, not nonce/page/URL resolution.
 PERFORM public.external_apply_identity_event('evt_handoff_synthetic',floor(extract(epoch FROM clock_timestamp()))::bigint,'vs_synthetic','verified','2036-01-01','Synthetic Renter');
 UPDATE public.bookings SET status='pending_payment',payment_due_at=clock_timestamp()+interval '2 hours',payment_stripe_mode='test' WHERE id=bid;
 body:=public.external_create_customer_owned_handoff(iss,'renter','hosted',aud,ref,'checkout',repeat('e',64),'test');
 claim:=public.external_claim_customer_handoff(iss,'renter','hosted',aud,repeat('e',64));
 ctx:=public.external_provider_handoff_context(repeat('e',64),(claim->>'claim_token')::uuid,'checkout');
 BEGIN PERFORM public.external_reserve_rental_checkout(ref,'malformed-token','test','legacy','https://customer.example.invalid',NULL,NULL,'rent-checkout-'||ref||'-synthetic-due');RAISE EXCEPTION 'malformed UUID credential admitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 body:=public.external_reserve_rental_checkout(ref,claim->>'confirmation_token','test','external','https://customer.example.invalid',repeat('e',64),(claim->>'claim_token')::uuid,'rent-checkout-'||ref||'-synthetic-due');
 replay:=public.external_reserve_rental_checkout(ref,claim->>'confirmation_token','test','external','https://customer.example.invalid',repeat('e',64),(claim->>'claim_token')::uuid,'rent-checkout-'||ref||'-synthetic-due');
 IF body IS DISTINCT FROM replay THEN RAISE EXCEPTION 'checkout reservation not stable';END IF;
 IF body->>'provider_expires_at' IS NULL OR to_timestamp((body->>'provider_expires_at')::bigint)>(SELECT payment_due_at FROM public.bookings WHERE id=bid) THEN RAISE EXCEPTION 'provider lifetime exceeds payment authority';END IF;
 BEGIN PERFORM public.external_reserve_rental_checkout(ref,claim->>'confirmation_token','test','legacy','https://book.example.invalid',NULL,NULL,'rent-checkout-'||ref||'-synthetic-due');RAISE EXCEPTION 'parallel legacy checkout admitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE;END IF;END;
 -- A lost provider response leaves only its durable reservation: retain it
 -- even after the payment deadline and bounded worker pass.
 UPDATE public.bookings SET payment_due_at=clock_timestamp()-interval '1 minute' WHERE id=bid;
 PERFORM public.external_queue_unresolved_checkout_batch(1);
 UPDATE public.bookings SET status='payment_expired' WHERE id=bid;
 IF (SELECT status FROM public.bookings WHERE id=bid)<>'pending_payment' THEN RAISE EXCEPTION 'unknown checkout attempt released inventory';END IF;
 BEGIN UPDATE public.bookings SET rental_checkout_attempt_key=NULL WHERE id=bid;RAISE EXCEPTION 'two-step hold bypass admitted';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE public.bookings SET payment_due_at=clock_timestamp()+interval '2 hours' WHERE id=bid;
 -- Rollback-only fixture reset lets the remaining independent issued-session
 -- regression proceed. No production worker clears this reconciliation queue.
 DELETE FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=bid;
 PERFORM public.external_record_checkout_customer(bid,body->>'attempt_key','cus_synthetic');
 PERFORM public.external_record_checkout_session(bid,body->>'attempt_key','cs_test_synthetic');
 PERFORM public.external_record_handoff_provider_session(repeat('e',64),(claim->>'claim_token')::uuid,'checkout','cs_test_synthetic','test');
 -- A paid-near-deadline session can have NO webhook evidence yet. Direct
 -- expiration/cancellation must preserve occupancy for issued AND unknown
 -- checkout attempts, independent of a running scheduler or grace interval.
 UPDATE public.bookings SET status='payment_expired' WHERE id=bid;
 IF (SELECT status FROM public.bookings WHERE id=bid)<>'pending_payment' THEN RAISE EXCEPTION 'issued checkout released inventory before provider reconciliation';END IF;
 UPDATE public.bookings SET status='cancelled' WHERE id=bid;
 IF (SELECT status FROM public.bookings WHERE id=bid)<>'pending_payment' THEN RAISE EXCEPTION 'issued checkout cancellation released inventory';END IF;
 IF NOT EXISTS(SELECT FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=bid AND reason='ambiguous_charge') THEN RAISE EXCEPTION 'unresolved checkout missing manual review';END IF;
 BEGIN UPDATE public.bookings SET rental_checkout_session_ref=NULL WHERE id=bid;RAISE EXCEPTION 'issued session clearance admitted';EXCEPTION WHEN check_violation THEN NULL;END;
 -- A legacy booking has no external ledger FK. Its issued/ambiguous provider
 -- attempt must itself block deletion, rather than accidentally relying on a
 -- foreign key that exists only for API submissions.
 legacy_bid:=gen_random_uuid();
 INSERT INTO public.bookings SELECT (jsonb_populate_record(NULL::public.bookings,to_jsonb(b)||jsonb_build_object('id',legacy_bid,'booking_ref','LEGACYDELETE001','confirmation_token',gen_random_uuid(),'vehicle_id','b1400000-0000-4000-8000-000000000002','start_date','2035-03-01T15:00:00Z','end_date','2035-03-03T16:00:00Z'))).* FROM public.bookings b WHERE b.id=bid;
 IF EXISTS(SELECT FROM public.external_request_idempotency WHERE booking_id=legacy_bid) THEN RAISE EXCEPTION 'legacy delete fixture incorrectly has ledger';END IF;
 BEGIN DELETE FROM public.bookings WHERE id=legacy_bid;RAISE EXCEPTION 'legacy issued checkout deleted';EXCEPTION WHEN check_violation THEN IF SQLERRM<>'checkout_reservation_immutable' THEN RAISE;END IF;END;
 IF NOT EXISTS(SELECT FROM public.bookings WHERE id=legacy_bid AND public.agent_inventory_blocking(status)) THEN RAISE EXCEPTION 'legacy deletion lost occupied inventory';END IF;
 legacy_bid:=gen_random_uuid();
 INSERT INTO public.bookings SELECT (jsonb_populate_record(NULL::public.bookings,to_jsonb(b)||jsonb_build_object('id',legacy_bid,'booking_ref','LEGACYDELETE002','confirmation_token',gen_random_uuid(),'vehicle_id','b1400000-0000-4000-8000-000000000002','start_date','2035-04-01T15:00:00Z','end_date','2035-04-03T16:00:00Z','rental_checkout_attempt_key',NULL,'rental_checkout_session_ref',NULL))).* FROM public.bookings b WHERE b.id=bid;
 DELETE FROM public.bookings WHERE id=legacy_bid;
 IF EXISTS(SELECT FROM public.bookings WHERE id=legacy_bid) THEN RAISE EXCEPTION 'unreserved legacy delete incorrectly refused';END IF;
 UPDATE public.bookings SET operator_payment_intent_id='pi_partial' WHERE id=bid;
 BEGIN PERFORM public.external_complete_customer_handoff(iss,'renter','hosted',aud,repeat('e',64),(claim->>'claim_token')::uuid,'cs_test_synthetic');RAISE EXCEPTION 'partial payment fresh checkout allowed';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE;END IF;END;
 -- Legacy eight-argument consent still grants exactly its historical two scopes.
 SELECT * INTO q FROM public.external_create_quote('renter',customer,iss,aud,'agent-a',op,'b1400000-0000-4000-8000-000000000002','2035-02-01T10:00:00-05:00','2035-02-03T11:00:00-05:00','America/New_York','["premium"]');
 PERFORM public.external_hosted_authorize_quote(iss,'renter','hosted',aud,q.quote_id,q.terms_hash,'rental_requests:create',repeat('b',64));
 IF (SELECT action_scopes FROM public.external_consent_receipts WHERE quote_id=q.quote_id) IS DISTINCT FROM ARRAY['rental_requests:read','checkout:handoff']::text[] THEN RAISE EXCEPTION 'legacy implicit identity added';END IF;
 UPDATE public.external_customer_links SET revoked_at=clock_timestamp() WHERE issuer=iss AND subject='renter' AND operator_id=op;
 BEGIN PERFORM public.external_customer_rental_status(iss,'renter','hosted',aud,ref);RAISE EXCEPTION 'withdrawn customer binding admitted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'not_found' THEN RAISE;END IF;END;
 RAISE NOTICE 'PASS nonce owner/action/lease/single-use/provider continuity; explicit scopes/legacy defaults; customer continuity; checkout cross-flow reservation/partial-payment denial';
END $$;
DO $$ DECLARE f regprocedure;role_name text;BEGIN
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('external_create_customer_handoff','external_review_customer_handoff','external_claim_customer_handoff','external_provider_handoff_context','external_record_handoff_provider_session','external_complete_customer_handoff','external_customer_rental_status','external_create_customer_owned_handoff','external_reserve_rental_checkout','external_record_checkout_customer','external_record_checkout_session','external_hosted_authorize_quote_scopes','external_submit_rental_request_result_customer') LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP IF has_function_privilege(role_name,f,'EXECUTE') THEN RAISE EXCEPTION 'public execute:%:%',role_name,f;END IF;END LOOP;
  IF NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'narrow execute missing:%',f;END IF;
 END LOOP;
 IF has_table_privilege('service_role','public.external_customer_handoffs','INSERT') OR has_table_privilege('anon','public.external_customer_handoffs','SELECT') THEN RAISE EXCEPTION 'nonce raw authority widened';END IF;
END $$;
ROLLBACK;
