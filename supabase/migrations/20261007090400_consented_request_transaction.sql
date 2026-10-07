-- Atomic consented request, durable replay and notification scheduling.
-- Does not start payment or confirm a rental. No public caller writes these tables.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Only obsolete retained 17-argument overload; no CASCADE. The audited18 signature
-- preserves original14 required parameters + defaults including return=pickup.
DROP FUNCTION IF EXISTS public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint);

CREATE TABLE public.external_request_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL, subject text NOT NULL, client_id text NOT NULL,
  customer_id uuid NOT NULL, operator_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation='rental_requests:create'),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  quote_id uuid NOT NULL REFERENCES public.external_quotes(quote_id),
  receipt_id uuid NOT NULL REFERENCES public.external_consent_receipts(id),
  booking_id uuid UNIQUE REFERENCES public.bookings(id),
  grant_id uuid REFERENCES public.external_booking_grants(id),
  response jsonb, response_status integer CHECK(response_status=201),
  committed_at timestamptz,
  retain_until timestamptz,
  UNIQUE(issuer,subject,client_id,operator_id,operation,idempotency_key),
  FOREIGN KEY(issuer,subject,operator_id,customer_id) REFERENCES public.external_customer_links(issuer,subject,operator_id,customer_id),
  CHECK((booking_id IS NULL)=(response IS NULL)),
  CHECK((booking_id IS NULL)=(committed_at IS NULL))
);
CREATE TABLE public.external_booking_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  event_type text NOT NULL CHECK(event_type='booking_request_received'),
  delivery_key text NOT NULL UNIQUE,
  notification_context jsonb NOT NULL CHECK(jsonb_typeof(notification_context)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  claimed_until timestamptz, claim_token uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
  delivered_at timestamptz, provider_message_id text,
  delivery_state text NOT NULL DEFAULT 'pending' CHECK(delivery_state IN('pending','delivered','manual_review')),
  UNIQUE(booking_id,event_type)
);
ALTER TABLE public.external_request_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_booking_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_request_idempotency, public.external_booking_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.external_request_idempotency, public.external_booking_outbox TO service_role;

