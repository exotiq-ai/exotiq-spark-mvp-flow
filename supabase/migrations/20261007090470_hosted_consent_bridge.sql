-- Hosted customer writes require managed bearer verification AND signed BFF
-- attestation in API composition. These narrow RPCs are service-only; JSON never
-- supplies customer identifiers or email ownership claims.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.external_grant_renewals ADD COLUMN hosted_reviewed_at timestamptz, ADD COLUMN hosted_client_id text;
ALTER TABLE public.external_quotes ADD COLUMN operator_name text, ADD COLUMN vehicle_name text;
CREATE FUNCTION public.external_quote_review_names() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 SELECT t.name,v.name INTO NEW.operator_name,NEW.vehicle_name FROM public.teams t JOIN public.vehicles v ON v.team_id=t.id
 WHERE t.id=NEW.operator_id AND v.id=NEW.vehicle_id FOR SHARE OF t,v;
 IF NOT FOUND OR NEW.operator_name IS NULL OR NEW.vehicle_name IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER external_quote_review_names BEFORE INSERT ON public.external_quotes FOR EACH ROW EXECUTE FUNCTION public.external_quote_review_names();
REVOKE ALL ON FUNCTION public.external_quote_review_names() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.external_hosted_link_customer(_issuer text,_subject text,_client_id text,_audience text,_operator_id uuid,_email text,_email_verified boolean,_full_name text,_phone text,_consented boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE team public.teams%ROWTYPE; customer public.customers%ROWTYPE; link public.external_customer_links%ROWTYPE; moment timestamptz:=clock_timestamp();
BEGIN
 IF _consented IS DISTINCT FROM true OR _email_verified IS DISTINCT FROM true OR _email IS NULL OR length(_email)>320 OR _email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR _full_name IS NULL OR length(btrim(_full_name)) NOT BETWEEN 2 AND 160 OR _phone IS NULL OR _phone!~'^[+0-9() .-]{7,30}$'
  OR _issuer IS NULL OR _issuer NOT LIKE 'https://%' OR _subject IS NULL OR length(_subject) NOT BETWEEN 1 AND 256
  OR _client_id IS NULL OR length(_client_id) NOT BETWEEN 1 AND 512 OR _audience IS NULL OR _audience NOT LIKE 'https://%' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 -- Serializes onboarding with quote/booking writes through the tenant config row.
 SELECT * INTO team FROM public.teams WHERE id=_operator_id FOR UPDATE;
 IF NOT FOUND OR team.owner_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO link FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=_operator_id FOR UPDATE;
 IF FOUND THEN
  IF link.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO customer FROM public.customers WHERE id=link.customer_id AND team_id=team.id FOR UPDATE;
  IF NOT FOUND OR lower(customer.email)<>lower(_email) THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 ELSE
  -- Exact source18 canonical selection. Actual verified OIDC email proof plus
  -- explicit customer click is required upstream; typed guest email never gets here.
  SELECT * INTO customer FROM public.customers WHERE team_id=team.id AND lower(email)=lower(_email) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
   IF customer.user_id IS DISTINCT FROM team.owner_id OR EXISTS(SELECT 1 FROM public.customers c WHERE c.team_id=team.id AND lower(c.email)=lower(_email) AND c.id<>customer.id AND c.created_at IS NOT DISTINCT FROM customer.created_at) THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
  ELSE
   -- Source UNIQUE(user_id,email) is global across this operator owner. Never
   -- merge/reassign a customer from another team to get around that constraint.
   IF EXISTS(SELECT 1 FROM public.customers WHERE user_id=team.owner_id AND lower(email)=lower(_email)) THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
   INSERT INTO public.customers(user_id,team_id,email,full_name,phone) VALUES(team.owner_id,team.id,lower(_email),btrim(_full_name),_phone) RETURNING * INTO customer;
  END IF;
  INSERT INTO public.external_customer_links(issuer,subject,operator_id,customer_id,verified_at,verification_method)
   VALUES(_issuer,_subject,team.id,customer.id,moment,'authenticated_customer_session');
 END IF;
 UPDATE public.customers SET full_name=btrim(_full_name),phone=_phone WHERE id=customer.id;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'operator_id',team.id,'state','linked');
END $$;

