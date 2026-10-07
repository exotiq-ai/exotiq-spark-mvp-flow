-- Service-authenticated Stripe proof boundary. References and browser redirects
-- are not payment evidence. No historical rows are silently backfilled.
CREATE TABLE public.external_payment_settlements (
  intent_id text NOT NULL, mode text NOT NULL CHECK(mode IN('test','live')),
  booking_id uuid NOT NULL REFERENCES public.bookings(id), leg text NOT NULL CHECK(leg IN('operator','exotiq')),
  amount_cents bigint NOT NULL CHECK(amount_cents>=0),currency text NOT NULL CHECK(currency~'^[a-z]{3}$'),
  event_id text NOT NULL, settled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(intent_id,mode)
);
CREATE INDEX ON public.external_payment_settlements(booking_id,leg);
CREATE TABLE public.external_lifecycle_events (
  consumer text NOT NULL CHECK(consumer IN('identity','rent')),event_id text NOT NULL,
  event_created bigint,first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_until timestamptz,claim_token uuid,completed_at timestamptz,PRIMARY KEY(consumer,event_id)
);
CREATE TABLE public.external_lifecycle_reconciliation_queue (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
  reason text NOT NULL CHECK(reason IN('partial_payment','duplicate_settlement','terminal_payment','identity_required','ambiguous_charge','snapshot_mismatch')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.identity_verifications ADD COLUMN external_last_event_created bigint NOT NULL DEFAULT 0;
ALTER TABLE public.external_payment_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_lifecycle_reconciliation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_payment_settlements,public.external_lifecycle_events,public.external_lifecycle_reconciliation_queue FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.external_payment_settlements,public.external_lifecycle_events,public.external_lifecycle_reconciliation_queue TO service_role;

CREATE FUNCTION public.external_lifecycle_financial_authority(_booking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT FROM public.external_request_idempotency WHERE booking_id=_booking)
 OR EXISTS(SELECT FROM public.external_request_idempotency request JOIN public.external_quotes q ON q.quote_id=request.quote_id
   JOIN public.bookings b ON b.id=request.booking_id WHERE b.id=_booking AND q.consumed_booking_id=b.id
   AND (q.operator_id,q.vehicle_id,q.customer_id,q.pickup_at,q.return_at)=(b.team_id,b.vehicle_id,b.customer_id,b.start_date,b.end_date)
   AND q.selected_options->>0=b.protection_tier
   AND (q.authority->'pricing'->>'operator_total_cents')::numeric=b.total_value*100
   AND (q.authority->'pricing'->>'platform_fee_cents')::bigint=b.platform_fee_cents
   AND (q.authority->'pricing'->>'protection_total_cents')::bigint=b.protection_total_cents
   AND (q.authority->'pricing'->>'state_fee_cents')::bigint=b.state_fee_cents
   AND (q.authority->'pricing'->>'processing_fee_cents')::bigint=b.processing_fee_cents)
$$;

CREATE FUNCTION public.external_lifecycle_identity_cleared(_customer uuid,_end timestamptz,_team uuid,_booking uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT FROM public.identity_verifications iv JOIN public.customers c ON c.id=iv.customer_id
   JOIN public.teams t ON t.id=c.team_id WHERE c.id=_customer AND c.team_id=_team
   AND c.identity_status='verified' AND c.id_verified IS TRUE AND iv.status='verified'
   AND iv.document_expiry>(clock_timestamp() AT TIME ZONE coalesce(t.timezone,'UTC'))::date
   AND iv.document_expiry>=(_end AT TIME ZONE coalesce(t.timezone,'UTC'))::date
   AND (NOT EXISTS(SELECT FROM public.external_request_idempotency current_request WHERE current_request.booking_id=_booking)
     OR EXISTS(SELECT FROM public.external_request_idempotency current_request
       JOIN public.external_customer_links link ON (link.issuer,link.subject,link.operator_id,link.customer_id)=(current_request.issuer,current_request.subject,current_request.operator_id,current_request.customer_id)
       JOIN public.bookings current_booking ON current_booking.id=current_request.booking_id
       WHERE current_request.booking_id=_booking AND link.revoked_at IS NULL AND iv.verified_at>=link.verified_at
       AND (iv.booking_ref=current_booking.booking_ref OR EXISTS(SELECT FROM public.external_request_idempotency previous_request JOIN public.bookings previous_booking ON previous_booking.id=previous_request.booking_id
         WHERE (previous_request.issuer,previous_request.subject,previous_request.customer_id,previous_request.operator_id)=(current_request.issuer,current_request.subject,current_request.customer_id,current_request.operator_id)
           AND previous_booking.booking_ref=iv.booking_ref)))) )
$$;
CREATE FUNCTION public.external_lifecycle_fully_settled(_booking uuid,_mode text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT b.payment_due_at IS NOT NULL AND b.total_value*100=trunc(b.total_value*100) AND public.external_lifecycle_financial_authority(b.id)
 AND (SELECT count(*)=1 AND min(s.amount_cents)=b.total_value*100 FROM public.external_payment_settlements s WHERE s.booking_id=b.id AND s.leg='operator' AND s.mode=_mode)
 AND (SELECT count(*)=1 AND min(s.amount_cents)=b.platform_fee_cents+b.protection_total_cents+b.state_fee_cents+b.processing_fee_cents FROM public.external_payment_settlements s WHERE s.booking_id=b.id AND s.leg='exotiq' AND s.mode=_mode)
 FROM public.bookings b WHERE b.id=_booking AND b.booking_source='marketplace'
$$;
CREATE FUNCTION public.external_reconcile_booking(_booking_ref text,_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bookings%ROWTYPE; target text; paid boolean; has_money boolean;
BEGIN
 IF _mode IS NOT NULL AND _mode NOT IN('test','live') THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO b FROM public.bookings WHERE booking_ref=_booking_ref;
 IF NOT FOUND THEN RETURN jsonb_build_object('changed',false); END IF;
 PERFORM public.agent_inventory_lock(NULL,b.vehicle_id);
 SELECT * INTO b FROM public.bookings WHERE id=b.id FOR UPDATE;
 IF NOT public.external_lifecycle_financial_authority(b.id) THEN
   INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(b.id,'snapshot_mismatch',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at;
   RETURN jsonb_build_object('changed',false,'status',b.status);
 END IF;
 IF b.booking_source<>'marketplace' OR b.status='confirmed' THEN RETURN jsonb_build_object('changed',false,'status',b.status); END IF;
 paid:=public.external_lifecycle_fully_settled(b.id,_mode);
 has_money:=EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=b.id);
 IF b.status NOT IN('pending_payment','pending_documents') THEN
   IF has_money THEN INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(b.id,'terminal_payment',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at; END IF;
   RETURN jsonb_build_object('changed',false,'status',b.status);
 END IF;
 IF paid THEN
   target:=CASE WHEN public.external_lifecycle_identity_cleared(b.customer_id,b.end_date,b.team_id,b.id) THEN 'confirmed' ELSE 'pending_documents' END;
   UPDATE public.bookings SET status=target,paid_at=coalesce(paid_at,clock_timestamp()),payment_status='paid',balance_due=0,
    payment_stripe_mode=_mode,exotiq_charge_cents=platform_fee_cents+protection_total_cents+state_fee_cents+processing_fee_cents,
    confirmed_at=CASE WHEN target='confirmed' THEN coalesce(confirmed_at,clock_timestamp()) ELSE confirmed_at END WHERE id=b.id;
   IF target='confirmed' THEN DELETE FROM public.external_lifecycle_reconciliation_queue WHERE booking_id=b.id;
   ELSE INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(b.id,'identity_required',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at; END IF;
   RETURN jsonb_build_object('changed',target IS DISTINCT FROM b.status OR b.paid_at IS NULL,'status',target);
 END IF;
 IF has_money OR coalesce(b.operator_payment_intent_id,'')<>'' OR coalesce(b.exotiq_payment_intent_id,'')<>'' OR b.paid_at IS NOT NULL THEN
   INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(b.id,'partial_payment',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at;
 ELSIF b.status='pending_documents' AND public.external_lifecycle_identity_cleared(b.customer_id,b.end_date,b.team_id,b.id) THEN
   UPDATE public.bookings SET status='requested' WHERE id=b.id;
   RETURN jsonb_build_object('changed',true,'status','requested');
 END IF;
 RETURN jsonb_build_object('changed',false,'status',b.status);
END $$;
CREATE FUNCTION public.external_record_settlement(_event_id text,_booking_ref text,_leg text,_intent_id text,_amount_cents bigint,_currency text,_mode text,_operator_account text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.bookings%ROWTYPE; expected numeric; account text; actual_currency text; existing public.external_payment_settlements%ROWTYPE;
BEGIN
 IF _mode NOT IN('test','live') OR _leg NOT IN('operator','exotiq') OR _currency!~'^[a-z]{3}$' OR _amount_cents<0 OR length(_event_id)>256 OR length(_intent_id)>256 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 SELECT * INTO b FROM public.bookings WHERE booking_ref=_booking_ref AND booking_source='marketplace';
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 PERFORM public.agent_inventory_lock(NULL,b.vehicle_id);
 SELECT * INTO b FROM public.bookings WHERE id=b.id FOR UPDATE;
 SELECT CASE WHEN _mode='test' THEN stripe_test_account_id ELSE stripe_account_id END,lower(coalesce(currency,'USD')) INTO account,actual_currency FROM public.teams WHERE id=b.team_id;
 IF NOT public.external_lifecycle_financial_authority(b.id) THEN RAISE EXCEPTION 'consented_financial_snapshot_mismatch'; END IF;
 expected:=CASE WHEN _leg='operator' THEN b.total_value*100 ELSE b.platform_fee_cents+b.protection_total_cents+b.state_fee_cents+b.processing_fee_cents END;
 IF expected IS NULL OR expected<>_amount_cents OR actual_currency IS DISTINCT FROM _currency OR (_leg='operator' AND (account IS NULL OR account IS DISTINCT FROM _operator_account)) THEN RAISE EXCEPTION 'settlement_mismatch'; END IF;
 INSERT INTO public.external_payment_settlements(intent_id,mode,booking_id,leg,amount_cents,currency,event_id)
 VALUES(_intent_id,_mode,b.id,_leg,_amount_cents,_currency,_event_id) ON CONFLICT(intent_id,mode) DO NOTHING;
 SELECT * INTO existing FROM public.external_payment_settlements WHERE intent_id=_intent_id AND mode=_mode;
 IF (existing.booking_id,existing.leg,existing.amount_cents,existing.currency) IS DISTINCT FROM (b.id,_leg,_amount_cents,_currency) THEN RAISE EXCEPTION 'settlement_mismatch'; END IF;
 IF (SELECT count(*) FROM public.external_payment_settlements WHERE booking_id=b.id AND leg=_leg AND mode=_mode)>1 THEN
  INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(b.id,'duplicate_settlement',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at;
 END IF;
 UPDATE public.bookings SET operator_payment_intent_id=CASE WHEN _leg='operator' THEN coalesce(operator_payment_intent_id,_intent_id) ELSE operator_payment_intent_id END,
 exotiq_payment_intent_id=CASE WHEN _leg='exotiq' THEN coalesce(exotiq_payment_intent_id,_intent_id) ELSE exotiq_payment_intent_id END,payment_stripe_mode=_mode WHERE id=b.id;
 RETURN jsonb_build_object('recorded',true);
END $$;
CREATE FUNCTION public.external_apply_identity_event(_event_id text,_created bigint,_session_id text,_status text,_document_expiry date,_verified_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE iv public.identity_verifications%ROWTYPE; item record; mode text; inserted int;
BEGIN
 IF _status NOT IN('processing','verified','requires_input','canceled','redacted') OR _created<0 OR length(_event_id)>256 OR length(_session_id)>256 OR length(_verified_name)>512 OR (_status='verified' AND _document_expiry IS NULL) THEN RAISE EXCEPTION 'invalid_input'; END IF;
 -- Lock inventory before identity and booking rows; operator edits use same order.
 FOR item IN SELECT b.vehicle_id FROM public.bookings b JOIN public.identity_verifications v ON v.customer_id=b.customer_id WHERE v.stripe_verification_session_id=_session_id AND b.booking_source='marketplace' AND b.status='pending_documents' ORDER BY b.vehicle_id LOOP PERFORM public.agent_inventory_lock(NULL,item.vehicle_id); END LOOP;
 SELECT * INTO iv FROM public.identity_verifications WHERE stripe_verification_session_id=_session_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('applied',false); END IF;
 INSERT INTO public.external_lifecycle_events(consumer,event_id,event_created,completed_at) VALUES('identity',_event_id,_created,clock_timestamp()) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=0 THEN RETURN jsonb_build_object('applied',false,'duplicate',true); END IF;
 IF _created<iv.external_last_event_created OR (iv.status='verified' AND _status NOT IN('verified','redacted')) THEN RETURN jsonb_build_object('applied',false,'stale',true); END IF;
 UPDATE public.identity_verifications SET status=CASE WHEN _status='requires_input' AND attempt_count+1>=3 THEN 'manual_review' ELSE _status END,
 attempt_count=attempt_count+CASE WHEN _status='requires_input' THEN 1 ELSE 0 END,
 external_last_event_created=_created,document_expiry=CASE WHEN _status='verified' THEN _document_expiry ELSE document_expiry END,
 verified_name=CASE WHEN _status='verified' THEN _verified_name WHEN _status='redacted' THEN NULL ELSE verified_name END,
 verified_at=CASE WHEN _status='verified' THEN clock_timestamp() ELSE verified_at END,
 redacted_at=CASE WHEN _status='redacted' THEN clock_timestamp() ELSE redacted_at END WHERE id=iv.id RETURNING * INTO iv;
 UPDATE public.customers SET identity_status=iv.status,id_verified=(iv.status='verified'),id_verified_at=CASE WHEN iv.status='verified' THEN clock_timestamp() ELSE id_verified_at END WHERE id=iv.customer_id;
 FOR item IN SELECT booking_ref,payment_stripe_mode stripe_mode FROM public.bookings WHERE customer_id=iv.customer_id AND booking_source='marketplace' AND status='pending_documents' ORDER BY vehicle_id LOOP
  PERFORM public.external_reconcile_booking(item.booking_ref,item.stripe_mode);
 END LOOP;
 RETURN jsonb_build_object('applied',true,'status',iv.status,'customer_id',iv.customer_id,'attempt_count',iv.attempt_count);
END $$;
CREATE OR REPLACE FUNCTION public.guard_marketplace_confirm_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.booking_source='marketplace' AND NEW.status='confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
  IF OLD.status NOT IN('pending_payment','pending_documents') OR NOT coalesce(public.external_lifecycle_fully_settled(OLD.id,NEW.payment_stripe_mode),false) OR NOT public.external_lifecycle_identity_cleared(NEW.customer_id,NEW.end_date,NEW.team_id,NEW.id) THEN RAISE EXCEPTION 'marketplace_confirmation_prerequisites_missing' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_marketplace_confirm ON public.bookings;
CREATE TRIGGER trg_guard_marketplace_confirm BEFORE UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_confirm_transition();
CREATE FUNCTION public.external_reconcile_lifecycle_batch(_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; count integer:=0;
BEGIN
 IF _limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_input'; END IF;
 FOR item IN SELECT booking_ref,payment_stripe_mode mode FROM public.bookings WHERE booking_source='marketplace' AND status IN('pending_payment','pending_documents') ORDER BY updated_at,id LIMIT _limit LOOP
  PERFORM public.external_reconcile_booking(item.booking_ref,item.mode);count:=count+1;
 END LOOP;
 RETURN count;
END $$;
CREATE FUNCTION public.external_claim_rent_event(_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.external_lifecycle_events%ROWTYPE;
BEGIN
 IF length(_event_id)>256 OR _event_id IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
 INSERT INTO public.external_lifecycle_events(consumer,event_id) VALUES('rent',_event_id) ON CONFLICT DO NOTHING;
 SELECT * INTO item FROM public.external_lifecycle_events WHERE consumer='rent' AND event_id=_event_id FOR UPDATE;
 IF item.completed_at IS NOT NULL THEN RETURN jsonb_build_object('state','completed'); END IF;
 IF item.first_seen_at<clock_timestamp()-interval '23 hours' THEN RETURN jsonb_build_object('state','reconciliation_required'); END IF;
 IF item.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('state','busy'); END IF;
 UPDATE public.external_lifecycle_events SET lease_until=clock_timestamp()+interval '5 minutes',claim_token=gen_random_uuid() WHERE consumer='rent' AND event_id=_event_id RETURNING * INTO item;
 RETURN jsonb_build_object('state','claimed','claim_token',item.claim_token);
END $$;
CREATE FUNCTION public.external_finish_rent_event(_event_id text,_claim_token uuid,_completed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.external_lifecycle_events SET completed_at=CASE WHEN _completed THEN clock_timestamp() ELSE completed_at END,lease_until=NULL WHERE consumer='rent' AND event_id=_event_id AND claim_token=_claim_token AND lease_until>clock_timestamp();
 RETURN FOUND;
END
$$;
-- Existing expiry policies stay 24h/72h and approved payment deadline. Prevent
-- payment expiry from releasing any reference, paid row or settled leg.
CREATE FUNCTION public.external_preserve_financial_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status IN('cancelled','payment_expired') AND OLD.status IN('pending_payment','pending_documents','requested') AND
 (OLD.paid_at IS NOT NULL OR coalesce(OLD.operator_payment_intent_id,'')<>'' OR coalesce(OLD.exotiq_payment_intent_id,'')<>'' OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=OLD.id)) THEN
  INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(OLD.id,'partial_payment',clock_timestamp()) ON CONFLICT(booking_id) DO UPDATE SET updated_at=excluded.updated_at;
  RETURN NULL; -- expiry sweep returns no canceled row; preserve inventory
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER b_external_preserve_financial_hold BEFORE UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.external_preserve_financial_hold();
REVOKE ALL ON FUNCTION public.external_lifecycle_identity_cleared(uuid,timestamptz,uuid,uuid),public.external_lifecycle_fully_settled(uuid,text),public.external_reconcile_booking(text,text),public.external_record_settlement(text,text,text,text,bigint,text,text,text),public.external_apply_identity_event(text,bigint,text,text,date,text),public.external_reconcile_lifecycle_batch(integer),public.external_preserve_financial_hold() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_lifecycle_identity_cleared(uuid,timestamptz,uuid,uuid),public.external_lifecycle_fully_settled(uuid,text),public.external_reconcile_booking(text,text),public.external_record_settlement(text,text,text,text,bigint,text,text,text),public.external_apply_identity_event(text,bigint,text,text,date,text),public.external_reconcile_lifecycle_batch(integer) TO service_role;
REVOKE ALL ON FUNCTION public.external_claim_rent_event(text),public.external_finish_rent_event(text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_claim_rent_event(text),public.external_finish_rent_event(text,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.external_lifecycle_financial_authority(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_lifecycle_financial_authority(uuid) TO service_role;
