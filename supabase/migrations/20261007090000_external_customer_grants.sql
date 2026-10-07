-- Additive delegated authorization. No historical data backfills.
-- Only trusted service entrypoints may write; customer browser/agent never receives
-- service credentials. Verified link provisioning requires fresh customer identity
-- proof in server composition (plan 08), never matching typed email.
BEGIN;

CREATE TABLE public.external_customer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 2048 AND issuer LIKE 'https://%'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 256),
  operator_id uuid NOT NULL REFERENCES public.teams(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  verified_at timestamptz NOT NULL,
  verification_method text NOT NULL CHECK (verification_method IN ('authenticated_customer_session')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (issuer, subject, operator_id),
  UNIQUE (issuer, subject, operator_id, customer_id)
);

CREATE TABLE public.external_booking_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL,
  subject text NOT NULL,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 512),
  customer_id uuid NOT NULL,
  operator_id uuid NOT NULL REFERENCES public.teams(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  action_scopes text[] NOT NULL CHECK (cardinality(action_scopes) BETWEEN 1 AND 2 AND action_scopes <@ ARRAY['rental_requests:read','checkout:handoff']::text[]),
  -- Optional hashed nonce supports future confidential rendezvous; ID is not bearer access.
  secret_hash text CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (issuer, subject, operator_id, customer_id) REFERENCES public.external_customer_links(issuer, subject, operator_id, customer_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '24 hours'),
  UNIQUE (id, issuer, subject, client_id, customer_id, operator_id, booking_id)
);
CREATE INDEX external_booking_grants_owner_idx ON public.external_booking_grants (issuer, subject, client_id, booking_id);

CREATE TABLE public.external_consent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL,
  subject text NOT NULL,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 512),
  customer_id uuid NOT NULL,
  operator_id uuid NOT NULL REFERENCES public.teams(id),
  quote_id uuid NOT NULL, -- FK and exact authority binding added by quote plan 04.
  terms_hash text NOT NULL CHECK (terms_hash ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK (action = 'rental_requests:create'),
  csrf_nonce_hash text NOT NULL CHECK (csrf_nonce_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  FOREIGN KEY (issuer, subject, operator_id, customer_id) REFERENCES public.external_customer_links(issuer, subject, operator_id, customer_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '15 minutes')
);
CREATE INDEX external_consent_receipts_quote_idx ON public.external_consent_receipts (quote_id, issuer, subject, client_id);

CREATE TABLE public.external_grant_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_grant_id uuid NOT NULL,
  issuer text NOT NULL,
  subject text NOT NULL,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 512),
  customer_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  action_scopes text[] NOT NULL CHECK (cardinality(action_scopes) BETWEEN 1 AND 2 AND action_scopes <@ ARRAY['rental_requests:read','checkout:handoff']::text[]),
  csrf_nonce_hash text NOT NULL CHECK (csrf_nonce_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  authenticated_customer_completed_at timestamptz,
  result_grant_id uuid REFERENCES public.external_booking_grants(id),
  FOREIGN KEY (previous_grant_id, issuer, subject, client_id, customer_id, operator_id, booking_id)
    REFERENCES public.external_booking_grants(id, issuer, subject, client_id, customer_id, operator_id, booking_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '15 minutes'),
  CHECK ((result_grant_id IS NULL) = (authenticated_customer_completed_at IS NULL))
);

ALTER TABLE public.external_customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_booking_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_consent_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_grant_renewals ENABLE ROW LEVEL SECURITY;
-- No public policies. Table privilege denial remains explicit even under future
-- permissive policy changes. service_role bypasses RLS but receives SELECT only;
-- writes are narrow SECURITY DEFINER entrypoints, not browser SQL access.
REVOKE ALL ON TABLE public.external_customer_links, public.external_booking_grants,
  public.external_consent_receipts, public.external_grant_renewals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.external_customer_links, public.external_booking_grants,
  public.external_consent_receipts, public.external_grant_renewals TO service_role;

