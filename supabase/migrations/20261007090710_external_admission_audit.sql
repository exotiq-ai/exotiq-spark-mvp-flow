-- Final transactional admission. Database triggers protect every real writer,
-- including service RPC calls that bypass the HTTP operation classifier.
-- Replay reads existing ledgers before insertion and therefore remains live.
CREATE FUNCTION public.external_require_new_activity(_operator uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE enabled boolean; opted_in boolean;
BEGIN
 SELECT external_api_new_writes_enabled INTO enabled FROM public.external_api_runtime_settings WHERE singleton FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
 SELECT external_api_enabled INTO opted_in FROM public.external_operator_api_settings WHERE operator_id=_operator FOR SHARE;
 IF enabled IS DISTINCT FROM true OR opted_in IS DISTINCT FROM true THEN RAISE EXCEPTION 'external_writes_disabled';END IF;
 -- Both shared row locks are held until this transaction ends. A successful
 -- disable serializes with an admitted writer; no cached enabled decision.
END $$;

CREATE FUNCTION public.external_require_charge_capability(_authority jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE operator_cents numeric; exotiq_cents numeric;
BEGIN
 IF _authority->'pricing'->>'currency' IS DISTINCT FROM 'USD'
  OR jsonb_typeof(_authority->'pricing'->'operator_total_cents') IS DISTINCT FROM 'number'
  OR jsonb_typeof(_authority->'pricing'->'exotiq_total_cents') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
 operator_cents:=(_authority->'pricing'->>'operator_total_cents')::numeric;
 exotiq_cents:=(_authority->'pricing'->>'exotiq_total_cents')::numeric;
 -- USD settlement minimum50 cents; conservative eight-digit supported card
 -- amount range. The source operator checkout cannot settle a zero leg.
 -- A zero Exotiq leg is explicitly settled without a provider charge by09.
 IF operator_cents<>trunc(operator_cents) OR operator_cents NOT BETWEEN 50 AND 99999999
  OR exotiq_cents<>trunc(exotiq_cents) OR (exotiq_cents<>0 AND exotiq_cents NOT BETWEEN 50 AND 99999999)
 THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
END $$;

CREATE FUNCTION public.external_guard_new_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE authority jsonb;
BEGIN
 PERFORM public.external_require_new_activity(NEW.operator_id);
 IF TG_TABLE_NAME='external_quotes' THEN authority:=NEW.authority;
 ELSE SELECT q.authority INTO authority FROM public.external_quotes q WHERE q.quote_id=NEW.quote_id FOR SHARE;
 END IF;
 PERFORM public.external_require_charge_capability(authority);
 RETURN NEW;
END $$;
CREATE TRIGGER external_quote_admission BEFORE INSERT ON public.external_quotes FOR EACH ROW EXECUTE FUNCTION public.external_guard_new_activity();
CREATE TRIGGER external_consent_admission BEFORE INSERT ON public.external_consent_receipts FOR EACH ROW EXECUTE FUNCTION public.external_guard_new_activity();
CREATE TRIGGER external_request_admission BEFORE INSERT ON public.external_request_idempotency FOR EACH ROW EXECUTE FUNCTION public.external_guard_new_activity();

-- Required request/financial events enter a redacted durable outbox in their
-- own authoritative transaction. Optional HTTP timing telemetry is separate.
CREATE FUNCTION public.external_audit_authoritative_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE event jsonb; request_row public.external_request_idempotency%ROWTYPE; q public.external_quotes%ROWTYPE;
BEGIN
 event:=jsonb_build_object('request_id',gen_random_uuid()::text,'outcome','success');
 IF TG_TABLE_NAME='external_quotes' THEN
  event:=event||jsonb_build_object('action','quote:create','operator_id',NEW.operator_id,'quote_id',NEW.quote_id,'terms_version',NEW.terms_version,'pricing_version',NEW.pricing_version);
 ELSIF TG_TABLE_NAME='external_request_idempotency' THEN
  IF NEW.booking_id IS NULL OR OLD.booking_id IS NOT NULL THEN RETURN NEW;END IF;
  SELECT * INTO q FROM public.external_quotes WHERE quote_id=NEW.quote_id;
  IF public.external_lifecycle_financial_authority(NEW.booking_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'financial_snapshot_mismatch';END IF;
  event:=event||jsonb_build_object('action','request:create','operator_id',NEW.operator_id,'quote_id',NEW.quote_id,'booking_id',NEW.booking_id,'itemization_equal',true,'terms_version',q.terms_version,'pricing_version',q.pricing_version);
 ELSIF TG_TABLE_NAME='external_payment_settlements' THEN
  SELECT * INTO request_row FROM public.external_request_idempotency WHERE booking_id=NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW;END IF;
  IF public.external_lifecycle_financial_authority(NEW.booking_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'financial_snapshot_mismatch';END IF;
  event:=event||jsonb_build_object('action','payment:settlement','operator_id',request_row.operator_id,'quote_id',request_row.quote_id,'booking_id',NEW.booking_id,'itemization_equal',true);
 ELSE
  IF NEW.status IS DISTINCT FROM 'confirmed' OR OLD.status IS NOT DISTINCT FROM 'confirmed' THEN RETURN NEW;END IF;
  SELECT * INTO request_row FROM public.external_request_idempotency WHERE booking_id=NEW.id;
  IF NOT FOUND THEN RETURN NEW;END IF;
  IF public.external_lifecycle_financial_authority(NEW.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'financial_snapshot_mismatch';END IF;
  event:=event||jsonb_build_object('action','payment:confirmation','operator_id',request_row.operator_id,'quote_id',request_row.quote_id,'booking_id',NEW.id,'itemization_equal',true);
 END IF;
 PERFORM public.external_enqueue_redacted_event(event);
 RETURN NEW;
END $$;
CREATE TRIGGER external_quote_audit AFTER INSERT ON public.external_quotes FOR EACH ROW EXECUTE FUNCTION public.external_audit_authoritative_transition();
CREATE TRIGGER external_request_audit AFTER UPDATE OF booking_id ON public.external_request_idempotency FOR EACH ROW EXECUTE FUNCTION public.external_audit_authoritative_transition();
CREATE TRIGGER external_settlement_audit AFTER INSERT ON public.external_payment_settlements FOR EACH ROW EXECUTE FUNCTION public.external_audit_authoritative_transition();
CREATE TRIGGER external_confirmation_audit AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.external_audit_authoritative_transition();
REVOKE ALL ON FUNCTION public.external_require_new_activity(uuid),public.external_require_charge_capability(jsonb),public.external_guard_new_activity(),public.external_audit_authoritative_transition() FROM PUBLIC,anon,authenticated,service_role;
