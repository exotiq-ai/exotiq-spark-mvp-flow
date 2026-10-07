-- Root-owned marked partial lab only: replaces the already-applied0730 guard.
BEGIN;
CREATE OR REPLACE FUNCTION public.external_checkout_reservation_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.rental_checkout_attempt_key IS NOT NULL OR OLD.rental_checkout_session_ref IS NOT NULL THEN
   RAISE EXCEPTION 'checkout_reservation_immutable' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
 END IF;
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
DROP TRIGGER a_external_checkout_reservation_immutable ON public.bookings;
CREATE TRIGGER a_external_checkout_reservation_immutable BEFORE UPDATE OR DELETE ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.external_checkout_reservation_immutable();
REVOKE ALL ON FUNCTION public.external_checkout_reservation_immutable() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
