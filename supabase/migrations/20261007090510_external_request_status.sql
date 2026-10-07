-- Current actor-bound request transport. No new booking writer or public grants.
CREATE FUNCTION public.external_submit_rental_request_result(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_receipt_id uuid,_idempotency_key text,_public_origin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE q public.external_quotes%ROWTYPE; existed boolean; body jsonb;
BEGIN
 IF _idempotency_key IS NULL OR _idempotency_key!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO q FROM public.external_quotes WHERE quote_id=_quote_id;
 IF NOT FOUND OR (q.issuer,q.subject,q.client_id,q.audience) IS DISTINCT FROM (_issuer,_subject,_client_id,_audience) THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT EXISTS(SELECT FROM public.external_request_idempotency WHERE issuer=_issuer AND subject=_subject AND client_id=_client_id AND operator_id=q.operator_id AND operation='rental_requests:create' AND idempotency_key=_idempotency_key) INTO existed;
 IF NOT existed THEN
  -- Same key as the original06 whole transaction. Reentrant xact lock prevents
  -- racing callers both claiming201 while preserving its immutable replay body.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('exotiq-request:'||jsonb_build_array(_issuer,_subject,_client_id,q.operator_id,_idempotency_key)::text,0)) THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001'; END IF;
  SELECT EXISTS(SELECT FROM public.external_request_idempotency WHERE issuer=_issuer AND subject=_subject AND client_id=_client_id AND operator_id=q.operator_id AND operation='rental_requests:create' AND idempotency_key=_idempotency_key) INTO existed;
 END IF;
 body:=public.external_submit_rental_request(_quote_id,_receipt_id,_idempotency_key,_issuer,_subject,_client_id,q.customer_id,q.operator_id,_audience,_public_origin);
 RETURN jsonb_build_object('created',NOT existed,'response',body);
END $$;

-- Reusable owner lookup, PRIVATE: no authority is established by ref possession.
CREATE FUNCTION public.external_request_owner(_issuer text,_subject text,_client_id text,_audience text,_ref text)
RETURNS public.external_request_idempotency LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE r public.external_request_idempotency%ROWTYPE;
BEGIN
 IF _ref IS NULL OR _ref!~'^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT r0.* INTO r FROM public.external_request_idempotency r0
  JOIN public.bookings b ON b.id=r0.booking_id AND b.customer_id=r0.customer_id AND b.team_id=r0.operator_id
  JOIN public.external_quotes q ON q.quote_id=r0.quote_id AND q.audience=_audience AND q.consumed_booking_id=b.id
  JOIN public.external_customer_links link ON (link.issuer,link.subject,link.operator_id,link.customer_id)=(r0.issuer,r0.subject,r0.operator_id,r0.customer_id) AND link.revoked_at IS NULL
  WHERE b.booking_ref=_ref AND (r0.issuer,r0.subject,r0.client_id)=(_issuer,_subject,_client_id) AND r0.committed_at IS NOT NULL FOR SHARE OF link;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 RETURN r;
END $$;

