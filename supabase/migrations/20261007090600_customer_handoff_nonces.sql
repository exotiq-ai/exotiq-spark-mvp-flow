-- Closed customer rendezvous; provider URLs/client secrets never persist here.
ALTER TABLE public.external_consent_receipts ADD COLUMN action_scopes text[] NOT NULL DEFAULT ARRAY['rental_requests:read','checkout:handoff']::text[];
ALTER TABLE public.external_consent_receipts ADD CONSTRAINT external_receipt_action_scopes CHECK(cardinality(action_scopes) BETWEEN 1 AND 3 AND action_scopes <@ ARRAY['rental_requests:read','checkout:handoff','identity:handoff']::text[]);
ALTER TABLE public.external_booking_grants DROP CONSTRAINT external_booking_grants_action_scopes_check;
ALTER TABLE public.external_booking_grants ADD CONSTRAINT external_booking_grants_action_scopes_check CHECK(cardinality(action_scopes) BETWEEN 1 AND 3 AND action_scopes <@ ARRAY['rental_requests:read','checkout:handoff','identity:handoff']::text[]);
ALTER TABLE public.external_grant_renewals DROP CONSTRAINT external_grant_renewals_action_scopes_check;
ALTER TABLE public.external_grant_renewals ADD CONSTRAINT external_grant_renewals_action_scopes_check CHECK(cardinality(action_scopes) BETWEEN 1 AND 3 AND action_scopes <@ ARRAY['rental_requests:read','checkout:handoff','identity:handoff']::text[]);

CREATE TABLE public.external_customer_handoffs(
 nonce_hash text PRIMARY KEY CHECK(nonce_hash~'^[a-f0-9]{64}$'),issuer text NOT NULL,subject text NOT NULL,client_id text NOT NULL,audience text NOT NULL,
 customer_id uuid NOT NULL,operator_id uuid NOT NULL,booking_id uuid NOT NULL,grant_id uuid,
 authority text NOT NULL DEFAULT 'agent_grant' CHECK(authority IN('agent_grant','customer_session')),
 CHECK((authority='agent_grant' AND grant_id IS NOT NULL) OR (authority='customer_session' AND grant_id IS NULL)),
 action text NOT NULL CHECK(action IN('identity','checkout')),mode text NOT NULL CHECK(mode IN('test','live')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,consumed_at timestamptz,revoked_at timestamptz,
 provider_session_ref text,provider_attempt_key uuid NOT NULL DEFAULT gen_random_uuid(),provider_attempt_created_at timestamptz NOT NULL DEFAULT clock_timestamp(),provider_recorded_at timestamptz,
 claim_token uuid,claimed_until timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '10 minutes'),
 CHECK(provider_session_ref IS NULL OR (action='identity' AND provider_session_ref~'^vs_[A-Za-z0-9]+$') OR (action='checkout' AND provider_session_ref~'^cs_(test_|live_)?[A-Za-z0-9]+$')),
 FOREIGN KEY(grant_id,issuer,subject,client_id,customer_id,operator_id,booking_id) REFERENCES public.external_booking_grants(id,issuer,subject,client_id,customer_id,operator_id,booking_id)
);
CREATE UNIQUE INDEX external_customer_handoffs_active_scope ON public.external_customer_handoffs(issuer,subject,client_id,booking_id,action) WHERE revoked_at IS NULL;
ALTER TABLE public.external_customer_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_customer_handoffs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.external_customer_handoffs TO service_role;

