-- Phase 1 foundation: captured-leg helper
-- A marketplace booking has a "captured leg" if the operator or platform
-- payment intent was created, regardless of whether paid_at was ever set.
-- This is the source of truth for "did the renter's card actually get charged?"

CREATE OR REPLACE FUNCTION public.booking_has_captured_leg(b public.bookings)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    b.operator_payment_intent_id IS NOT NULL
    OR b.exotiq_payment_intent_id IS NOT NULL
    OR b.paid_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.booking_has_captured_leg(public.bookings) IS
  'Returns true if a marketplace booking has any captured Stripe leg (operator PI, platform PI, or paid_at). Used by cancel/refund/expiry paths to avoid orphaning renter charges.';

-- Companion scalar variant for use in WHERE clauses without composite arg
CREATE OR REPLACE FUNCTION public.booking_has_captured_leg(
  _operator_pi text,
  _exotiq_pi text,
  _paid_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _operator_pi IS NOT NULL OR _exotiq_pi IS NOT NULL OR _paid_at IS NOT NULL;
$$;

-- Update the expiry sweep to exclude captured legs -- route to ops instead
CREATE OR REPLACE FUNCTION public.expire_overdue_payment_bookings()
RETURNS TABLE(
  booking_id uuid,
  booking_ref text,
  team_id uuid,
  vehicle_id uuid,
  customer_email text,
  customer_name text,
  vehicle_name text,
  start_date timestamptz,
  end_date timestamptz,
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
  WITH expired AS (
    UPDATE public.bookings b
    SET status = 'payment_expired',
        updated_at = now()
    WHERE b.status = 'pending_payment'
      AND b.payment_due_at IS NOT NULL
      AND b.payment_due_at < now()
      AND b.booking_source = 'marketplace'
      -- CRITICAL: never expire a booking that has a captured leg.
      -- If a PI exists, the renter's card was charged; hand to ops queue.
      AND b.operator_payment_intent_id IS NULL
      AND b.exotiq_payment_intent_id IS NULL
      AND b.paid_at IS NULL
    RETURNING b.*
  )
  SELECT
    e.id,
    e.booking_ref,
    e.team_id,
    e.vehicle_id,
    e.customer_email,
    e.customer_name,
    COALESCE(v.year::text || ' ' || v.make || ' ' || v.model, 'Vehicle') AS vehicle_name,
    e.start_date,
    e.end_date,
    e.pickup_location,
    e.total_value,
    e.platform_fee_cents,
    e.protection_total_cents,
    e.confirmation_token
  FROM expired e
  LEFT JOIN public.vehicles v ON v.id = e.vehicle_id;
END;
$$;

COMMENT ON FUNCTION public.expire_overdue_payment_bookings() IS
  'Expires overdue pending_payment marketplace bookings. Explicitly SKIPS bookings with a captured leg (operator/exotiq PI or paid_at) so renters are never orphaned. Ops must reconcile skipped rows.';