CREATE FUNCTION public.external_submit_rental_request(
  _quote_id uuid,_receipt_id uuid,_idempotency_key text,_issuer text,_subject text,
  _client_id text,_customer_id uuid,_operator_id uuid,_audience text,_public_origin text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  ledger public.external_request_idempotency%ROWTYPE; q public.external_quotes%ROWTYPE;
  receipt public.external_consent_receipts%ROWTYPE; customer public.customers%ROWTYPE;
  team public.teams%ROWTYPE; vehicle public.vehicles%ROWTYPE;
  current_authority jsonb; bound_authority jsonb; canonical_hash text;
  initial_status text; created record; booking public.bookings%ROWTYPE; v_grant_id uuid;
  moment timestamptz; body jsonb; scope_list text[]:=ARRAY['rental_requests:read','checkout:handoff'];
BEGIN
  IF _quote_id IS NULL OR _receipt_id IS NULL OR _customer_id IS NULL OR _operator_id IS NULL
    OR _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR _issuer IS NULL OR length(_issuer) NOT BETWEEN 1 AND 500 OR _subject IS NULL OR length(_subject) NOT BETWEEN 1 AND 256
    OR _client_id IS NULL OR length(_client_id) NOT BETWEEN 1 AND 500 OR _audience IS NULL OR length(_audience) NOT BETWEEN 1 AND 2048
    OR _public_origin IS NULL OR _public_origin !~ '^https://[A-Za-z0-9.-]+(:443)?$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  -- Both root API composition and customer linkage are verified before this RPC.
  PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND customer_id=_customer_id AND operator_id=_operator_id AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  canonical_hash:=encode(sha256(convert_to(jsonb_build_object('quote_id',_quote_id,'receipt_id',_receipt_id,
    'issuer',_issuer,'subject',_subject,'client_id',_client_id,'customer_id',_customer_id,'operator_id',_operator_id,'audience',_audience)::text,'UTF8')),'hex');
  -- Completed immutable responses are concurrent reads, not another writer.
  -- Serializing every replay behind an exclusive advisory lock needlessly makes
  -- successful retry bursts exhaust backoff. Uncommitted rows remain invisible.
  SELECT * INTO ledger FROM public.external_request_idempotency WHERE issuer=_issuer AND subject=_subject AND client_id=_client_id
    AND operator_id=_operator_id AND operation='rental_requests:create' AND idempotency_key=_idempotency_key;
  IF FOUND THEN
    IF ledger.request_hash IS DISTINCT FROM canonical_hash OR ledger.customer_id IS DISTINCT FROM _customer_id THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    PERFORM 1 FROM public.external_booking_grants WHERE id=ledger.grant_id AND revoked_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ledger.response IS NULL THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001'; END IF;
    RETURN ledger.response;
  END IF;
  -- Nonwaiting lock avoids update/advisory deadlock and makes in-flight bounded.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('exotiq-request:'||jsonb_build_array(_issuer,_subject,_client_id,_operator_id,_idempotency_key)::text,0))
  THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001'; END IF;
  SELECT * INTO ledger FROM public.external_request_idempotency WHERE issuer=_issuer AND subject=_subject AND client_id=_client_id
    AND operator_id=_operator_id AND operation='rental_requests:create' AND idempotency_key=_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF ledger.request_hash IS DISTINCT FROM canonical_hash OR ledger.customer_id IS DISTINCT FROM _customer_id THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    IF ledger.response IS NULL THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001'; END IF;
    -- Ledger FIRST: lost-response replay works after quote expiry. Withdrawal
    -- still denies access, but cannot create a replacement booking.
    PERFORM 1 FROM public.external_booking_grants WHERE id=ledger.grant_id AND revoked_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
    RETURN ledger.response;
  END IF;
  SELECT * INTO q FROM public.external_quotes WHERE quote_id=_quote_id FOR UPDATE;
  IF NOT FOUND OR (q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.audience) IS DISTINCT FROM (_issuer,_subject,_client_id,_customer_id,_operator_id,_audience) THEN RAISE EXCEPTION 'not_found'; END IF;
  moment:=clock_timestamp();
  IF q.expires_at<=moment THEN RAISE EXCEPTION 'quote_expired'; END IF;
  IF q.consumed_booking_id IS NOT NULL THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
  SELECT * INTO receipt FROM public.external_consent_receipts WHERE id=_receipt_id FOR UPDATE;
  IF NOT FOUND OR (receipt.quote_id,receipt.issuer,receipt.subject,receipt.client_id,receipt.customer_id,receipt.operator_id,receipt.terms_hash,receipt.action)
    IS DISTINCT FROM (_quote_id,_issuer,_subject,_client_id,_customer_id,_operator_id,q.terms_hash,'rental_requests:create') OR receipt.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
  IF receipt.expires_at<=moment OR receipt.expires_at>q.expires_at THEN RAISE EXCEPTION 'consent_expired'; END IF;
  -- Lock quote/receipt BEFORE inserting their ledger foreign keys. Otherwise two
  -- different keys take shared FK locks then deadlock upgrading the same quote.
  INSERT INTO public.external_request_idempotency(issuer,subject,client_id,customer_id,operator_id,operation,idempotency_key,request_hash,quote_id,receipt_id)
    VALUES(_issuer,_subject,_client_id,_customer_id,_operator_id,'rental_requests:create',_idempotency_key,canonical_hash,_quote_id,_receipt_id) RETURNING * INTO ledger;
  PERFORM public.agent_inventory_lock(NULL,q.vehicle_id);
  current_authority:=public.external_quote_authority(q.operator_id,q.vehicle_id,q.pickup_at,q.return_at,q.timezone,q.selected_options);
  bound_authority:=jsonb_build_object('pricing',current_authority->'pricing','terms',current_authority->'terms','window',current_authority->'window','selected_options',current_authority->'selected_options');
  IF q.pricing_version IS DISTINCT FROM encode(sha256(convert_to((current_authority->'pricing')::text,'UTF8')),'hex')
    OR q.terms_hash IS DISTINCT FROM encode(sha256(convert_to(bound_authority::text,'UTF8')),'hex')
    OR q.terms_version IS DISTINCT FROM q.terms_hash
    OR q.authority-'availability_checked_at' IS DISTINCT FROM current_authority-'availability_checked_at' THEN RAISE EXCEPTION 'quote_changed'; END IF;
  SELECT * INTO customer FROM public.customers WHERE id=_customer_id AND team_id=_operator_id FOR SHARE;
  IF NOT FOUND OR customer.full_name IS NULL OR length(btrim(customer.full_name))<2 OR customer.email IS NULL OR customer.phone IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  -- Source18 writer chooses oldest same-tenant email. Never silently attach an
  -- authenticated renter to somebody else's duplicate legacy customer record.
  IF _customer_id IS DISTINCT FROM (SELECT id FROM public.customers WHERE team_id=_operator_id AND lower(email)=lower(customer.email) ORDER BY created_at,id LIMIT 1) THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
  -- Exact owned customer only; missing document expiry is UNKNOWN, never proof.
  PERFORM 1 FROM public.identity_verifications WHERE customer_id=_customer_id AND status='verified'
    AND document_expiry>(clock_timestamp() AT TIME ZONE q.timezone)::date FOR SHARE;
  initial_status:=CASE WHEN FOUND THEN 'requested' ELSE 'pending_documents' END;
  SELECT * INTO team FROM public.teams WHERE id=q.operator_id;
  SELECT * INTO vehicle FROM public.vehicles WHERE id=q.vehicle_id;
  SELECT * INTO created FROM public.create_marketplace_booking(team.slug,vehicle.slug,
    (q.pickup_at AT TIME ZONE q.timezone)::date,(q.return_at AT TIME ZONE q.timezone)::date,
    to_char(q.pickup_at AT TIME ZONE q.timezone,'HH24:MI:SS.MS'),customer.full_name,customer.email,customer.phone,
    (q.authority->'pricing'->>'daily_rate_cents')::numeric/100,
    (q.authority->'pricing'->>'operator_total_cents')::numeric/100,initial_status,q.selected_options->>0,
    (q.authority->'pricing'->>'platform_fee_cents')::bigint,(q.authority->'pricing'->>'protection_total_cents')::bigint,
    (q.authority->'pricing'->>'state_fee_cents')::bigint,(q.authority->'pricing'->>'processing_fee_cents')::bigint,
    (q.authority->'pricing'->>'operator_tax_cents')::bigint,to_char(q.return_at AT TIME ZONE q.timezone,'HH24:MI:SS.MS'));
  SELECT * INTO booking FROM public.bookings WHERE id=created.booking_id;
  IF (booking.customer_id,booking.team_id,booking.vehicle_id,booking.start_date,booking.end_date,booking.status)
    IS DISTINCT FROM (_customer_id,q.operator_id,q.vehicle_id,q.pickup_at,q.return_at,initial_status) THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
  PERFORM public.external_consume_consent_receipt(_receipt_id,_customer_id,_issuer,_subject,_client_id,_operator_id,_quote_id,q.terms_hash);
  UPDATE public.external_quotes SET consumed_booking_id=booking.id WHERE quote_id=q.quote_id;
  moment:=clock_timestamp();
  INSERT INTO public.external_booking_grants(issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,created_at,expires_at)
    VALUES(_issuer,_subject,_client_id,_customer_id,_operator_id,booking.id,scope_list,moment,moment+interval '24 hours') RETURNING id INTO v_grant_id;
  body:=jsonb_build_object('api_version','v1','source_checked_at',moment,'ref',booking.booking_ref,'status',initial_status,
    'next_action',CASE initial_status WHEN 'requested' THEN 'await_operator' ELSE 'verify_identity' END,
    'hold_expires_at',booking.created_at+CASE initial_status WHEN 'requested' THEN interval '72 hours' ELSE interval '24 hours' END,
    'links',jsonb_build_object('status',_public_origin||'/v1/rental-requests/'||booking.booking_ref));
  -- Freeze provider message inputs at commit. A retry with the same provider key
  -- must not use changed team names/status/terms or it becomes a different email.
  INSERT INTO public.external_booking_outbox(booking_id,event_type,delivery_key,notification_context)
  VALUES(booking.id,'booking_request_received','request-'||booking.booking_ref,
    jsonb_build_object('booking_ref',booking.booking_ref,'confirmation_token',booking.confirmation_token::text,
      'email',booking.customer_email,'customer_name',booking.customer_name,'operator_name',team.name,'vehicle_name',vehicle.name,
      'start_date',booking.start_date,'end_date',booking.end_date,'timezone',q.timezone,'currency',team.currency,
      'rental_total',booking.total_value::text,'status',initial_status,'pickup_location',booking.pickup_location,
      'support_email',team.support_email,'support_phone',team.support_phone));
  UPDATE public.external_request_idempotency SET booking_id=booking.id,grant_id=v_grant_id,response=body,response_status=201,committed_at=moment,
    retain_until=greatest(q.return_at,moment)+interval '30 days' WHERE id=ledger.id;
  RETURN body;
