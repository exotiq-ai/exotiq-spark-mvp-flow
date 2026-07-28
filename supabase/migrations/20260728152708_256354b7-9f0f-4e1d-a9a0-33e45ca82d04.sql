
DROP FUNCTION IF EXISTS public.expire_unverified_holds();

CREATE OR REPLACE FUNCTION public.expire_unverified_holds()
RETURNS TABLE(booking_id uuid, booking_ref text, status text, customer_email text, team_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.bookings b
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = CASE
           WHEN b.status = 'pending_documents' THEN 'unverified_hold_expired'
           WHEN b.status = 'requested'         THEN 'operator_did_not_respond'
           ELSE 'unverified_hold_expired'
         END
   WHERE b.booking_source = 'marketplace'
     AND (b.operator_payment_intent_id IS NULL OR b.operator_payment_intent_id = '')
     AND (b.exotiq_payment_intent_id IS NULL OR b.exotiq_payment_intent_id = '')
     AND (
           (b.status = 'pending_documents' AND b.created_at < now() - interval '24 hours')
        OR (b.status = 'requested'         AND b.created_at < now() - interval '72 hours')
         )
  RETURNING b.id, b.booking_ref, b.cancellation_reason, b.customer_email, b.team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_unverified_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_unverified_holds() TO service_role;