CREATE FUNCTION public.external_review_quote(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_hosted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.external_quotes%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.external_quotes WHERE quote_id=_quote_id FOR SHARE;
 IF NOT FOUND OR q.issuer IS DISTINCT FROM _issuer OR q.subject IS DISTINCT FROM _subject OR q.audience IS DISTINCT FROM _audience
  OR (_hosted IS DISTINCT FROM true AND q.client_id IS DISTINCT FROM _client_id) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=q.operator_id AND customer_id=q.customer_id AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF q.expires_at<=clock_timestamp() OR q.operator_name IS NULL OR q.vehicle_name IS NULL THEN RAISE EXCEPTION 'quote_expired'; END IF;
 IF q.consumed_booking_id IS NOT NULL THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 RETURN to_jsonb(q);
END $$;

CREATE OR REPLACE FUNCTION public.external_validate_receipt_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id)=(NEW.issuer,NEW.subject,NEW.operator_id,NEW.customer_id) AND l.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consent_mismatch' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.external_quotes q WHERE (q.quote_id,q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.terms_hash)=(NEW.quote_id,NEW.issuer,NEW.subject,NEW.client_id,NEW.customer_id,NEW.operator_id,NEW.terms_hash) AND q.consumed_booking_id IS NULL AND NEW.expires_at<=q.expires_at AND q.expires_at>clock_timestamp() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consent_mismatch' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND ((NEW.issuer,NEW.subject,NEW.client_id,NEW.customer_id,NEW.operator_id,NEW.quote_id,NEW.terms_hash,NEW.action,NEW.csrf_nonce_hash,NEW.created_at,NEW.expires_at)
  IS DISTINCT FROM (OLD.issuer,OLD.subject,OLD.client_id,OLD.customer_id,OLD.operator_id,OLD.quote_id,OLD.terms_hash,OLD.action,OLD.csrf_nonce_hash,OLD.created_at,OLD.expires_at)
  OR OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at) THEN RAISE EXCEPTION 'consent_immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.external_hosted_authorize_quote(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid,_terms_hash text,_action text,_csrf_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.external_quotes%ROWTYPE; r public.external_consent_receipts%ROWTYPE; authority jsonb; bound jsonb; moment timestamptz;
BEGIN
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
  IF r.csrf_nonce_hash IS DISTINCT FROM _csrf_hash THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 ELSE
  INSERT INTO public.external_consent_receipts(issuer,subject,client_id,customer_id,operator_id,quote_id,terms_hash,action,csrf_nonce_hash,created_at,expires_at)
   VALUES(q.issuer,q.subject,q.client_id,q.customer_id,q.operator_id,q.quote_id,q.terms_hash,_action,_csrf_hash,moment,least(q.expires_at,moment+interval '15 minutes')) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'quote_id',q.quote_id,'state','authorized','expires_at',date_trunc('milliseconds',r.expires_at));
END $$;

CREATE FUNCTION public.external_quote_consent_result(_issuer text,_subject text,_client_id text,_audience text,_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.external_quotes%ROWTYPE; r public.external_consent_receipts%ROWTYPE; moment timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO q FROM public.external_quotes WHERE quote_id=_quote_id FOR SHARE;
 IF NOT FOUND OR (q.issuer,q.subject,q.client_id,q.audience) IS DISTINCT FROM (_issuer,_subject,_client_id,_audience) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=q.operator_id AND customer_id=q.customer_id AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO r FROM public.external_consent_receipts WHERE quote_id=q.quote_id AND issuer=_issuer AND subject=_subject AND client_id=_client_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE;
 -- Consumed receipt is needed ONLY to reach ledger-first replay. It does not
 -- authorize another booking and cannot be substituted into another principal.
 IF FOUND AND r.consumed_at IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.external_request_idempotency l JOIN public.external_booking_grants g ON g.id=l.grant_id WHERE l.receipt_id=r.id AND l.quote_id=q.quote_id AND l.booking_id=q.consumed_booking_id AND l.issuer=_issuer AND l.subject=_subject AND l.client_id=_client_id AND g.revoked_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 ELSIF q.expires_at<=moment THEN RAISE EXCEPTION 'quote_expired';
 ELSIF r.id IS NOT NULL AND r.expires_at<=moment THEN RAISE EXCEPTION 'consent_expired'; END IF;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'quote_id',q.quote_id,'state',CASE WHEN r.id IS NULL THEN 'waiting' ELSE 'authorized' END,'expires_at',date_trunc('milliseconds',coalesce(r.expires_at,q.expires_at)))
  ||CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('consent_receipt_id',r.id) ELSE '{}'::jsonb END;
END $$;

