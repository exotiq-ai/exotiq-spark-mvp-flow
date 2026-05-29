
ALTER TABLE public.partner_payouts
  ADD COLUMN IF NOT EXISTS reconcile_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconcile_note text;

CREATE INDEX IF NOT EXISTS idx_partner_payouts_reconcile_flag
  ON public.partner_payouts (team_id)
  WHERE reconcile_flag = true;

-- Replace generator to flag mismatches on paid/voided rows and recompute pending only
CREATE OR REPLACE FUNCTION public.fn_generate_partner_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vehicle RECORD;
  v_base NUMERIC;
  v_net NUMERIC;
  v_partner_share NUMERIC;
  v_days NUMERIC;
  v_existing public.partner_payouts;
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND OLD.total_value IS NOT DISTINCT FROM NEW.total_value AND OLD.daily_rate IS NOT DISTINCT FROM NEW.daily_rate AND OLD.start_date IS NOT DISTINCT FROM NEW.start_date AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date AND OLD.platform_fee_amount IS NOT DISTINCT FROM NEW.platform_fee_amount) THEN
    -- nothing to do unless the booking just completed or money/dates changed
    IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  END IF;

  IF NEW.vehicle_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, ownership_type, partner_id, split_type, split_value, team_id
  INTO v_vehicle
  FROM public.vehicles WHERE id = NEW.vehicle_id;

  IF v_vehicle.ownership_type <> 'partnered'
     OR v_vehicle.partner_id IS NULL
     OR v_vehicle.split_type IS NULL
     OR v_vehicle.split_value IS NULL THEN
    RETURN NEW;
  END IF;

  v_base := public.compute_rental_base(NEW.daily_rate, NEW.start_date, NEW.end_date, NEW.rental_duration_type);
  IF COALESCE(v_base, 0) = 0 THEN
    v_base := COALESCE(NEW.total_value, 0);
  END IF;
  v_net := GREATEST(v_base - COALESCE(NEW.platform_fee_amount, 0), 0);

  IF v_vehicle.split_type = 'percentage' THEN
    v_partner_share := ROUND(v_net * (v_vehicle.split_value / 100.0), 2);
  ELSE
    v_days := GREATEST(CEIL(EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date))/86400.0), 1);
    v_partner_share := LEAST(ROUND(v_vehicle.split_value * v_days, 2), v_net);
  END IF;

  SELECT * INTO v_existing FROM public.partner_payouts WHERE booking_id = NEW.id;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.partner_payouts (
      team_id, booking_id, vehicle_id, partner_id,
      gross_rental_base, platform_fee_amount, net_after_fee,
      net_to_partner, split_type, split_value_snapshot, status
    ) VALUES (
      NEW.team_id, NEW.id, NEW.vehicle_id, v_vehicle.partner_id,
      v_base, COALESCE(NEW.platform_fee_amount,0), v_net,
      v_partner_share, v_vehicle.split_type, v_vehicle.split_value, 'pending'
    );
  ELSIF v_existing.status IN ('pending', 'scheduled') THEN
    -- Safe to refresh pending rows
    UPDATE public.partner_payouts
    SET gross_rental_base = v_base,
        platform_fee_amount = COALESCE(NEW.platform_fee_amount,0),
        net_after_fee = v_net,
        net_to_partner = v_partner_share,
        reconcile_flag = false,
        reconcile_note = NULL,
        updated_at = now()
    WHERE id = v_existing.id;
  ELSE
    -- Paid or voided: never silently overwrite — flag if the booking now disagrees
    IF v_existing.gross_rental_base <> v_base OR v_existing.net_to_partner <> v_partner_share THEN
      UPDATE public.partner_payouts
      SET reconcile_flag = true,
          reconcile_note = format('Booking changed after payout. Recomputed base %s vs %s, partner %s vs %s.',
            v_base, v_existing.gross_rental_base, v_partner_share, v_existing.net_to_partner),
          updated_at = now()
      WHERE id = v_existing.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Extend the transition function with a 'recompute' action (managers+, pending only).