-- PRIVATE context guard shared by browser lease and internal provider bridge.
CREATE FUNCTION public.external_handoff_context(_issuer text,_subject text,_audience text,_nonce_hash text,_check_action boolean)
RETURNS public.external_customer_handoffs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;b public.bookings%ROWTYPE;g public.external_booking_grants%ROWTYPE;moment timestamptz;
BEGIN
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash;
 IF NOT FOUND OR (h.issuer,h.subject,h.audience) IS DISTINCT FROM (_issuer,_subject,_audience) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE (issuer,subject,operator_id,customer_id)=(h.issuer,h.subject,h.operator_id,h.customer_id) AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 -- Mutating leases serialize booking-first; concurrent claims never upgrade two
 -- shared nonce locks while each waits for the other's booking lock.
 IF _check_action THEN
  SELECT * INTO b FROM public.bookings WHERE id=h.booking_id AND customer_id=h.customer_id AND team_id=h.operator_id FOR UPDATE;
 ELSE
  SELECT * INTO b FROM public.bookings WHERE id=h.booking_id AND customer_id=h.customer_id AND team_id=h.operator_id FOR SHARE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash FOR SHARE;
 moment:=clock_timestamp();
 IF h.authority='agent_grant' THEN
  SELECT * INTO g FROM public.external_booking_grants WHERE id=h.grant_id AND (issuer,subject,client_id,customer_id,operator_id,booking_id)=(h.issuer,h.subject,h.client_id,h.customer_id,h.operator_id,h.booking_id) FOR SHARE;
  IF NOT FOUND OR NOT ((h.action||':handoff')=ANY(g.action_scopes)) THEN RAISE EXCEPTION 'not_found';END IF;
  IF g.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'grant_revoked';END IF;
  IF g.expires_at<=moment THEN RAISE EXCEPTION 'grant_expired';END IF;
 END IF;
 IF h.revoked_at IS NOT NULL OR h.consumed_at IS NOT NULL OR h.expires_at<=moment THEN RAISE EXCEPTION 'not_found';END IF;
 IF _check_action THEN
  IF NOT public.external_lifecycle_financial_authority(b.id) THEN RAISE EXCEPTION 'forbidden';END IF;
  IF h.action='identity' THEN
   IF EXISTS(SELECT FROM public.identity_verifications WHERE customer_id=b.customer_id AND (status='manual_review' OR attempt_count>=3)) THEN RAISE EXCEPTION 'forbidden';END IF;
   IF b.status NOT IN('pending_documents','pending_payment') OR public.external_lifecycle_identity_cleared(b.customer_id,b.end_date,b.team_id,b.id) THEN RAISE EXCEPTION 'forbidden';END IF;
   IF b.status='pending_documents' AND b.created_at+interval '24 hours'<=moment AND b.paid_at IS NULL AND coalesce(b.operator_payment_intent_id,'')='' AND coalesce(b.exotiq_payment_intent_id,'')='' AND NOT EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id) THEN RAISE EXCEPTION 'payment_window_expired';END IF;
  ELSE
   IF b.status<>'pending_payment' OR NOT public.external_lifecycle_identity_cleared(b.customer_id,b.end_date,b.team_id,b.id) THEN RAISE EXCEPTION 'forbidden';END IF;
   IF b.payment_due_at IS NULL OR b.payment_due_at<=moment THEN RAISE EXCEPTION 'payment_window_expired';END IF;
   IF b.paid_at IS NOT NULL OR coalesce(b.operator_payment_intent_id,'')<>'' OR coalesce(b.exotiq_payment_intent_id,'')<>'' OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id) OR EXISTS(SELECT FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=b.id) THEN RAISE EXCEPTION 'forbidden';END IF;
   IF b.total_value*100 NOT BETWEEN 50 AND 99999999 OR b.total_value*100<>trunc(b.total_value*100) OR (b.payment_stripe_mode IS NOT NULL AND b.payment_stripe_mode<>h.mode) THEN RAISE EXCEPTION 'forbidden';END IF;
  END IF;
 END IF;
 RETURN h;
END $$;

