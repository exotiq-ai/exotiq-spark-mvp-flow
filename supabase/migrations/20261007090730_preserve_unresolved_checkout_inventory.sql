BEGIN;
-- Missing/delayed webhooks are not authoritative unpaid evidence. An issued
-- session or lost provider response must retain inventory, including legacy
-- checkout reservations. This safe fallback queues manual provider review;
-- there is deliberately no timer, anonymous API, or worker that clears it.
ALTER TABLE public.bookings ADD COLUMN rental_checkout_reviewed_at timestamptz;
CREATE OR REPLACE FUNCTION public.external_preserve_financial_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status IN('cancelled','payment_expired') AND OLD.status IN('pending_payment','pending_documents','requested') THEN
  IF OLD.rental_checkout_attempt_key IS NOT NULL OR OLD.rental_checkout_session_ref IS NOT NULL THEN
   INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(OLD.id,'ambiguous_charge',clock_timestamp())
    ON CONFLICT(booking_id) DO UPDATE SET updated_at=excluded.updated_at;
   RETURN NULL;
  END IF;
  IF OLD.paid_at IS NOT NULL OR coalesce(OLD.operator_payment_intent_id,'')<>'' OR coalesce(OLD.exotiq_payment_intent_id,'')<>'' OR EXISTS(SELECT FROM public.external_payment_settlements WHERE booking_id=OLD.id) THEN
   INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(OLD.id,'partial_payment',clock_timestamp())
    ON CONFLICT(booking_id) DO UPDATE SET updated_at=excluded.updated_at;
   RETURN NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
-- A two-step clear-then-cancel must not bypass the hold through legacy booking
-- table updates. Narrow reservation functions only append first references.
CREATE FUNCTION public.external_checkout_reservation_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.rental_checkout_attempt_key IS NOT NULL AND (
  NEW.rental_checkout_attempt_key IS DISTINCT FROM OLD.rental_checkout_attempt_key OR
  NEW.rental_checkout_kind IS DISTINCT FROM OLD.rental_checkout_kind OR
  NEW.rental_checkout_mode IS DISTINCT FROM OLD.rental_checkout_mode OR
  NEW.rental_checkout_origin IS DISTINCT FROM OLD.rental_checkout_origin OR
  NEW.rental_checkout_created_at IS DISTINCT FROM OLD.rental_checkout_created_at OR
  NEW.rental_checkout_expires_at IS DISTINCT FROM OLD.rental_checkout_expires_at OR
  OLD.rental_checkout_customer_ref IS NOT NULL AND NEW.rental_checkout_customer_ref IS DISTINCT FROM OLD.rental_checkout_customer_ref OR
  OLD.rental_checkout_session_ref IS NOT NULL AND NEW.rental_checkout_session_ref IS DISTINCT FROM OLD.rental_checkout_session_ref
 ) THEN RAISE EXCEPTION 'checkout_reservation_immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_external_checkout_reservation_immutable BEFORE UPDATE ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.external_checkout_reservation_immutable();
CREATE FUNCTION public.external_queue_unresolved_checkout_batch(_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
 SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE item record;processed integer:=0;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';END IF;
 -- Oldest checked first, SKIP LOCKED and a fixed batch: a hot/uncertain row
 -- neither blocks other rentals nor monopolizes every subsequent worker run.
 FOR item IN SELECT id FROM public.bookings WHERE booking_source='marketplace'
  AND status IN('pending_payment','pending_documents','requested')
  AND payment_due_at IS NOT NULL AND payment_due_at<=clock_timestamp()
  AND (rental_checkout_attempt_key IS NOT NULL OR rental_checkout_session_ref IS NOT NULL)
  ORDER BY rental_checkout_reviewed_at NULLS FIRST,id LIMIT _limit FOR UPDATE SKIP LOCKED LOOP
   INSERT INTO public.external_lifecycle_reconciliation_queue VALUES(item.id,'ambiguous_charge',clock_timestamp())
    ON CONFLICT(booking_id) DO UPDATE SET updated_at=excluded.updated_at;
   UPDATE public.bookings SET rental_checkout_reviewed_at=clock_timestamp() WHERE id=item.id;
   processed:=processed+1;
 END LOOP;
 RETURN processed;
END $$;
REVOKE ALL ON FUNCTION public.external_preserve_financial_hold(),public.external_checkout_reservation_immutable() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.external_queue_unresolved_checkout_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_queue_unresolved_checkout_batch(integer) TO service_role;
COMMENT ON FUNCTION public.external_queue_unresolved_checkout_batch(integer) IS 'Bounded fair manual-review queue only. Issued/ambiguous checkout retains occupancy until authoritative provider reconciliation; elapsed deadlines, network failure or absent webhook never clear a hold. Automatic provider cleanup is not implemented.';
NOTIFY pgrst,'reload schema';
COMMIT;