CREATE OR REPLACE FUNCTION public.fn_transition_payout(
  p_payout_id uuid,
  p_action text,
  p_paid_at timestamp with time zone DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_method text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS partner_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.partner_payouts;
  v_is_manager boolean;
  v_is_admin boolean;
  v_booking RECORD;
  v_vehicle RECORD;
  v_base NUMERIC;
  v_net NUMERIC;
  v_partner_share NUMERIC;
  v_days NUMERIC;
BEGIN
  SELECT * INTO v_row FROM public.partner_payouts WHERE id = p_payout_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;

  IF NOT public.is_team_member_of_record(auth.uid(), v_row.team_id) THEN
    RAISE EXCEPTION 'Not authorized for this team';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'owner'::app_role)
             OR public.has_role(auth.uid(), 'admin'::app_role);
  v_is_manager := v_is_admin OR public.has_role(auth.uid(), 'manager'::app_role);
  IF NOT v_is_manager THEN RAISE EXCEPTION 'Manager role or higher required'; END IF;

  IF p_action = 'mark_paid' THEN
    IF v_row.status NOT IN ('pending', 'scheduled') THEN
      RAISE EXCEPTION 'Only pending payouts can be marked paid (current: %)', v_row.status;
    END IF;
    UPDATE public.partner_payouts
    SET status='paid', paid_at=COALESCE(p_paid_at, now()),
        payout_reference=p_reference, payout_method=p_method,
        void_reason=NULL, voided_at=NULL, updated_at=now()
    WHERE id=p_payout_id RETURNING * INTO v_row;

  ELSIF p_action = 'void' THEN
    IF v_row.status = 'voided' THEN RAISE EXCEPTION 'Payout is already voided'; END IF;
    IF COALESCE(btrim(p_reason),'') = '' THEN
      RAISE EXCEPTION 'A reason is required to void a payout';
    END IF;
    UPDATE public.partner_payouts
    SET status='voided', voided_at=now(), void_reason=p_reason,
        reconcile_flag=false, reconcile_note=NULL, updated_at=now()
    WHERE id=p_payout_id RETURNING * INTO v_row;

  ELSIF p_action = 'reopen' THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Only Owners or Admins can re-open a payout'; END IF;
    IF v_row.status <> 'voided' THEN
      RAISE EXCEPTION 'Only voided payouts can be re-opened (current: %)', v_row.status;
    END IF;
    UPDATE public.partner_payouts
    SET status='pending', voided_at=NULL, void_reason=NULL,
        paid_at=NULL, payout_reference=NULL, payout_method=NULL, updated_at=now()
    WHERE id=p_payout_id RETURNING * INTO v_row;

  ELSIF p_action = 'recompute' THEN
    IF v_row.status NOT IN ('pending', 'scheduled') THEN
      RAISE EXCEPTION 'Only pending payouts can be recomputed (current: %)', v_row.status;
    END IF;
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_row.booking_id;
    IF v_booking.id IS NULL THEN RAISE EXCEPTION 'Source booking not found'; END IF;
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_row.vehicle_id;

    v_base := public.compute_rental_base(v_booking.daily_rate, v_booking.start_date, v_booking.end_date, v_booking.rental_duration_type);
    IF COALESCE(v_base,0) = 0 THEN v_base := COALESCE(v_booking.total_value,0); END IF;
    v_net := GREATEST(v_base - COALESCE(v_booking.platform_fee_amount,0), 0);

    IF v_vehicle.split_type = 'percentage' THEN
      v_partner_share := ROUND(v_net * (v_vehicle.split_value / 100.0), 2);
    ELSE
      v_days := GREATEST(CEIL(EXTRACT(EPOCH FROM (v_booking.end_date - v_booking.start_date))/86400.0), 1);
      v_partner_share := LEAST(ROUND(v_vehicle.split_value * v_days, 2), v_net);
    END IF;

    UPDATE public.partner_payouts
    SET gross_rental_base=v_base,
        platform_fee_amount=COALESCE(v_booking.platform_fee_amount,0),
        net_after_fee=v_net,
        net_to_partner=v_partner_share,
        reconcile_flag=false, reconcile_note=NULL, updated_at=now()
    WHERE id=p_payout_id RETURNING * INTO v_row;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN v_row;
END;
$function$;
