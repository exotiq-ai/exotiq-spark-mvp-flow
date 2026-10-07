DO $$ DECLARE f public.lab_requests%ROWTYPE; result jsonb; old_body jsonb; other public.lab_requests%ROWTYPE; BEGIN
 PERFORM pg_sleep(1.1);
 SELECT * INTO f FROM public.lab_requests WHERE ordinal=6;
 SELECT response INTO old_body FROM public.external_request_idempotency WHERE idempotency_key='lost-response-replay-001';
 result:=public.external_submit_rental_request(f.quote_id,f.receipt_id,'lost-response-replay-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
 IF result IS DISTINCT FROM old_body OR NOT EXISTS(SELECT 1 FROM public.external_quotes WHERE quote_id=f.quote_id AND expires_at<clock_timestamp()) THEN RAISE EXCEPTION 'expired quote replay not ledger-first'; END IF;
 SELECT * INTO other FROM public.lab_requests WHERE ordinal=2;
 BEGIN
  PERFORM public.external_submit_rental_request(other.quote_id,other.receipt_id,'lost-response-replay-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
  RAISE EXCEPTION 'changed payload same key accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'idempotency_conflict' THEN RAISE; END IF; END;
 UPDATE public.external_booking_grants SET revoked_at=clock_timestamp() WHERE booking_id=(SELECT booking_id FROM public.external_request_idempotency WHERE idempotency_key='lost-response-replay-001');
 BEGIN
  PERFORM public.external_submit_rental_request(f.quote_id,f.receipt_id,'lost-response-replay-001','https://issuer.example.invalid','renter','client-a','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','https://api.example.invalid/v1','https://api.example.invalid');
  RAISE EXCEPTION 'revoked grant replay exposed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS actual quote expiry/lost response committed replay, changed payload conflict and revoked-access denial';
END $$;
