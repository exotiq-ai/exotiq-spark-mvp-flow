
-- ============================================================
-- Margin Module Phase 1: Reporting Layer
-- ============================================================

-- ---------- fn_vehicle_pnl ----------
CREATE OR REPLACE FUNCTION public.fn_vehicle_pnl(
  p_team_id UUID,
  p_start DATE,
  p_end DATE
) RETURNS TABLE (
  vehicle_id UUID,
  vehicle_name TEXT,
  gross_revenue NUMERIC,
  platform_fees NUMERIC,
  net_revenue NUMERIC,
  total_expenses NUMERIC,
  partner_payouts NUMERIC,
  operator_net NUMERIC,
  margin_pct NUMERIC,
  booking_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT COALESCE(timezone, 'UTC') INTO v_tz FROM public.teams WHERE id = p_team_id;
  v_tz := COALESCE(v_tz, 'UTC');

  RETURN QUERY
  WITH rev AS (
    SELECT
      b.vehicle_id,
      SUM(b.total_value) AS gross,
      SUM(b.platform_fee_amount) AS fees,
      COUNT(*)::int AS bookings
    FROM public.bookings b
    WHERE b.team_id = p_team_id
      AND b.status IN ('confirmed','active','completed')
      AND (b.start_date AT TIME ZONE v_tz)::date >= p_start
      AND (b.start_date AT TIME ZONE v_tz)::date <= p_end
      AND b.vehicle_id IS NOT NULL
    GROUP BY b.vehicle_id
  ),
  exp AS (
    SELECT vehicle_id, SUM(amount) AS total
    FROM public.vehicle_expenses
    WHERE team_id = p_team_id
      AND vehicle_id IS NOT NULL
      AND expense_date >= p_start AND expense_date <= p_end
      AND expense_type <> 'partner_payout'
    GROUP BY vehicle_id
  ),
  payouts AS (
    SELECT pp.vehicle_id, SUM(pp.net_to_partner) AS total
    FROM public.partner_payouts pp
    JOIN public.bookings b ON b.id = pp.booking_id
    WHERE pp.team_id = p_team_id
      AND pp.status <> 'voided'
      AND (b.start_date AT TIME ZONE v_tz)::date >= p_start
      AND (b.start_date AT TIME ZONE v_tz)::date <= p_end
    GROUP BY pp.vehicle_id
  )
  SELECT
    v.id,
    COALESCE(v.make || ' ' || v.model, 'Unknown')::text,
    COALESCE(r.gross, 0),
    COALESCE(r.fees, 0),
    COALESCE(r.gross, 0) - COALESCE(r.fees, 0),
    COALESCE(e.total, 0),
    COALESCE(p.total, 0),
    COALESCE(r.gross, 0) - COALESCE(r.fees, 0) - COALESCE(e.total, 0) - COALESCE(p.total, 0),
    CASE WHEN COALESCE(r.gross, 0) > 0
      THEN ROUND(((COALESCE(r.gross,0) - COALESCE(r.fees,0) - COALESCE(e.total,0) - COALESCE(p.total,0)) / r.gross) * 100, 2)
      ELSE 0
    END,
    COALESCE(r.bookings, 0)
  FROM public.vehicles v
  LEFT JOIN rev r ON r.vehicle_id = v.id
  LEFT JOIN exp e ON e.vehicle_id = v.id
  LEFT JOIN payouts p ON p.vehicle_id = v.id
  WHERE v.team_id = p_team_id
    AND (r.gross IS NOT NULL OR e.total IS NOT NULL OR p.total IS NOT NULL);
END;
$$;

-- ---------- View: booking_payment_summary ----------
CREATE OR REPLACE VIEW public.booking_payment_summary
WITH (security_invoker = true)
AS
SELECT
  b.id AS booking_id,
  b.team_id,
  b.total_value AS gross_value,
  b.platform_fee_amount,
  COALESCE(SUM(CASE WHEN p.payment_type <> 'refund' THEN p.amount ELSE 0 END), 0) AS collected,
  COALESCE(SUM(CASE WHEN p.payment_type = 'refund' THEN COALESCE(p.refund_amount, p.amount) ELSE 0 END), 0) AS refunded,
  b.total_value
    - COALESCE(SUM(CASE WHEN p.payment_type <> 'refund' THEN p.amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN p.payment_type = 'refund' THEN COALESCE(p.refund_amount, p.amount) ELSE 0 END), 0) AS outstanding
FROM public.bookings b
LEFT JOIN public.payments p ON p.booking_id = b.id
GROUP BY b.id;

-- ---------- View: revenue_by_source ----------
CREATE OR REPLACE VIEW public.revenue_by_source
WITH (security_invoker = true)
AS
SELECT
  team_id,
  booking_source,
  COUNT(*) AS booking_count,
  SUM(total_value) AS gross_revenue,
  SUM(platform_fee_amount) AS platform_fees,
  SUM(total_value - COALESCE(platform_fee_amount, 0)) AS net_revenue,
  DATE_TRUNC('month', start_date) AS month_bucket
FROM public.bookings
WHERE status IN ('confirmed','active','completed')
GROUP BY team_id, booking_source, DATE_TRUNC('month', start_date);

-- ---------- View: deposit_ledger ----------
CREATE OR REPLACE VIEW public.deposit_ledger
WITH (security_invoker = true)
AS
SELECT
  b.id AS booking_id,
  b.team_id,
  b.customer_name,
  b.security_deposit_amount AS deposit_held,
  b.security_deposit_status,
  b.start_date,
  b.end_date,
  b.status AS booking_status
FROM public.bookings b
WHERE COALESCE(b.security_deposit_amount, 0) > 0;