CREATE FUNCTION public.external_validate_customer_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = NEW.customer_id AND c.team_id = NEW.operator_id)
  THEN RAISE EXCEPTION 'customer_binding_mismatch' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND ((NEW.issuer,NEW.subject,NEW.operator_id,NEW.customer_id) IS DISTINCT FROM (OLD.issuer,OLD.subject,OLD.operator_id,OLD.customer_id)
    OR OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
  THEN RAISE EXCEPTION 'customer_link_immutable' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER external_customer_link_binding BEFORE INSERT OR UPDATE ON public.external_customer_links
  FOR EACH ROW EXECUTE FUNCTION public.external_validate_customer_link();

CREATE FUNCTION public.external_validate_grant_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.external_customer_links l
    WHERE l.issuer = NEW.issuer AND l.subject = NEW.subject AND l.customer_id = NEW.customer_id AND l.operator_id = NEW.operator_id
      AND l.verified_at IS NOT NULL AND l.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.bookings b
      WHERE b.id = NEW.booking_id AND b.team_id = NEW.operator_id AND b.customer_id = NEW.customer_id)
  THEN RAISE EXCEPTION 'grant_binding_mismatch' USING ERRCODE = '42501'; END IF;
  -- Withdrawal is irreversible for an ID; renewal always inserts a fresh row.
  IF TG_OP = 'UPDATE' AND (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR (NEW.issuer,NEW.subject,NEW.client_id,NEW.customer_id,NEW.operator_id,NEW.booking_id,NEW.action_scopes)
      IS DISTINCT FROM (OLD.issuer,OLD.subject,OLD.client_id,OLD.customer_id,OLD.operator_id,OLD.booking_id,OLD.action_scopes))
  THEN RAISE EXCEPTION 'grant_immutable' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER external_booking_grant_binding BEFORE INSERT OR UPDATE ON public.external_booking_grants
  FOR EACH ROW EXECUTE FUNCTION public.external_validate_grant_binding();

CREATE FUNCTION public.external_validate_receipt_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM public.external_customer_links l
      WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (NEW.issuer,NEW.subject,NEW.operator_id,NEW.customer_id) AND l.revoked_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'consent_mismatch' USING ERRCODE = '42501'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND ((NEW.issuer,NEW.subject,NEW.client_id,NEW.customer_id,NEW.operator_id,NEW.quote_id,NEW.terms_hash,NEW.action,NEW.csrf_nonce_hash,NEW.created_at,NEW.expires_at)
      IS DISTINCT FROM (OLD.issuer,OLD.subject,OLD.client_id,OLD.customer_id,OLD.operator_id,OLD.quote_id,OLD.terms_hash,OLD.action,OLD.csrf_nonce_hash,OLD.created_at,OLD.expires_at)
      OR OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)
  THEN RAISE EXCEPTION 'consent_immutable' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER external_consent_receipt_binding BEFORE INSERT OR UPDATE ON public.external_consent_receipts
  FOR EACH ROW EXECUTE FUNCTION public.external_validate_receipt_binding();

CREATE FUNCTION public.external_revoke_booking_grant(_grant_id uuid, _customer_id uuid, _issuer text, _subject text, _client_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g public.external_booking_grants%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.external_booking_grants WHERE id = _grant_id FOR UPDATE;
  IF NOT FOUND OR (g.customer_id,g.issuer,g.subject,g.client_id) IS DISTINCT FROM (_customer_id,_issuer,_subject,_client_id)
  THEN RETURN false; END IF;
  -- No booking status/hold/payment mutation. Repeated owner revoke is idempotent.
  IF g.revoked_at IS NULL THEN UPDATE public.external_booking_grants SET revoked_at = clock_timestamp() WHERE id = g.id; END IF;
  RETURN true;
END;
$$;

CREATE FUNCTION public.external_create_grant_renewal(_grant_id uuid, _customer_id uuid, _issuer text, _subject text, _client_id text, _csrf_nonce_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g public.external_booking_grants%ROWTYPE; renewal_id uuid; moment timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO g FROM public.external_booking_grants WHERE id = _grant_id FOR UPDATE;
  IF NOT FOUND OR (g.customer_id,g.issuer,g.subject,g.client_id) IS DISTINCT FROM (_customer_id,_issuer,_subject,_client_id)
    OR NOT EXISTS (SELECT 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,g.operator_id,_customer_id) AND l.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,g.operator_id,_customer_id) AND l.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  -- Can create hosted review for expired/revoked IDs, but revoked IDs are never revived.
  INSERT INTO public.external_grant_renewals (previous_grant_id,issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,csrf_nonce_hash,created_at,expires_at)
    VALUES (g.id,g.issuer,g.subject,g.client_id,g.customer_id,g.operator_id,g.booking_id,g.action_scopes,_csrf_nonce_hash,moment,moment+interval '15 minutes') RETURNING id INTO renewal_id;
  RETURN renewal_id;
END;
$$;

CREATE FUNCTION public.external_complete_grant_renewal(_renewal_id uuid, _authenticated_customer_id uuid, _issuer text, _subject text, _client_id text, _csrf_nonce_hash text, _reviewed_action_scopes text[], _explicit_new_delegation boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.external_grant_renewals%ROWTYPE; g public.external_booking_grants%ROWTYPE; result_id uuid; moment timestamptz := clock_timestamp();
BEGIN
  -- Authenticated customer ID must come from validated hosted customer session,
  -- never the JSON body/typed email. RPC accessible only to internal service.
  SELECT * INTO r FROM public.external_grant_renewals WHERE id = _renewal_id FOR UPDATE;
  IF NOT FOUND OR (r.customer_id,r.issuer,r.subject,r.client_id,r.csrf_nonce_hash)
    IS DISTINCT FROM (_authenticated_customer_id,_issuer,_subject,_client_id,_csrf_nonce_hash)
    OR r.action_scopes IS DISTINCT FROM _reviewed_action_scopes
    OR NOT EXISTS (SELECT 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,r.operator_id,_authenticated_customer_id) AND l.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,r.operator_id,_authenticated_customer_id) AND l.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = '42501'; END IF;
  IF r.expires_at <= moment THEN RAISE EXCEPTION 'renewal_expired' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM public.external_booking_grants WHERE id = r.previous_grant_id FOR UPDATE;
  IF g.revoked_at IS NOT NULL AND _explicit_new_delegation IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'grant_revoked' USING ERRCODE = '42501'; END IF;
  IF r.result_grant_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.external_booking_grants fresh WHERE fresh.id = r.result_grant_id AND fresh.revoked_at IS NULL AND fresh.expires_at > moment)
      THEN RETURN r.result_grant_id; END IF;
    RAISE EXCEPTION 'grant_revoked' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.external_booking_grants (issuer,subject,client_id,customer_id,operator_id,booking_id,action_scopes,created_at,expires_at)
    VALUES (r.issuer,r.subject,r.client_id,r.customer_id,r.operator_id,r.booking_id,r.action_scopes,moment,moment+interval '24 hours') RETURNING id INTO result_id;
  UPDATE public.external_grant_renewals SET authenticated_customer_completed_at = moment, result_grant_id = result_id WHERE id = r.id;
  RETURN result_id;
