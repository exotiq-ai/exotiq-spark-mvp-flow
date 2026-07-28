
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS expiry_warning_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.find_holds_needing_warning()
RETURNS TABLE(
  id uuid,
  booking_ref text,
  status text,
  customer_email text,
  customer_name text,
  team_id uuid,
  vehicle_id uuid,
  vehicle_name text,
  start_date timestamptz,
  end_date timestamptz,
  pickup_location text,
  confirmation_token uuid,
  deadline timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, b.booking_ref, b.status, b.customer_email, b.customer_name,
         b.team_id, b.vehicle_id, b.vehicle_name, b.start_date, b.end_date,
         b.pickup_location, b.confirmation_token,
         CASE
           WHEN b.status = 'pending_documents' THEN b.created_at + interval '24 hours'
           WHEN b.status = 'requested'         THEN b.created_at + interval '72 hours'
         END AS deadline
    FROM public.bookings b
   WHERE b.booking_source = 'marketplace'
     AND b.expiry_warning_sent_at IS NULL
     AND (b.operator_payment_intent_id IS NULL OR b.operator_payment_intent_id = '')
     AND (b.exotiq_payment_intent_id IS NULL OR b.exotiq_payment_intent_id = '')
     AND (
           (b.status = 'pending_documents'
             AND b.created_at + interval '24 hours' BETWEEN now() AND now() + interval '6 hours')
        OR (b.status = 'requested'
             AND b.created_at + interval '72 hours' BETWEEN now() AND now() + interval '12 hours')
         );
$$;

REVOKE ALL ON FUNCTION public.find_holds_needing_warning() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_holds_needing_warning() TO service_role;
