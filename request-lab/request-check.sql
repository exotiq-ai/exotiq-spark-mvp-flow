-- Real SQL rollback/error/replay/authority checks; fixture writes rollback.
BEGIN;
DO $$ DECLARE f public.lab_requests%ROWTYPE; result jsonb; replay jsonb; before_bookings integer; before_ledger integer; BEGIN
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=1;
 result:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'atomic-retry-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 replay:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'atomic-retry-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 IF result IS DISTINCT FROM replay OR result->>'status'<>'pending_documents' OR result->>'confirmation_token' IS NOT NULL THEN RAISE EXCEPTION 'same-key safe replay failed'; END IF;
 BEGIN
  PERFORM public.external_submit_rental_request(f.quote_id,f.receipt_id,'atomic-other-key-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
  RAISE EXCEPTION 'same receipt second key created booking';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'consent_mismatch' THEN RAISE; END IF; END;
 SELECT count(*) INTO before_bookings FROM bookings; SELECT count(*) INTO before_ledger FROM external_request_idempotency;
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=2;
 -- Deliberate downstream error AFTER booking creation forces transaction rollback.
 BEGIN
  CREATE TEMP TABLE lab_unique_outbox(delivery_key text UNIQUE);
  CREATE FUNCTION pg_temp.fail_after_booking() RETURNS trigger LANGUAGE plpgsql AS $inner$ BEGIN RAISE EXCEPTION 'lab injected after booking'; END $inner$;
  CREATE TRIGGER lab_fail_outbox BEFORE INSERT ON public.external_booking_outbox FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_after_booking();
  PERFORM public.external_submit_rental_request(f.quote_id,f.receipt_id,'atomic-rollback-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
  RAISE EXCEPTION 'injected failure did not occur';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'lab injected after booking' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM bookings)<>before_bookings OR (SELECT count(*) FROM external_request_idempotency)<>before_ledger
  OR EXISTS(SELECT 1 FROM external_quotes WHERE quote_id=f.quote_id AND consumed_booking_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM external_consent_receipts WHERE id=f.receipt_id AND consumed_at IS NOT NULL) THEN RAISE EXCEPTION 'rollback left booking/ledger/consumption debris'; END IF;
 -- Actual authoritative change cannot be silently accepted.
 UPDATE public.vehicles SET current_rate=101 WHERE id='20000000-0000-4000-8000-000000000002';
 BEGIN
  PERFORM public.external_submit_rental_request(f.quote_id,f.receipt_id,'atomic-price-change-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
  RAISE EXCEPTION 'price changed silently';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'quote_changed' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS same-key replay, receipt one-use, request status, rollback and price-change rejection';
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.external_request_idempotency; RAISE EXCEPTION 'anon ledger allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.external_submit_rental_request(NULL,NULL,'atomic-denied-key-001','https://issuer.example.invalid','renter','client-a',NULL,NULL,'https://api.example.invalid/v1','https://api.example.invalid'); RAISE EXCEPTION 'anon request RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
