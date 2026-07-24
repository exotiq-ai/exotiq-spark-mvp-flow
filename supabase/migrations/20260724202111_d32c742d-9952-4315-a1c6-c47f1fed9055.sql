ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamp with time zone;

DROP FUNCTION IF EXISTS public.expire_overdue_payment_bookings();

CREATE OR REPLACE FUNCTION public.expire_overdue_payment_bookings()
RETURNS TABLE (
  booking_id uuid,
  booking_ref text,
  team_id uuid,
  vehicle_id uuid,
  customer_email text,
  customer_name text,
  vehicle_name text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  pickup_location text,
  total_value numeric,
  platform_fee_cents bigint,
  protection_total_cents bigint,
  confirmation_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.bookings b
     SET status = 'payment_expired'
   WHERE b.status = 'pending_payment'
     AND b.booking_source = 'marketplace'
     AND b.payment_due_at IS NOT NULL
     AND b.payment_due_at < now()
  RETURNING
    b.id AS booking_id,
    b.booking_ref AS booking_ref,
    b.team_id AS team_id,
    b.vehicle_id AS vehicle_id,
    b.customer_email AS customer_email,
    b.customer_name AS customer_name,
    b.vehicle_name AS vehicle_name,
    b.start_date AS start_date,
    b.end_date AS end_date,
    b.pickup_location AS pickup_location,
    b.total_value AS total_value,
    b.platform_fee_cents AS platform_fee_cents,
    b.protection_total_cents AS protection_total_cents,
    b.confirmation_token AS confirmation_token;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_payment_bookings() TO service_role;