END;
$$;

-- Later booking-authority transaction calls this after retry-ledger check, with
-- the exact quote/customer/terms already locked. No client may call it directly.
CREATE FUNCTION public.external_consume_consent_receipt(_receipt_id uuid, _customer_id uuid, _issuer text, _subject text, _client_id text, _operator_id uuid, _quote_id uuid, _terms_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.external_consent_receipts%ROWTYPE; moment timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO r FROM public.external_consent_receipts WHERE id = _receipt_id FOR UPDATE;
  IF NOT FOUND OR (r.customer_id,r.issuer,r.subject,r.client_id,r.operator_id,r.quote_id,r.terms_hash,r.action)
    IS DISTINCT FROM (_customer_id,_issuer,_subject,_client_id,_operator_id,_quote_id,_terms_hash,'rental_requests:create')
    OR r.consumed_at IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,_operator_id,_customer_id) AND l.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'consent_mismatch' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.external_customer_links l WHERE (l.issuer,l.subject,l.operator_id,l.customer_id) = (_issuer,_subject,_operator_id,_customer_id) AND l.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consent_mismatch' USING ERRCODE = '42501'; END IF;
  IF r.expires_at <= moment THEN RAISE EXCEPTION 'consent_expired' USING ERRCODE = '42501'; END IF;
  UPDATE public.external_consent_receipts SET consumed_at = moment WHERE id = r.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.external_validate_grant_binding() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.external_validate_customer_link() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.external_validate_receipt_binding() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.external_revoke_booking_grant(uuid,uuid,text,text,text),
  public.external_create_grant_renewal(uuid,uuid,text,text,text,text),
  public.external_complete_grant_renewal(uuid,uuid,text,text,text,text,text[],boolean),
  public.external_consume_consent_receipt(uuid,uuid,text,text,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_revoke_booking_grant(uuid,uuid,text,text,text),
  public.external_create_grant_renewal(uuid,uuid,text,text,text,text),
  public.external_complete_grant_renewal(uuid,uuid,text,text,text,text,text[],boolean) TO service_role;
-- Receipt consumption only within owner-authority transaction; no service direct
-- execute grant. Likewise trigger entrypoint is never exposed as ordinary RPC.

-- Explicitly revoke ALL extant legacy booking-creation overloads; source inspection
-- found retained 17 + return-time 18 signatures. This catches other applied writer
-- signatures but is not a full deployed/default-ACL audit. Website Edge caller
-- uses service_role; no public SQL writer is part of documented guest API.
DO $$ DECLARE writer record;
BEGIN
  FOR writer IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('create_marketplace_booking','rent_create_booking_atomic')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', writer.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', writer.signature);
  END LOOP;
END $$;
COMMIT;