CREATE FUNCTION public.external_read_rental_request(_issuer text,_subject text,_client_id text,_audience text,_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE r public.external_request_idempotency%ROWTYPE; b public.bookings%ROWTYPE; g public.external_booking_grants%ROWTYPE;
 financial boolean; identity_ok boolean; both_paid boolean; operator_present boolean; exotiq_present boolean; operator_settled boolean; exotiq_settled boolean; moment timestamptz;
BEGIN
 r:=public.external_request_owner(_issuer,_subject,_client_id,_audience,_ref);
 SELECT * INTO b FROM public.bookings WHERE id=r.booking_id AND customer_id=r.customer_id AND team_id=r.operator_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO g FROM public.external_booking_grants WHERE booking_id=r.booking_id AND customer_id=r.customer_id AND operator_id=r.operator_id AND (issuer,subject,client_id)=(_issuer,_subject,_client_id)
  AND revoked_at IS NULL AND expires_at>clock_timestamp() AND 'rental_requests:read'=ANY(action_scopes) ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN
  SELECT * INTO g FROM public.external_booking_grants WHERE booking_id=r.booking_id AND customer_id=r.customer_id AND operator_id=r.operator_id AND (issuer,subject,client_id)=(_issuer,_subject,_client_id) AND 'rental_requests:read'=ANY(action_scopes) ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF g.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'grant_revoked'; END IF;
  RAISE EXCEPTION 'grant_expired';
 END IF;
 moment:=clock_timestamp();IF g.expires_at<=moment THEN RAISE EXCEPTION 'grant_expired';END IF;
 financial:=public.external_lifecycle_financial_authority(b.id);
 identity_ok:=public.external_lifecycle_identity_cleared(b.customer_id,b.end_date,b.team_id,b.id);
 both_paid:=public.external_lifecycle_fully_settled(b.id,b.payment_stripe_mode);
 operator_present:=coalesce(b.operator_payment_intent_id,'')<>'' OR b.paid_at IS NOT NULL OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id AND leg='operator');
 exotiq_present:=coalesce(b.exotiq_payment_intent_id,'')<>'' OR b.paid_at IS NOT NULL OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id AND leg='exotiq');
 operator_settled:=CASE WHEN both_paid IS TRUE THEN true WHEN NOT operator_present THEN false WHEN b.payment_stripe_mode IN('test','live') THEN
  (SELECT count(*)=1 AND min(amount_cents)=b.total_value*100 AND bool_and(currency='usd') FROM public.external_payment_settlements WHERE booking_id=b.id AND leg='operator' AND mode=b.payment_stripe_mode) ELSE NULL END;
 exotiq_settled:=CASE WHEN both_paid IS TRUE THEN true WHEN NOT exotiq_present THEN false WHEN b.payment_stripe_mode IN('test','live') THEN
  (SELECT count(*)=1 AND min(amount_cents)=b.platform_fee_cents+b.protection_total_cents+b.state_fee_cents+b.processing_fee_cents AND bool_and(currency='usd') FROM public.external_payment_settlements WHERE booking_id=b.id AND leg='exotiq' AND mode=b.payment_stripe_mode) ELSE NULL END;
 RETURN jsonb_build_object('ref',b.booking_ref,'source_checked_at',date_trunc('milliseconds',moment),'status',b.status,'authoritative',financial IS TRUE,'created_at',date_trunc('milliseconds',b.created_at),'pickup_at',date_trunc('milliseconds',b.start_date),'payment_due_at',date_trunc('milliseconds',b.payment_due_at),'identity_verified',identity_ok,
  'reconciliation_pending',EXISTS(SELECT FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=b.id),
  'operator_payment',jsonb_build_object('present',operator_present,'settled',operator_settled),'exotiq_payment',jsonb_build_object('present',exotiq_present,'settled',exotiq_settled));
END $$;

CREATE FUNCTION public.external_begin_request_grant_recovery(_issuer text,_subject text,_client_id text,_audience text,_ref text,_csrf_hash text,_customer_origin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE r public.external_request_idempotency%ROWTYPE; grant_id uuid;
BEGIN
 r:=public.external_request_owner(_issuer,_subject,_client_id,_audience,_ref);
 SELECT id INTO grant_id FROM public.external_booking_grants WHERE (issuer,subject,client_id,customer_id,operator_id,booking_id)=(_issuer,_subject,_client_id,r.customer_id,r.operator_id,r.booking_id) ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 RETURN public.external_begin_grant_recovery(_issuer,_subject,_client_id,_audience,grant_id,_csrf_hash,_customer_origin);
END $$;
REVOKE ALL ON FUNCTION public.external_request_owner(text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.external_submit_rental_request_result(text,text,text,text,uuid,uuid,text,text),public.external_read_rental_request(text,text,text,text,text),public.external_begin_request_grant_recovery(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_submit_rental_request_result(text,text,text,text,uuid,uuid,text,text),public.external_read_rental_request(text,text,text,text,text),public.external_begin_request_grant_recovery(text,text,text,text,text,text,text) TO service_role;

-- Function settings are hoisted per RPC transaction by PostgREST>=12.2. Actual
-- raw PostgreSQL checks prove bounded lock waits only; deployed version/config,
-- statement cancellation and pooled connection deadlines remain release gates.
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN(
  'external_submit_rental_request','external_resolve_customer_link','external_hosted_link_customer','external_review_quote','external_hosted_authorize_quote','external_quote_consent_result','external_hosted_revoke_grant','external_begin_grant_recovery','external_review_grant_renewal','external_hosted_review_grant_renewal','external_hosted_complete_grant_renewal','external_revoke_booking_grant','external_create_grant_renewal','external_complete_grant_renewal','external_consume_consent_receipt') LOOP
  EXECUTE format('ALTER FUNCTION %s SET lock_timeout = %L',f,'500ms');
  EXECUTE format('ALTER FUNCTION %s SET statement_timeout = %L',f,'4s');
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