CREATE FUNCTION public.external_hosted_revoke_grant(_issuer text,_subject text,_client_id text,_audience text,_grant_id uuid,_csrf_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE g public.external_booking_grants%ROWTYPE;
BEGIN
 IF _csrf_hash IS NULL OR _csrf_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO g FROM public.external_booking_grants WHERE id=_grant_id FOR UPDATE;
 IF NOT FOUND OR (g.issuer,g.subject) IS DISTINCT FROM (_issuer,_subject) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=g.operator_id AND customer_id=g.customer_id AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 RETURN public.external_revoke_booking_grant(g.id,g.customer_id,g.issuer,g.subject,g.client_id);
END $$;

CREATE FUNCTION public.external_begin_grant_recovery(_issuer text,_subject text,_client_id text,_audience text,_grant_id uuid,_csrf_hash text,_customer_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE g public.external_booking_grants%ROWTYPE; r public.external_grant_renewals%ROWTYPE; renewal_id uuid;
BEGIN
 IF _customer_origin IS NULL OR _customer_origin!~'^https://[A-Za-z0-9.-]+(:443)?$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO g FROM public.external_booking_grants WHERE id=_grant_id FOR UPDATE;
 IF NOT FOUND OR (g.issuer,g.subject,g.client_id) IS DISTINCT FROM (_issuer,_subject,_client_id) THEN RAISE EXCEPTION 'not_found'; END IF;
 renewal_id:=public.external_create_grant_renewal(g.id,g.customer_id,g.issuer,g.subject,g.client_id,_csrf_hash);
 SELECT * INTO r FROM public.external_grant_renewals WHERE external_grant_renewals.id=renewal_id;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',clock_timestamp()),'renewal_id',r.id,'state','authorization_required','expires_at',date_trunc('milliseconds',r.expires_at),'customer_url',_customer_origin||'/agent/authorization/'||r.id);
END $$;

CREATE FUNCTION public.external_review_grant_renewal(_issuer text,_subject text,_client_id text,_audience text,_renewal_id uuid,_hosted boolean,_customer_origin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.external_grant_renewals%ROWTYPE; g public.external_booking_grants%ROWTYPE; b public.bookings%ROWTYPE; t public.teams%ROWTYPE; vehicle_name text; body jsonb; moment timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO r FROM public.external_grant_renewals WHERE id=_renewal_id FOR SHARE;
 IF NOT FOUND OR (r.issuer,r.subject) IS DISTINCT FROM (_issuer,_subject) OR (_hosted IS DISTINCT FROM true AND r.client_id IS DISTINCT FROM _client_id) THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM 1 FROM public.external_customer_links WHERE issuer=_issuer AND subject=_subject AND operator_id=r.operator_id AND customer_id=r.customer_id AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF r.expires_at<=moment THEN RAISE EXCEPTION 'renewal_expired'; END IF;
 SELECT * INTO g FROM public.external_booking_grants WHERE id=r.previous_grant_id;
 IF r.result_grant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.external_booking_grants WHERE id=r.result_grant_id AND revoked_at IS NULL AND expires_at>moment) THEN RAISE EXCEPTION 'grant_revoked'; END IF;
 IF _hosted IS DISTINCT FROM true THEN
  IF _customer_origin IS NULL OR _customer_origin!~'^https://[A-Za-z0-9.-]+(:443)?$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'renewal_id',r.id,'state',CASE WHEN r.result_grant_id IS NULL THEN 'authorization_required' ELSE 'authorized' END,'expires_at',date_trunc('milliseconds',r.expires_at),'customer_url',_customer_origin||'/agent/authorization/'||r.id)
    ||CASE WHEN r.result_grant_id IS NOT NULL THEN jsonb_build_object('grant_id',r.result_grant_id) ELSE '{}'::jsonb END;
 END IF;
 SELECT * INTO b FROM public.bookings WHERE id=r.booking_id AND customer_id=r.customer_id AND team_id=r.operator_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO t FROM public.teams WHERE id=r.operator_id;
 SELECT name INTO vehicle_name FROM public.vehicles WHERE id=b.vehicle_id AND team_id=r.operator_id;
 RETURN jsonb_build_object('api_version','v1','source_checked_at',date_trunc('milliseconds',moment),'renewal_id',r.id,'previous_grant_id',r.previous_grant_id,'grant_id_to_revoke',coalesce(r.result_grant_id,r.previous_grant_id),'ref',b.booking_ref,'operator_id',r.operator_id,'agent_client_id',r.client_id,'operator_name',t.name,'vehicle_name',vehicle_name,
  'pickup_at',date_trunc('milliseconds',b.start_date),'return_at',date_trunc('milliseconds',b.end_date),'timezone',t.timezone,'status',b.status,
  'hold_expires_at',CASE WHEN b.status='pending_documents' THEN date_trunc('milliseconds',b.created_at+interval '24 hours') WHEN b.status IN('requested','pending') THEN date_trunc('milliseconds',b.created_at+interval '72 hours') ELSE NULL END,
  'payment_due_at',date_trunc('milliseconds',b.payment_due_at),'action_scopes',r.action_scopes,'expires_at',date_trunc('milliseconds',r.expires_at),'state',CASE WHEN r.result_grant_id IS NULL THEN 'authorization_required' ELSE 'authorized' END,'requires_new_delegation',g.revoked_at IS NOT NULL);
END $$;

CREATE FUNCTION public.external_hosted_review_grant_renewal(_issuer text,_subject text,_client_id text,_audience text,_renewal_id uuid,_csrf_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.external_grant_renewals%ROWTYPE;
BEGIN
 IF _csrf_hash IS NULL OR _csrf_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO r FROM public.external_grant_renewals WHERE id=_renewal_id FOR UPDATE;
 IF NOT FOUND OR (r.issuer,r.subject) IS DISTINCT FROM (_issuer,_subject) THEN RAISE EXCEPTION 'not_found'; END IF;
 -- Only the fresh customer review changes the CSRF hash; no actor, original
 -- client, booking or scope substitution. Completed rendezvous remains stable.
 IF r.result_grant_id IS NULL THEN UPDATE public.external_grant_renewals SET csrf_nonce_hash=_csrf_hash,hosted_reviewed_at=clock_timestamp(),hosted_client_id=_client_id WHERE id=r.id; END IF;
 RETURN public.external_review_grant_renewal(_issuer,_subject,_client_id,_audience,_renewal_id,true,NULL);
END $$;

CREATE FUNCTION public.external_hosted_complete_grant_renewal(_issuer text,_subject text,_client_id text,_audience text,_renewal_id uuid,_csrf_hash text,_scopes text[],_explicit_new_delegation boolean,_consented boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.external_grant_renewals%ROWTYPE; fresh uuid;
BEGIN
 IF _consented IS DISTINCT FROM true THEN RAISE EXCEPTION 'consent_mismatch'; END IF;
 SELECT * INTO r FROM public.external_grant_renewals WHERE id=_renewal_id FOR UPDATE;
 IF NOT FOUND OR (r.issuer,r.subject) IS DISTINCT FROM (_issuer,_subject) OR r.csrf_nonce_hash IS DISTINCT FROM _csrf_hash OR r.hosted_reviewed_at IS NULL OR r.hosted_client_id IS DISTINCT FROM _client_id THEN RAISE EXCEPTION 'not_found'; END IF;
 fresh:=public.external_complete_grant_renewal(r.id,r.customer_id,r.issuer,r.subject,r.client_id,_csrf_hash,_scopes,_explicit_new_delegation);
 RETURN public.external_review_grant_renewal(_issuer,_subject,_client_id,_audience,_renewal_id,true,NULL);
END $$;

REVOKE ALL ON FUNCTION
 public.external_hosted_link_customer(text,text,text,text,uuid,text,boolean,text,text,boolean),
 public.external_review_quote(text,text,text,text,uuid,boolean),
 public.external_hosted_authorize_quote(text,text,text,text,uuid,text,text,text),
 public.external_quote_consent_result(text,text,text,text,uuid),
 public.external_hosted_revoke_grant(text,text,text,text,uuid,text),
 public.external_begin_grant_recovery(text,text,text,text,uuid,text,text),
 public.external_review_grant_renewal(text,text,text,text,uuid,boolean,text),
 public.external_hosted_review_grant_renewal(text,text,text,text,uuid,text),
 public.external_hosted_complete_grant_renewal(text,text,text,text,uuid,text,text[],boolean,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.external_hosted_link_customer(text,text,text,text,uuid,text,boolean,text,text,boolean),
 public.external_review_quote(text,text,text,text,uuid,boolean),
 public.external_hosted_authorize_quote(text,text,text,text,uuid,text,text,text),
 public.external_quote_consent_result(text,text,text,text,uuid),
 public.external_hosted_revoke_grant(text,text,text,text,uuid,text),
 public.external_begin_grant_recovery(text,text,text,text,uuid,text,text),
 public.external_review_grant_renewal(text,text,text,text,uuid,boolean,text),
 public.external_hosted_review_grant_renewal(text,text,text,text,uuid,text),
 public.external_hosted_complete_grant_renewal(text,text,text,text,uuid,text,text[],boolean,boolean)
 TO service_role;
COMMIT;