CREATE FUNCTION public.external_create_customer_handoff(_issuer text,_subject text,_client_id text,_audience text,_ref text,_action text,_nonce_hash text,_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE r public.external_request_idempotency%ROWTYPE;b public.bookings%ROWTYPE;g public.external_booking_grants%ROWTYPE;old public.external_customer_handoffs%ROWTYPE;h public.external_customer_handoffs%ROWTYPE;moment timestamptz;
BEGIN
 IF _action IS NULL OR _action NOT IN('identity','checkout') OR _nonce_hash IS NULL OR _nonce_hash!~'^[a-f0-9]{64}$' OR _mode IS NULL OR _mode NOT IN('test','live') THEN RAISE EXCEPTION 'invalid_input';END IF;
 r:=public.external_request_owner(_issuer,_subject,_client_id,_audience,_ref);
 SELECT * INTO b FROM public.bookings WHERE id=r.booking_id FOR UPDATE;
 SELECT * INTO g FROM public.external_booking_grants WHERE (issuer,subject,client_id,customer_id,operator_id,booking_id)=(_issuer,_subject,_client_id,r.customer_id,r.operator_id,r.booking_id) AND (_action||':handoff')=ANY(action_scopes) AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN
  SELECT * INTO g FROM public.external_booking_grants WHERE (issuer,subject,client_id,customer_id,operator_id,booking_id)=(_issuer,_subject,_client_id,r.customer_id,r.operator_id,r.booking_id) AND (_action||':handoff')=ANY(action_scopes) ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
  IF g.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'grant_revoked';END IF;RAISE EXCEPTION 'grant_expired';
 END IF;
 moment:=clock_timestamp();
 SELECT * INTO old FROM public.external_customer_handoffs WHERE (issuer,subject,customer_id,booking_id,action)=(_issuer,_subject,b.customer_id,b.id,_action) AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND old.claimed_until>moment THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001';END IF;
 IF FOUND AND (old.mode<>_mode OR old.provider_recorded_at IS NULL AND old.provider_attempt_created_at+interval '23 hours'<=moment) THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE public.external_customer_handoffs SET revoked_at=moment WHERE nonce_hash=old.nonce_hash;
 INSERT INTO public.external_customer_handoffs(nonce_hash,issuer,subject,client_id,audience,customer_id,operator_id,booking_id,grant_id,action,mode,created_at,expires_at,provider_session_ref,provider_attempt_key,provider_recorded_at,provider_attempt_created_at)
 VALUES(_nonce_hash,_issuer,_subject,_client_id,_audience,r.customer_id,r.operator_id,b.id,g.id,_action,_mode,moment,least(moment+interval '10 minutes',g.expires_at),old.provider_session_ref,coalesce(old.provider_attempt_key,gen_random_uuid()),old.provider_recorded_at,coalesce(old.provider_attempt_created_at,moment)) RETURNING * INTO h;
 PERFORM public.external_handoff_context(_issuer,_subject,_audience,_nonce_hash,true);
 RETURN jsonb_build_object('source_checked_at',date_trunc('milliseconds',moment),'expires_at',date_trunc('milliseconds',h.expires_at),'status',b.status);
END $$;

CREATE FUNCTION public.external_review_customer_handoff(_issuer text,_subject text,_client_id text,_audience text,_nonce_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;b public.bookings%ROWTYPE;opname text;vname text;
BEGIN
 h:=public.external_handoff_context(_issuer,_subject,_audience,_nonce_hash,false);
 SELECT * INTO b FROM public.bookings WHERE id=h.booking_id;SELECT name INTO opname FROM public.teams WHERE id=h.operator_id;SELECT name INTO vname FROM public.vehicles WHERE id=b.vehicle_id AND team_id=h.operator_id;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',clock_timestamp()),'ref',b.booking_ref,'operator_name',opname,'vehicle_name',vname,'action',h.action,'status',b.status,'expires_at',date_trunc('milliseconds',h.expires_at));
END $$;

CREATE FUNCTION public.external_claim_customer_handoff(_issuer text,_subject text,_client_id text,_audience text,_nonce_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;b public.bookings%ROWTYPE;moment timestamptz;
BEGIN
 h:=public.external_handoff_context(_issuer,_subject,_audience,_nonce_hash,true);
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash FOR UPDATE;
 moment:=clock_timestamp();IF h.claimed_until>moment THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001';END IF;
 UPDATE public.external_customer_handoffs SET claim_token=gen_random_uuid(),claimed_until=least(moment+interval '2 minutes',expires_at) WHERE nonce_hash=_nonce_hash RETURNING * INTO h;
 SELECT * INTO b FROM public.bookings WHERE id=h.booking_id;
 RETURN jsonb_build_object('nonce_hash',h.nonce_hash,'claim_token',h.claim_token,'action',h.action,'booking_ref',b.booking_ref,'confirmation_token',b.confirmation_token,'provider_session_ref',h.provider_session_ref,'provider_attempt_key',h.provider_attempt_key,'mode',h.mode,'expires_at',date_trunc('milliseconds',h.expires_at));
END $$;

CREATE FUNCTION public.external_provider_handoff_context(_nonce_hash text,_claim_token uuid,_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;b public.bookings%ROWTYPE;
BEGIN
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 h:=public.external_handoff_context(h.issuer,h.subject,h.audience,_nonce_hash,true);
 IF (h.claim_token,h.action) IS DISTINCT FROM (_claim_token,_action) OR h.claimed_until<=clock_timestamp() THEN RAISE EXCEPTION 'not_found';END IF;
 SELECT * INTO b FROM public.bookings WHERE id=h.booking_id;
 RETURN jsonb_build_object('booking_id',b.id,'booking_ref',b.booking_ref,'customer_id',h.customer_id,'operator_id',h.operator_id,'mode',h.mode,'provider_session_ref',h.provider_session_ref,'provider_attempt_key',h.provider_attempt_key,'expires_at',date_trunc('milliseconds',h.expires_at));
END $$;

CREATE FUNCTION public.external_record_handoff_provider_session(_nonce_hash text,_claim_token uuid,_action text,_provider_session_ref text,_mode text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;context jsonb;b public.bookings%ROWTYPE;
BEGIN
 context:=public.external_provider_handoff_context(_nonce_hash,_claim_token,_action);
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash FOR UPDATE;
 IF _mode IS DISTINCT FROM h.mode OR _provider_session_ref IS NULL OR (_action='identity' AND _provider_session_ref!~'^vs_[A-Za-z0-9]+$') OR (_action='checkout' AND _provider_session_ref!~'^cs_(test_|live_)?[A-Za-z0-9]+$') OR (h.provider_session_ref IS NOT NULL AND h.provider_session_ref<>_provider_session_ref) THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE public.external_customer_handoffs SET provider_session_ref=_provider_session_ref,provider_recorded_at=coalesce(provider_recorded_at,clock_timestamp()) WHERE nonce_hash=_nonce_hash;
 IF _action='identity' THEN
  SELECT * INTO b FROM public.bookings WHERE id=h.booking_id;
  IF EXISTS(SELECT FROM public.identity_verifications WHERE stripe_verification_session_id=_provider_session_ref AND (customer_id,booking_ref) IS DISTINCT FROM (h.customer_id,b.booking_ref)) THEN RAISE EXCEPTION 'not_found';END IF;
  IF NOT EXISTS(SELECT FROM public.identity_verifications WHERE stripe_verification_session_id=_provider_session_ref) THEN
   INSERT INTO public.identity_verifications(customer_id,stripe_verification_session_id,status,booking_ref) VALUES(h.customer_id,_provider_session_ref,'created',b.booking_ref);
   UPDATE public.customers SET identity_session_id=_provider_session_ref,identity_status='created' WHERE id=h.customer_id;
  END IF;
 END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.external_complete_customer_handoff(_issuer text,_subject text,_client_id text,_audience text,_nonce_hash text,_claim_token uuid,_provider_session_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;moment timestamptz;
BEGIN
 h:=public.external_handoff_context(_issuer,_subject,_audience,_nonce_hash,true);
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash FOR UPDATE;
 IF (h.claim_token,h.provider_session_ref) IS DISTINCT FROM (_claim_token,_provider_session_ref) OR h.claimed_until<=clock_timestamp() THEN RAISE EXCEPTION 'not_found';END IF;
 moment:=clock_timestamp();UPDATE public.external_customer_handoffs SET consumed_at=coalesce(consumed_at,moment),claimed_until=NULL,claim_token=NULL WHERE nonce_hash=_nonce_hash;
 RETURN jsonb_build_object('source_checked_at',date_trunc('milliseconds',moment),'expires_at',date_trunc('milliseconds',h.expires_at));
END $$;

REVOKE ALL ON FUNCTION public.external_handoff_context(text,text,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.external_create_customer_handoff(text,text,text,text,text,text,text,text),public.external_review_customer_handoff(text,text,text,text,text),public.external_claim_customer_handoff(text,text,text,text,text),public.external_provider_handoff_context(text,uuid,text),public.external_record_handoff_provider_session(text,uuid,text,text,text),public.external_complete_customer_handoff(text,text,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_create_customer_handoff(text,text,text,text,text,text,text,text),public.external_review_customer_handoff(text,text,text,text,text),public.external_claim_customer_handoff(text,text,text,text,text),public.external_provider_handoff_context(text,uuid,text),public.external_record_handoff_provider_session(text,uuid,text,text,text),public.external_complete_customer_handoff(text,text,text,text,text,uuid,text) TO service_role;

-- Explicit consent scopes; the historical eight-argument signature retains its
-- original two scopes and never silently adds identity authority.
CREATE FUNCTION public.external_hosted_authorize_quote_scopes(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_terms_hash text,_action text,_csrf_hash text,_action_scopes text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE q public.external_quotes%ROWTYPE; r public.external_consent_receipts%ROWTYPE; authority jsonb; bound jsonb; moment timestamptz;
BEGIN
 IF _action_scopes IS NULL OR cardinality(_action_scopes) NOT BETWEEN 1 AND 3 OR NOT (_action_scopes <@ ARRAY['rental_requests:read','checkout:handoff','identity:handoff']::text[]) OR cardinality(_action_scopes)<>(SELECT count(DISTINCT x) FROM unnest(_action_scopes) x) THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF _csrf_hash IS NULL OR _csrf_hash!~'^[a-f0-9]{64}$' OR _action IS DISTINCT FROM 'rental_requests:create' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO q FROM public.external_quotes WHERE quote_id=_quote_id FOR UPDATE;
 IF NOT FOUND OR (q.issuer,q.subject,q.audience) IS DISTINCT FROM (_issuer,_subject,_audience) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=q.operator_id AND customer_id=q.customer_id AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 moment:=clock_timestamp();
 IF q.expires_at<=moment OR q.operator_name IS NULL OR q.vehicle_name IS NULL THEN RAISE EXCEPTION 'quote_expired'; END IF;
 IF q.consumed_booking_id IS NOT NULL THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 IF q.terms_hash IS DISTINCT FROM _terms_hash THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 authority:=public.external_quote_authority(q.operator_id,q.vehicle_id,q.pickup_at,q.return_at,q.timezone,q.selected_options);
 bound:=jsonb_build_object('pricing',authority->'pricing','terms',authority->'terms','window',authority->'window','selected_options',authority->'selected_options');
 IF q.authority-'availability_checked_at' IS DISTINCT FROM authority-'availability_checked_at' OR q.terms_hash IS DISTINCT FROM encode(sha256(convert_to(bound::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'quote_changed'; END IF;
 SELECT * INTO r FROM public.external_consent_receipts WHERE quote_id=q.quote_id AND issuer=q.issuer AND subject=q.subject AND client_id=q.client_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND r.expires_at>moment AND r.consumed_at IS NULL THEN
  IF r.action_scopes IS DISTINCT FROM _action_scopes OR r.csrf_nonce_hash IS DISTINCT FROM _csrf_hash THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 ELSE
  INSERT INTO public.external_consent_receipts(issuer,subject,client_id,customer_id,operator_id,quote_id,terms_hash,action,csrf_nonce_hash,created_at,expires_at,action_scopes)
   VALUES(q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.quote_id,q.terms_hash,_action,_csrf_hash,moment,least(q.expires_at,moment+interval '15 minutes'),_action_scopes) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'quote_id',q.quote_id,'state','authorized','expires_at',date_trunc('milliseconds',r.expires_at));
END $$;

CREATE OR REPLACE FUNCTION public.external_hosted_authorize_quote(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_terms_hash text,_action text,_csrf_hash text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
 SELECT public.external_hosted_authorize_quote_scopes(_issuer,_subject,_client_id,_audience,_quote_id,_terms_hash,_action,_csrf_hash,ARRAY['rental_requests:read','checkout:handoff']::text[]);
$$;
REVOKE ALL ON FUNCTION public.external_hosted_authorize_quote_scopes(text,text,text,text,uuid,text,text,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_hosted_authorize_quote_scopes(text,text,text,text,uuid,text,text,text,text[]) TO service_role;
CREATE FUNCTION public.external_receipt_scopes_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF NEW.action_scopes IS DISTINCT FROM OLD.action_scopes THEN RAISE EXCEPTION 'consent_mismatch';END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.external_receipt_scopes_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER external_receipt_scopes_immutable BEFORE UPDATE ON public.external_consent_receipts FOR EACH ROW EXECUTE FUNCTION public.external_receipt_scopes_immutable();

-- Exact existing atomic writer, retaining ledger-first ordering and source
-- booking authority; the only authority change copies locked receipt scopes.
CREATE OR REPLACE FUNCTION public.external_submit_rental_request(
  _quote_id uuid,_receipt_id uuid,_idempotency_key text,_issuer text,_subject text,
  _client_id text,_customer_id uuid,_operator_id uuid,_audience text,_public_origin text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE
  ledger public.external_request_idempotency%ROWTYPE; q public.external_quotes%ROWTYPE;
  receipt public.external_consent_receipts%ROWTYPE; customer public.customers%ROWTYPE;
  team public.teams%ROWTYPE; vehicle public.vehicles%ROWTYPE;
  current_authority jsonb; bound_authority jsonb; canonical_hash text;
  initial_status text; created record; booking public.bookings%ROWTYPE; v_grant_id uuid;
  moment timestamptz; body jsonb; scope_list text[];
BEGIN
  IF _quote_id IS NULL OR _receipt_id IS NULL OR _customer_id IS NULL OR _operator_id IS NULL
    OR _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$'
    OR _issuer IS NULL OR length(_issuer) NOT BETWEEN 1 AND 500 OR _subject IS NULL OR length(_subject) NOT BETWEEN 1 AND 256
    OR _client_id IS NULL OR length(_client_id) NOT BETWEEN 1 AND 500 OR _audience IS NULL OR length(_audience) NOT BETWEEN 1 AND 2048
    OR _public_origin IS NULL OR length(_public_origin)>2048 OR _public_origin !~ '^https://[A-Za-z0-9.-]+(:443)?(/[A-Za-z0-9_-]+)*$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
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
  PERFORM 1 FROM public.identity_verifications iv JOIN public.bookings prior ON prior.booking_ref=iv.booking_ref AND prior.customer_id=iv.customer_id
    JOIN public.external_request_idempotency previous ON previous.booking_id=prior.id AND previous.customer_id=_customer_id AND previous.operator_id=_operator_id AND previous.issuer=_issuer AND previous.subject=_subject
    JOIN public.external_customer_links link ON link.issuer=_issuer AND link.subject=_subject AND link.operator_id=_operator_id AND link.customer_id=_customer_id AND link.revoked_at IS NULL
    WHERE iv.customer_id=_customer_id AND iv.status='verified' AND iv.verified_at>=link.verified_at
    AND iv.document_expiry>(clock_timestamp() AT TIME ZONE q.timezone)::date FOR SHARE OF iv,prior,link;
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
  scope_list:=receipt.action_scopes;
  INSERT INTO public.external_booking_grants(issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,created_at,expires_at)
    VALUES(_issuer,_subject,_client_id,_customer_id,_operator_id,booking.id,scope_list,moment,moment+interval '24 hours') RETURNING id INTO v_grant_id;
  body:=jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'ref',booking.booking_ref,'status',initial_status,
    'next_action',CASE initial_status WHEN 'requested' THEN 'await_operator' ELSE 'verify_identity' END,
    'hold_expires_at',date_trunc('milliseconds',booking.created_at+CASE initial_status WHEN 'requested' THEN interval '72 hours' ELSE interval '24 hours' END),
    'links',jsonb_build_object('status',_public_origin||'/v1/rental-requests/'||booking.booking_ref)||CASE WHEN coalesce(current_setting('exotiq.customer_origin',true),'')~'^https://[A-Za-z0-9.-]+(:443)?$' THEN jsonb_build_object('customer_account',current_setting('exotiq.customer_origin',true)||'/agent/account/'||_operator_id::text||'?ref='||booking.booking_ref) ELSE '{}'::jsonb END);
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
NOTIFY pgrst,'reload schema';

-- Shared source checkout reservation. Persist references only; hosted URLs and
-- legacy tokens remain absent from these new fields. No attempt auto-reset.
ALTER TABLE public.bookings ADD COLUMN rental_checkout_attempt_key text,
 ADD COLUMN rental_checkout_kind text CHECK(rental_checkout_kind IN('legacy','external')),
 ADD COLUMN rental_checkout_mode text CHECK(rental_checkout_mode IN('test','live')),
 ADD COLUMN rental_checkout_origin text,ADD COLUMN rental_checkout_created_at timestamptz,
 ADD COLUMN rental_checkout_customer_ref text,ADD COLUMN rental_checkout_session_ref text,ADD COLUMN rental_checkout_expires_at timestamptz;
CREATE FUNCTION public.external_reserve_rental_checkout(_ref text,_token text,_mode text,_kind text,_origin text,_nonce_hash text,_claim_token uuid,_attempt_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE;ctx jsonb;moment timestamptz:=clock_timestamp();
BEGIN
 IF _attempt_key IS NULL OR length(_attempt_key)>256 OR left(_attempt_key,length('rent-checkout-'||_ref||'-')) IS DISTINCT FROM 'rent-checkout-'||_ref||'-' OR _mode IS NULL OR _mode NOT IN('test','live') OR _kind IS NULL OR _kind NOT IN('legacy','external') OR _origin IS NULL OR _origin!~'^https://[A-Za-z0-9.-]+(:443)?$' THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF _kind='external' THEN ctx:=public.external_provider_handoff_context(_nonce_hash,_claim_token,'checkout');IF ctx->>'booking_ref' IS DISTINCT FROM _ref OR ctx->>'mode' IS DISTINCT FROM _mode THEN RAISE EXCEPTION 'not_found';END IF;END IF;
 SELECT * INTO b FROM public.bookings WHERE booking_ref=_ref AND booking_source='marketplace' AND confirmation_token=_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 IF b.status<>'pending_payment' OR b.paid_at IS NOT NULL OR coalesce(b.operator_payment_intent_id,'')<>'' OR coalesce(b.exotiq_payment_intent_id,'')<>'' OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id) OR EXISTS(SELECT FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=b.id) THEN RAISE EXCEPTION 'forbidden';END IF;
 IF b.payment_due_at IS NULL OR b.payment_due_at<=moment THEN RAISE EXCEPTION 'payment_window_expired';END IF;
 IF b.rental_checkout_attempt_key IS NULL THEN
  UPDATE public.bookings SET rental_checkout_attempt_key=_attempt_key,rental_checkout_kind=_kind,rental_checkout_mode=_mode,rental_checkout_origin=_origin,rental_checkout_created_at=moment,rental_checkout_expires_at=least(b.payment_due_at,moment+interval '23 hours 55 minutes') WHERE id=b.id RETURNING * INTO b;
 ELSE
  IF (b.rental_checkout_kind,b.rental_checkout_mode,b.rental_checkout_origin) IS DISTINCT FROM (_kind,_mode,_origin) OR b.rental_checkout_session_ref IS NULL AND b.rental_checkout_created_at+interval '23 hours'<=moment THEN RAISE EXCEPTION 'forbidden';END IF;
 END IF;
 IF b.rental_checkout_expires_at IS NULL OR (b.rental_checkout_session_ref IS NULL AND b.rental_checkout_expires_at<=moment+interval '31 minutes') THEN RAISE EXCEPTION 'payment_window_expired';END IF;
 RETURN jsonb_build_object('attempt_key',b.rental_checkout_attempt_key,'customer_ref',b.rental_checkout_customer_ref,'session_ref',b.rental_checkout_session_ref,'provider_expires_at',floor(extract(epoch FROM b.rental_checkout_expires_at))::bigint);
END $$;
CREATE FUNCTION public.external_record_checkout_customer(_booking_id uuid,_attempt_key text,_customer_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.rental_checkout_attempt_key IS DISTINCT FROM _attempt_key OR _customer_ref IS NULL OR _customer_ref!~'^cus_[A-Za-z0-9]+$' OR b.rental_checkout_customer_ref IS NOT NULL AND b.rental_checkout_customer_ref<>_customer_ref THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE public.bookings SET rental_checkout_customer_ref=_customer_ref WHERE id=b.id;RETURN true;
END $$;
CREATE FUNCTION public.external_record_checkout_session(_booking_id uuid,_attempt_key text,_session_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.rental_checkout_attempt_key IS DISTINCT FROM _attempt_key OR _session_ref IS NULL OR _session_ref!~'^cs_(test_|live_)?[A-Za-z0-9]+$' OR b.rental_checkout_session_ref IS NOT NULL AND b.rental_checkout_session_ref<>_session_ref THEN RAISE EXCEPTION 'forbidden';END IF;
 IF b.status<>'pending_payment' OR b.payment_due_at<=clock_timestamp() OR b.paid_at IS NOT NULL OR coalesce(b.operator_payment_intent_id,'')<>'' OR coalesce(b.exotiq_payment_intent_id,'')<>'' THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE public.bookings SET rental_checkout_session_ref=_session_ref WHERE id=b.id;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.external_reserve_rental_checkout(text,text,text,text,text,text,uuid,text),public.external_record_checkout_customer(uuid,text,text),public.external_record_checkout_session(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_reserve_rental_checkout(text,text,text,text,text,text,uuid,text),public.external_record_checkout_customer(uuid,text,text),public.external_record_checkout_session(uuid,text,text) TO service_role;

-- One read-only state evidence projection for agent and independently
-- authenticated customer reads; customer ownership survives agent revocation.
CREATE FUNCTION public.external_booking_state_evidence(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE; financial boolean; identity_ok boolean; both_paid boolean; operator_present boolean; exotiq_present boolean; operator_settled boolean; exotiq_settled boolean; moment timestamptz;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 moment:=clock_timestamp();
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
REVOKE ALL ON FUNCTION public.external_booking_state_evidence(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.external_read_rental_request(_issuer text,_subject text,_client_id text,_audience text,_ref text)
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
 RETURN public.external_booking_state_evidence(b.id)||jsonb_build_object('action_scopes',g.action_scopes,'operator_id',b.team_id);
END $$;

CREATE FUNCTION public.external_customer_rental_status(_issuer text,_subject text,_client_id text,_audience text,_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE;opname text;vname text;
BEGIN
 SELECT b0.* INTO b FROM public.bookings b0
 JOIN public.external_request_idempotency l ON l.booking_id=b0.id AND l.customer_id=b0.customer_id AND l.operator_id=b0.team_id AND l.committed_at IS NOT NULL
 JOIN public.external_quotes q ON q.quote_id=l.quote_id AND q.consumed_booking_id=b0.id AND q.audience=_audience
 JOIN public.external_customer_links link ON (link.issuer,link.subject,link.customer_id,link.operator_id)=(l.issuer,l.subject,l.customer_id,l.operator_id) AND link.revoked_at IS NULL
 WHERE b0.booking_ref=_ref AND (l.issuer,l.subject)=(_issuer,_subject) FOR SHARE OF b0,link;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 SELECT name INTO opname FROM public.teams WHERE id=b.team_id;
 SELECT name INTO vname FROM public.vehicles WHERE id=b.vehicle_id AND team_id=b.team_id;
 RETURN public.external_booking_state_evidence(b.id)||jsonb_build_object('operator_id',b.team_id,'operator_name',opname,'vehicle_name',vname);
END $$;
REVOKE ALL ON FUNCTION public.external_customer_rental_status(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_customer_rental_status(text,text,text,text,text) TO service_role;
CREATE FUNCTION public.external_handoff_binding_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF (NEW.nonce_hash,NEW.issuer,NEW.subject,NEW.client_id,NEW.audience,NEW.customer_id,NEW.operator_id,NEW.booking_id,NEW.grant_id,NEW.authority,NEW.action,NEW.mode,NEW.created_at,NEW.expires_at,NEW.provider_attempt_key,NEW.provider_attempt_created_at)
 IS DISTINCT FROM (OLD.nonce_hash,OLD.issuer,OLD.subject,OLD.client_id,OLD.audience,OLD.customer_id,OLD.operator_id,OLD.booking_id,OLD.grant_id,OLD.authority,OLD.action,OLD.mode,OLD.created_at,OLD.expires_at,OLD.provider_attempt_key,OLD.provider_attempt_created_at)
 OR (OLD.provider_session_ref IS NOT NULL AND NEW.provider_session_ref IS DISTINCT FROM OLD.provider_session_ref)
 OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
 THEN RAISE EXCEPTION 'forbidden';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.external_handoff_binding_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER external_handoff_binding_immutable BEFORE UPDATE ON public.external_customer_handoffs FOR EACH ROW EXECUTE FUNCTION public.external_handoff_binding_immutable();
CREATE FUNCTION public.external_create_customer_owned_handoff(_issuer text,_subject text,_client_id text,_audience text,_ref text,_action text,_nonce_hash text,_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE b public.bookings%ROWTYPE;r public.external_request_idempotency%ROWTYPE;old public.external_customer_handoffs%ROWTYPE;h public.external_customer_handoffs%ROWTYPE;moment timestamptz;
BEGIN
 IF _action IS NULL OR _action NOT IN('identity','checkout') OR _nonce_hash IS NULL OR _nonce_hash!~'^[a-f0-9]{64}$' OR _mode IS NULL OR _mode NOT IN('test','live') THEN RAISE EXCEPTION 'invalid_input';END IF;
 -- Independent current customer session/BFF proof is mandatory at the route.
 -- This verified-link lookup never derives ownership from a ref or typed email.
 SELECT b0.* INTO b FROM public.bookings b0
 JOIN public.external_request_idempotency l ON l.booking_id=b0.id AND l.customer_id=b0.customer_id AND l.operator_id=b0.team_id AND l.committed_at IS NOT NULL
 JOIN public.external_quotes q ON q.quote_id=l.quote_id AND q.consumed_booking_id=b0.id AND q.audience=_audience
 JOIN public.external_customer_links link ON (link.issuer,link.subject,link.customer_id,link.operator_id)=(l.issuer,l.subject,l.customer_id,l.operator_id) AND link.revoked_at IS NULL
 WHERE b0.booking_ref=_ref AND (l.issuer,l.subject)=(_issuer,_subject) FOR UPDATE OF b0 FOR SHARE OF link;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 SELECT l.* INTO r FROM public.external_request_idempotency l JOIN public.external_quotes q ON q.quote_id=l.quote_id AND q.audience=_audience WHERE l.booking_id=b.id AND l.issuer=_issuer AND l.subject=_subject AND l.committed_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 moment:=clock_timestamp();
 SELECT * INTO old FROM public.external_customer_handoffs WHERE (issuer,subject,customer_id,booking_id,action)=(_issuer,_subject,b.customer_id,b.id,_action) AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND (old.claimed_until>moment) THEN RAISE EXCEPTION 'request_in_flight' USING ERRCODE='40001';END IF;
 IF FOUND AND (old.mode<>_mode OR old.provider_recorded_at IS NULL AND old.provider_attempt_created_at+interval '23 hours'<=moment) THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE public.external_customer_handoffs SET revoked_at=moment WHERE nonce_hash=old.nonce_hash;
 INSERT INTO public.external_customer_handoffs(nonce_hash,issuer,subject,client_id,audience,customer_id,operator_id,booking_id,authority,action,mode,created_at,expires_at,provider_session_ref,provider_attempt_key,provider_recorded_at,provider_attempt_created_at)
 VALUES(_nonce_hash,_issuer,_subject,_client_id,_audience,r.customer_id,r.operator_id,b.id,'customer_session',_action,_mode,moment,moment+interval '10 minutes',old.provider_session_ref,coalesce(old.provider_attempt_key,gen_random_uuid()),old.provider_recorded_at,coalesce(old.provider_attempt_created_at,moment)) RETURNING * INTO h;
 PERFORM public.external_handoff_context(_issuer,_subject,_audience,_nonce_hash,true);
 RETURN jsonb_build_object('source_checked_at',date_trunc('milliseconds',moment),'expires_at',date_trunc('milliseconds',h.expires_at),'status',b.status);
END $$;
REVOKE ALL ON FUNCTION public.external_create_customer_owned_handoff(text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_create_customer_owned_handoff(text,text,text,text,text,text,text,text) TO service_role;
CREATE FUNCTION public.external_begin_customer_handoff_recovery(_issuer text,_subject text,_client_id text,_audience text,_nonce_hash text,_csrf_hash text,_customer_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE h public.external_customer_handoffs%ROWTYPE;g public.external_booking_grants%ROWTYPE;
BEGIN
 SELECT * INTO h FROM public.external_customer_handoffs WHERE nonce_hash=_nonce_hash;
 IF NOT FOUND OR h.authority<>'agent_grant' OR (h.issuer,h.subject,h.audience) IS DISTINCT FROM (_issuer,_subject,_audience) THEN RAISE EXCEPTION 'not_found';END IF;
 PERFORM 1 FROM public.external_customer_links WHERE (issuer,subject,operator_id,customer_id)=(h.issuer,h.subject,h.operator_id,h.customer_id) AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
 SELECT * INTO g FROM public.external_booking_grants WHERE id=h.grant_id FOR UPDATE;
 IF NOT FOUND OR (g.issuer,g.subject,g.client_id,g.customer_id,g.operator_id,g.booking_id) IS DISTINCT FROM (h.issuer,h.subject,h.client_id,h.customer_id,h.operator_id,h.booking_id) THEN RAISE EXCEPTION 'not_found';END IF;
 IF g.revoked_at IS NULL AND g.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'forbidden';END IF;
 RETURN public.external_begin_grant_recovery(h.issuer,h.subject,h.client_id,h.audience,h.grant_id,_csrf_hash,_customer_origin);
END $$;
REVOKE ALL ON FUNCTION public.external_begin_customer_handoff_recovery(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_begin_customer_handoff_recovery(text,text,text,text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';

-- Request-local trusted origin context is set ONLY by a service-only wrapper.
-- Account URL is persisted at first commit, preserving byte-identical replay.
CREATE FUNCTION public.external_submit_rental_request_result_customer(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_receipt_id uuid,_idempotency_key text,_public_origin text,_customer_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE result jsonb;prior text:=current_setting('exotiq.customer_origin',true);
BEGIN
 IF _customer_origin IS NULL OR _customer_origin!~'^https://[A-Za-z0-9.-]+(:443)?$' THEN RAISE EXCEPTION 'invalid_input';END IF;
 PERFORM set_config('exotiq.customer_origin',_customer_origin,true);
 result:=public.external_submit_rental_request_result(_issuer,_subject,_client_id,_audience,_quote_id,_receipt_id,_idempotency_key,_public_origin);
 PERFORM set_config('exotiq.customer_origin',coalesce(prior,''),true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.external_submit_rental_request_result_customer(text,text,text,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_submit_rental_request_result_customer(text,text,text,text,uuid,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
