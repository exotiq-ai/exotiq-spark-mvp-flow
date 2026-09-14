-- Marketplace eligibility now requires billing in good standing.
CREATE OR REPLACE FUNCTION public.is_marketplace_team(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id
      AND t.marketplace_visible = true
      AND t.marketplace_request_status = 'approved'
      AND coalesce(t.is_demo_account, false) = false
      AND coalesce(t.is_deleted, false) = false
      AND (
        t.billing_status IS NULL
        OR t.billing_status IN ('grandfathered','trialing','active','past_due')
      )
  );
$$;

-- Booking/payment creation requires an activated, non-delinquent account.
DROP POLICY IF EXISTS "Users can insert bookings" ON public.bookings;
CREATE POLICY "Users can insert bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.team_can_transact(team_id) OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.team_can_transact(team_id) OR public.is_super_admin(auth.uid()))
  );