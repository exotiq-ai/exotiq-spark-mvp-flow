-- 1) booking_extensions: add protection column + consent channel + widen status set
ALTER TABLE public.booking_extensions
  ADD COLUMN IF NOT EXISTS added_protection_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_extensions_status_check'
      AND conrelid = 'public.booking_extensions'::regclass
  ) THEN
    ALTER TABLE public.booking_extensions
      DROP CONSTRAINT booking_extensions_status_check;
  END IF;
END$$;

ALTER TABLE public.booking_extensions
  ADD CONSTRAINT booking_extensions_status_check
  CHECK (status IN ('pending','paid','partially_paid','manual','failed','refunded'));

-- 2) Recreate public_booking_by_ref inside a single transaction so renters
--    hitting /booking/:ref never see a "function does not exist" gap. The
--    additive columns (state_fee_cents, processing_fee_cents) let the
--    renter app show the true amount charged; existing named-field reads
--    are unaffected.
DROP FUNCTION IF EXISTS public.public_booking_by_ref(text, uuid);

CREATE FUNCTION public.public_booking_by_ref(
  _booking_ref text,
  _token uuid DEFAULT NULL::uuid
) RETURNS TABLE(
  booking_ref text, status text, team_slug text, team_name text,
  vehicle_slug text, vehicle_name text,
  start_at timestamptz, end_at timestamptz,
  total_cents bigint, currency text, authorized boolean,
  payment_due_at timestamptz, paid_at timestamptz,
  protection_tier text, platform_fee_cents bigint, protection_total_cents bigint,
  identity_verified boolean,
  state_fee_cents bigint, processing_fee_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.booking_ref,
    b.status,
    t.slug,
    t.name,
    v.slug,
    v.name,
    b.start_date,
    b.end_date,
    round(b.total_value * 100)::bigint,
    t.currency,
    true,
    b.payment_due_at,
    b.paid_at,
    b.protection_tier,
    b.platform_fee_cents,
    b.protection_total_cents,
    EXISTS (
      SELECT 1
      FROM public.identity_verifications iv
      JOIN public.customers c ON c.id = iv.customer_id
      WHERE lower(c.email) = lower(b.customer_email)
        AND iv.status = 'verified'
        AND (iv.document_expiry IS NULL OR iv.document_expiry > now())
    ) AS identity_verified,
    b.state_fee_cents,
    b.processing_fee_cents
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.booking_ref = _booking_ref
    AND b.booking_source = 'marketplace'
    AND _token IS NOT NULL
    AND b.confirmation_token = _token
$$;

GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_booking_by_ref(text, uuid) TO authenticated;