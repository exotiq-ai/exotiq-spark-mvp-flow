
-- =============================================================
-- Margin: Review Queue, AI receipts, work-order & damage sync
-- =============================================================

-- 1. Extend vehicle_expenses with review-queue + AI columns
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS ai_parsed_fields jsonb,
  ADD COLUMN IF NOT EXISTS linked_damage_claim_id uuid,
  ADD COLUMN IF NOT EXISTS approval_threshold_applied numeric(12,2);

-- Status check constraint
ALTER TABLE public.vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_status_check;
ALTER TABLE public.vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_status_check
  CHECK (status IN ('pending_review','confirmed','rejected'));

-- Extend source_module check constraint
ALTER TABLE public.vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_source_module_check;
ALTER TABLE public.vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_source_module_check
  CHECK (source_module IN ('margin_manual','vault','pulse','bookings','motoriq','deposits','maintenance','work_orders','damage','ai_receipt'));

CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_team_status
  ON public.vehicle_expenses (team_id, status);

-- 2. Add actual_cost + completed_at to maintenance_schedules (work_orders already has them)
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS actual_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 3. Auto-approve threshold + always-review types on teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS expense_auto_approve_under numeric(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS expense_review_required_types text[] NOT NULL DEFAULT ARRAY['damage','partner_payout','maintenance']::text[];

-- 4. Updated maintenance_schedules sync — prefers actual_cost, sets review status
CREATE OR REPLACE FUNCTION public.fn_log_maintenance_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount NUMERIC;
  v_threshold NUMERIC;
  v_status TEXT;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.actual_cost, NEW.estimated_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(expense_auto_approve_under, 100) INTO v_threshold FROM public.teams WHERE id = NEW.team_id;
  v_status := CASE WHEN v_amount > v_threshold THEN 'pending_review' ELSE 'confirmed' END;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, location_id, expense_type, amount,
    expense_date, vendor, notes, source_module, source_record_id, created_by,
    status, review_reason, approval_threshold_applied
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.location_id, 'maintenance', v_amount,
    COALESCE(NEW.completed_at::date, NEW.last_completed_at::date, CURRENT_DATE),
    NEW.service_provider,
    'Auto-logged from maintenance: ' || COALESCE(NEW.maintenance_type, ''),
    'maintenance', NEW.id, NEW.user_id,
    v_status,
    CASE WHEN v_status = 'pending_review' THEN 'Maintenance cost exceeds auto-approve threshold' ELSE NULL END,
    v_threshold
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    vendor = EXCLUDED.vendor,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. New trigger function on work_orders → vehicle_expenses
CREATE OR REPLACE FUNCTION public.fn_log_work_order_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount NUMERIC;
  v_threshold NUMERIC;
  v_status TEXT;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.actual_cost, NEW.estimate_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(expense_auto_approve_under, 100) INTO v_threshold FROM public.teams WHERE id = NEW.team_id;
  v_status := CASE WHEN v_amount > v_threshold THEN 'pending_review' ELSE 'confirmed' END;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, location_id, expense_type, amount,
    expense_date, vendor, notes, source_module, source_record_id, created_by,
    status, review_reason, approval_threshold_applied
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.location_id, 'maintenance', v_amount,
    COALESCE(NEW.completed_at::date, CURRENT_DATE),
    NEW.vendor_name,
    'Work Order: ' || COALESCE(NEW.title, ''),
    'work_orders', NEW.id, NEW.created_by,
    v_status,
    CASE WHEN v_status = 'pending_review' THEN 'Work order cost exceeds auto-approve threshold' ELSE NULL END,
    v_threshold
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    vendor = EXCLUDED.vendor,
    notes = EXCLUDED.notes,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_work_order_expense ON public.work_orders;
CREATE TRIGGER trg_log_work_order_expense
  AFTER INSERT OR UPDATE OF status, actual_cost ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_work_order_expense();

-- 6. Damage claims → Review queue (owner must approve)
CREATE OR REPLACE FUNCTION public.fn_log_damage_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  v_amount := COALESCE(NEW.actual_cost, NEW.estimated_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, booking_id, expense_type, amount,
    expense_date, notes, source_module, source_record_id, created_by,
    status, review_reason, linked_damage_claim_id
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.booking_id, 'damage', v_amount,
    COALESCE(NEW.reported_date::date, CURRENT_DATE),
    'Damage claim: ' || COALESCE(NEW.description, ''),
    'damage', NEW.id, NEW.user_id,
    'pending_review',
    'Damage claim awaiting owner confirmation',
    NEW.id
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 7. Storage bucket for receipts (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for receipts: team-scoped via first folder = team_id
DROP POLICY IF EXISTS "Team members can view receipts" ON storage.objects;
CREATE POLICY "Team members can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.is_active = true
      AND tm.team_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Team members can upload receipts" ON storage.objects;
CREATE POLICY "Team members can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.is_active = true
      AND tm.team_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Team members can delete receipts" ON storage.objects;
CREATE POLICY "Team members can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.is_active = true
      AND tm.team_id::text = (storage.foldername(name))[1]
  )
);

-- 8. Approve/reject helper
CREATE OR REPLACE FUNCTION public.review_expense(
  p_expense_id uuid,
  p_action text,         -- 'approve' | 'reject'
  p_amount numeric DEFAULT NULL,
  p_expense_type text DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.vehicle_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.vehicle_expenses;
BEGIN
  SELECT * INTO v_row FROM public.vehicle_expenses WHERE id = p_expense_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF NOT public.is_team_member_of_record(auth.uid(), v_row.team_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Manager role or higher required to review expenses';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.vehicle_expenses SET
      status = 'confirmed',
      amount = COALESCE(p_amount, amount),
      expense_type = COALESCE(p_expense_type, expense_type),
      vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
      booking_id = COALESCE(p_booking_id, booking_id),
      notes = COALESCE(p_notes, notes),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_expense_id RETURNING * INTO v_row;
  ELSIF p_action = 'reject' THEN
    UPDATE public.vehicle_expenses SET
      status = 'rejected',
      review_reason = COALESCE(p_notes, review_reason),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_expense_id RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_expense(uuid,text,numeric,text,uuid,uuid,text) TO authenticated;
