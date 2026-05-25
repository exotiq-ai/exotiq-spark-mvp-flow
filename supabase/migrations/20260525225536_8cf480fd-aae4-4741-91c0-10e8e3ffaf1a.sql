
-- ============================================================
-- Margin Module Phase 1: Business Logic Triggers
-- ============================================================

-- ---------- Helper: compute_rental_base ----------
CREATE OR REPLACE FUNCTION public.compute_rental_base(
  p_daily_rate NUMERIC,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_duration_type TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  hours NUMERIC;
  days NUMERIC;
BEGIN
  IF p_daily_rate IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RETURN 0;
  END IF;
  hours := GREATEST(EXTRACT(EPOCH FROM (p_end - p_start)) / 3600.0, 0);
  IF p_duration_type = 'hourly' THEN
    -- treat daily_rate as effectively 8hr equivalent; rental base = (daily/8) * hours
    RETURN ROUND((p_daily_rate / 8.0) * hours, 2);
  ELSE
    days := CEIL(hours / 24.0);
    IF days < 1 THEN days := 1; END IF;
    RETURN ROUND(p_daily_rate * days, 2);
  END IF;
END;
$$;

-- ---------- Trigger: snapshot platform fee on bookings ----------
CREATE OR REPLACE FUNCTION public.fn_snapshot_platform_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct NUMERIC;
  v_base NUMERIC;
  v_was_completed BOOLEAN;
BEGIN
  -- Once completed, freeze snapshot (no further changes)
  IF TG_OP = 'UPDATE' THEN
    v_was_completed := (OLD.status = 'completed');
    IF v_was_completed THEN
      NEW.platform_fee_percent_snapshot := OLD.platform_fee_percent_snapshot;
      NEW.platform_fee_amount := OLD.platform_fee_amount;
      NEW.platform_fee_base := OLD.platform_fee_base;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.booking_source IN ('drive_exotiq','marketplace') AND NEW.team_id IS NOT NULL THEN
    SELECT COALESCE(platform_fee_percent, 10) INTO v_pct
    FROM public.teams WHERE id = NEW.team_id;
    v_pct := COALESCE(v_pct, 10);
    v_base := public.compute_rental_base(NEW.daily_rate, NEW.start_date, NEW.end_date, NEW.rental_duration_type);
    NEW.platform_fee_base := v_base;
    NEW.platform_fee_percent_snapshot := v_pct;
    NEW.platform_fee_amount := ROUND(v_base * v_pct / 100.0, 2);
  ELSE
    NEW.platform_fee_base := 0;
    NEW.platform_fee_percent_snapshot := 0;
    NEW.platform_fee_amount := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_platform_fee ON public.bookings;
CREATE TRIGGER trg_snapshot_platform_fee
  BEFORE INSERT OR UPDATE OF daily_rate, start_date, end_date, rental_duration_type, booking_source, status
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_snapshot_platform_fee();

-- ---------- Trigger: generate partner payout on completion ----------
CREATE OR REPLACE FUNCTION public.fn_generate_partner_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle RECORD;
  v_base NUMERIC;
  v_net NUMERIC;
  v_partner_share NUMERIC;
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
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

  v_base := COALESCE(NEW.platform_fee_base,
                     public.compute_rental_base(NEW.daily_rate, NEW.start_date, NEW.end_date, NEW.rental_duration_type));
  v_net := GREATEST(v_base - COALESCE(NEW.platform_fee_amount, 0), 0);

  IF v_vehicle.split_type = 'percentage' THEN
    -- split_value = operator's share %; partner gets the remainder
    v_partner_share := ROUND(v_net * ((100.0 - v_vehicle.split_value) / 100.0), 2);
  ELSE
    -- flat per-day to partner
    v_partner_share := LEAST(ROUND(v_vehicle.split_value * GREATEST(CEIL(EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date))/86400.0),1), 2), v_net);
  END IF;

  INSERT INTO public.partner_payouts (
    team_id, booking_id, vehicle_id, partner_id,
    gross_rental_base, platform_fee_amount, net_after_fee,
    net_to_partner, split_type, split_value_snapshot, status
  ) VALUES (
    NEW.team_id, NEW.id, NEW.vehicle_id, v_vehicle.partner_id,
    v_base, COALESCE(NEW.platform_fee_amount,0), v_net,
    v_partner_share, v_vehicle.split_type, v_vehicle.split_value, 'pending'
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    gross_rental_base = EXCLUDED.gross_rental_base,
    platform_fee_amount = EXCLUDED.platform_fee_amount,
    net_after_fee = EXCLUDED.net_after_fee,
    net_to_partner = EXCLUDED.net_to_partner,
    updated_at = now()
  WHERE public.partner_payouts.status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_partner_payout ON public.bookings;
CREATE TRIGGER trg_generate_partner_payout
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_generate_partner_payout();

-- ---------- Trigger: void payout on cancellation ----------
CREATE OR REPLACE FUNCTION public.fn_void_partner_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'cancelled' THEN
    UPDATE public.partner_payouts
    SET status = 'voided',
        voided_at = now(),
        void_reason = COALESCE(void_reason, 'Booking cancelled')
    WHERE booking_id = NEW.id AND status <> 'paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_void_partner_payout ON public.bookings;
CREATE TRIGGER trg_void_partner_payout
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_void_partner_payout();

-- ---------- Trigger: log damage expense ----------
CREATE OR REPLACE FUNCTION public.fn_log_damage_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  v_amount := COALESCE(NEW.actual_cost, NEW.estimated_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, booking_id, expense_type, amount,
    expense_date, notes, source_module, source_record_id, created_by
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.booking_id, 'damage', v_amount,
    COALESCE(NEW.reported_date::date, CURRENT_DATE),
    'Auto-logged from damage claim: ' || COALESCE(NEW.description, ''),
    'vault', NEW.id, NEW.user_id
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_damage_expense ON public.damage_claims;
CREATE TRIGGER trg_log_damage_expense
  AFTER INSERT OR UPDATE OF estimated_cost, actual_cost ON public.damage_claims
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_damage_expense();

-- ---------- Trigger: log maintenance expense ----------
CREATE OR REPLACE FUNCTION public.fn_log_maintenance_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.estimated_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, location_id, expense_type, amount,
    expense_date, vendor, notes, source_module, source_record_id, created_by
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.location_id, 'maintenance', v_amount,
    COALESCE(NEW.last_completed_at::date, CURRENT_DATE),
    NEW.service_provider,
    'Auto-logged from maintenance: ' || COALESCE(NEW.maintenance_type, ''),
    'pulse', NEW.id, NEW.user_id
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    vendor = EXCLUDED.vendor,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_maintenance_expense ON public.maintenance_schedules;
CREATE TRIGGER trg_log_maintenance_expense
  AFTER UPDATE OF status ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_maintenance_expense();

-- ---------- Tighten storage policies for expense-receipts ----------
DROP POLICY IF EXISTS "Managers can read expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete expense receipts" ON storage.objects;

-- Path convention: {team_id}/{filename}
CREATE POLICY "Team members can read expense receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true
  )
);
CREATE POLICY "Managers can upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true
  )
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Admins can delete expense receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true
  )
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);
