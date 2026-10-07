-- Selected real source parity only. All fixture mutations roll back.
BEGIN;
DO $$ DECLARE f public.lab_requests%ROWTYPE; result jsonb; e jsonb; context jsonb; created record; i integer; BEGIN
 INSERT INTO public.identity_verifications(customer_id,status,document_expiry) VALUES('30000000-0000-4000-8000-000000000001','verified',current_date+90);
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=1;
 result:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'verified-request-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 IF result->>'status'<>'pending_documents' THEN RAISE EXCEPTION 'legacy unproven identity was reused'; END IF;
 UPDATE public.identity_verifications SET booking_ref=(SELECT b.booking_ref FROM public.bookings b JOIN public.external_request_idempotency l ON l.booking_id=b.id WHERE l.quote_id=f.quote_id),verified_at=clock_timestamp();
 UPDATE public.identity_verifications SET document_expiry=NULL;
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=2;
 result:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'unknown-expiry-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 IF result->>'status'<>'pending_documents' THEN RAISE EXCEPTION 'unknown expiry treated as verified'; END IF;
 UPDATE public.identity_verifications SET document_expiry=current_date-1;
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=3;
 result:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'expired-identity-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 IF result->>'status'<>'pending_documents' THEN RAISE EXCEPTION 'expired identity treated as verified'; END IF;
 -- Calls actually execute the retained source18 body with required/default and
 -- formerly ambiguous17 argument forms, plus explicit return-time18.
 SELECT * INTO created FROM public.create_marketplace_booking('agent-test-miami','agent-test-vehicle-4',current_date+90,current_date+92,'10:00 AM','agent-test Renter','agent-test-renter@example.invalid','2025550101',100,200,'pending_documents','premium',100::bigint,200::bigint);
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=created.booking_id AND end_date AT TIME ZONE 'America/New_York'=(current_date+92)::timestamp+interval '10 hours') THEN RAISE EXCEPTION 'default return differs from pickup'; END IF;
 SELECT * INTO created FROM public.create_marketplace_booking('agent-test-miami','agent-test-vehicle-4',current_date+95,current_date+97,'10:00 AM','agent-test Renter','agent-test-renter@example.invalid','2025550101',100,200,'pending_documents','premium',100::bigint,200::bigint,0::bigint,0::bigint,0::bigint);
 SELECT * INTO created FROM public.create_marketplace_booking('agent-test-miami','agent-test-vehicle-4',current_date+100,current_date+102,'10:00 AM','agent-test Renter','agent-test-renter@example.invalid','2025550101',100,200,'pending_documents','premium',100::bigint,200::bigint,0::bigint,0::bigint,0::bigint,'11:00 AM');
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=created.booking_id AND end_date AT TIME ZONE 'America/New_York'=(current_date+102)::timestamp+interval '11 hours') THEN RAISE EXCEPTION 'explicit return lost'; END IF;
 UPDATE teams SET name='agent-test Changed operator';
 SELECT value INTO e FROM public.external_claim_booking_outbox(1) value;
 context:=public.external_outbox_notification_context((e->>'id')::uuid,(e->>'claimToken')::uuid);
 IF context->>'operator_name'<>'agent-test Miami' OR context->>'confirmation_token' IS NULL THEN RAISE EXCEPTION 'provider context not frozen/internal'; END IF;
 IF public.external_ack_booking_outbox((e->>'id')::uuid,gen_random_uuid(),'wrong-lease') THEN RAISE EXCEPTION 'wrong claim acknowledged'; END IF;
 IF public.external_outbox_notification_context((e->>'id')::uuid,gen_random_uuid()) IS NOT NULL THEN RAISE EXCEPTION 'wrong claim read context'; END IF;
 IF NOT public.external_ack_booking_outbox((e->>'id')::uuid,(e->>'claimToken')::uuid,'sink-message') THEN RAISE EXCEPTION 'valid claim not acknowledged'; END IF;
 IF public.external_ack_booking_outbox((e->>'id')::uuid,(e->>'claimToken')::uuid,'sink-message') THEN RAISE EXCEPTION 'delivered event acknowledged twice'; END IF;
 UPDATE external_booking_outbox SET created_at=now()-interval '25 hours' WHERE delivered_at IS NULL;
 SELECT count(*) INTO i FROM public.external_claim_booking_outbox(10);
 IF i<>0 OR EXISTS(SELECT 1 FROM external_booking_outbox WHERE delivered_at IS NULL AND delivery_state<>'manual_review') THEN RAISE EXCEPTION 'unsafe late provider retry permitted'; END IF;
 RAISE NOTICE 'PASS verified/unknown/expired identity, source14/17/18 callers, immutable notification/claim/ack/manual-review';
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN UPDATE public.external_booking_outbox SET attempts=0; RAISE EXCEPTION 'service raw outbox DML permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.external_request_idempotency; RAISE EXCEPTION 'service raw ledger DML permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.external_claim_booking_outbox(1); RAISE EXCEPTION 'authenticated worker permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
