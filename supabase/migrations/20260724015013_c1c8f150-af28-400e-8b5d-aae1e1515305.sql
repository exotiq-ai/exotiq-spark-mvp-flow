-- M6a — Payment foundations (renter money flow) — REV 2
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
CHECK (status = ANY (ARRAY[
  'pending', 'confirmed', 'active', 'completed', 'cancelled',
  'requested', 'pending_documents', 'pending_payment', 'declined', 'refunded',
  'payment_expired'
]));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_stripe_mode text;

COMMENT ON COLUMN public.bookings.payment_due_at IS
  'M6-D4: pending_payment expires at min(approval+48h, pickup-2h, floor now+2h); set by trigger, sweep releases the dates.';
COMMENT ON COLUMN public.bookings.payment_stripe_mode IS
  'test | live — stamped by the payment webhook so ledger/margin views can exclude sandbox traffic (M6a gate).';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_test_account_id text;

COMMENT ON COLUMN public.teams.stripe_test_account_id IS
  'Test-mode Stripe Connect account for sandbox payment runs (M6). Live id remains in stripe_account_id.';

CREATE OR REPLACE FUNCTION public.set_payment_due_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_pickup timestamptz;
  v_due timestamptz;
BEGIN
  IF NEW.status = 'pending_payment'
     AND (OLD.status IS DISTINCT FROM 'pending_payment')
     AND NEW.payment_due_at IS NULL THEN
    SELECT t.timezone INTO v_tz FROM public.teams t WHERE t.id = NEW.team_id;
    v_pickup := NEW.start_date::timestamp AT TIME ZONE coalesce(v_tz, 'UTC');
    v_due := LEAST(now() + interval '48 hours', v_pickup - interval '2 hours');
    NEW.payment_due_at := GREATEST(v_due, now() + interval '2 hours');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payment_due_at ON public.bookings;
CREATE TRIGGER trg_set_payment_due_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_due_at();

CREATE OR REPLACE FUNCTION public.expire_overdue_payment_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.bookings
     SET status = 'payment_expired'
   WHERE status = 'pending_payment'
     AND booking_source = 'marketplace'
     AND payment_due_at IS NOT NULL
     AND payment_due_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.expire_overdue_payment_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_payment_bookings() TO service_role;