-- fn_vehicle_pnl was unusable: the RETURNS TABLE output column `vehicle_id`
-- collides with the unqualified `vehicle_id` references inside the `exp` and
-- `payouts` CTEs, so every call raised
--   ERROR: column reference "vehicle_id" is ambiguous (42702).
-- Qualify every column reference. Calculation logic is unchanged.
CREATE OR REPLACE FUNCTION public.fn_vehicle_pnl(p_team_id uuid, p_start date, p_end date)
 RETURNS TABLE(vehicle_id uuid, vehicle_name text, gross_revenue numeric, platform_fees numeric, net_revenue numeric, total_expenses numeric, partner_payouts numeric, operator_net numeric, margin_pct numeric, booking_count integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT COALESCE(t.timezone, 'UTC') INTO v_tz FROM public.teams t WHERE t.id = p_team_id;
  v_tz := COALESCE(v_tz, 'UTC');

  RETURN QUERY
  WITH rev AS (
    SELECT
      b.vehicle_id AS veh_id,
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
    SELECT ve.vehicle_id AS veh_id, SUM(ve.amount) AS total
    FROM public.vehicle_expenses ve
    WHERE ve.team_id = p_team_id
      AND ve.vehicle_id IS NOT NULL
      AND ve.expense_date >= p_start AND ve.expense_date <= p_end
      AND ve.expense_type <> 'partner_payout'
    GROUP BY ve.vehicle_id
  ),
  payouts AS (
    SELECT pp.vehicle_id AS veh_id, SUM(pp.net_to_partner) AS total
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
  LEFT JOIN rev r ON r.veh_id = v.id
  LEFT JOIN exp e ON e.veh_id = v.id
  LEFT JOIN payouts p ON p.veh_id = v.id
  WHERE v.team_id = p_team_id
    AND (r.gross IS NOT NULL OR e.total IS NOT NULL OR p.total IS NOT NULL);
END;
$function$;