END $$;
REVOKE ALL ON FUNCTION public.external_submit_rental_request(uuid,uuid,text,text,text,text,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_submit_rental_request(uuid,uuid,text,text,text,text,uuid,uuid,text,text) TO service_role;

-- Worker leases commit before external SMTP/provider contact. No blanket claim
-- of exactly-once email: fixed keys use the reviewed provider dedupe window.
CREATE FUNCTION public.external_claim_booking_outbox(_limit integer DEFAULT 10)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.external_booking_outbox%ROWTYPE; moment timestamptz:=clock_timestamp();
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 -- After 23h or ten attempts, retrying an ambiguous provider outcome is manual.
 UPDATE public.external_booking_outbox SET delivery_state='manual_review' WHERE delivery_state='pending' AND delivered_at IS NULL AND (created_at+interval '23 hours'<=moment OR attempts>=10);
 FOR e IN SELECT * FROM public.external_booking_outbox WHERE delivery_state='pending' AND delivered_at IS NULL AND available_at<=moment AND (claimed_until IS NULL OR claimed_until<=moment) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT _limit LOOP
  UPDATE public.external_booking_outbox SET claim_token=gen_random_uuid(),claimed_until=moment+interval '2 minutes',attempts=attempts+1 WHERE id=e.id RETURNING * INTO e;
  RETURN NEXT jsonb_build_object('id',e.id,'bookingId',e.booking_id,'deliveryKey',e.delivery_key,'claimToken',e.claim_token,'createdAt',e.created_at);
 END LOOP;
END $$;
CREATE FUNCTION public.external_ack_booking_outbox(_id uuid,_claim_token uuid,_message_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF _message_id IS NULL OR length(_message_id) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 UPDATE public.external_booking_outbox SET delivered_at=clock_timestamp(),provider_message_id=_message_id,delivery_state='delivered',claimed_until=NULL
  WHERE id=_id AND claim_token=_claim_token AND delivered_at IS NULL AND delivery_state='pending';
 RETURN FOUND;
END $$;
CREATE FUNCTION public.external_retry_booking_outbox(_id uuid,_claim_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.external_booking_outbox SET claimed_until=NULL,claim_token=NULL,available_at=clock_timestamp()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer)) WHERE id=_id AND claim_token=_claim_token AND delivered_at IS NULL AND delivery_state='pending';
 RETURN FOUND;
END $$;
CREATE FUNCTION public.external_outbox_notification_context(_id uuid,_claim_token uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT e.notification_context FROM public.external_booking_outbox e
 WHERE e.id=_id AND e.claim_token=_claim_token AND e.claimed_until>clock_timestamp() AND e.delivered_at IS NULL AND e.delivery_state='pending'
$$;
REVOKE ALL ON FUNCTION public.external_claim_booking_outbox(integer),public.external_ack_booking_outbox(uuid,uuid,text),public.external_retry_booking_outbox(uuid,uuid),public.external_outbox_notification_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_claim_booking_outbox(integer),public.external_ack_booking_outbox(uuid,uuid,text),public.external_retry_booking_outbox(uuid,uuid),public.external_outbox_notification_context(uuid,uuid) TO service_role;
