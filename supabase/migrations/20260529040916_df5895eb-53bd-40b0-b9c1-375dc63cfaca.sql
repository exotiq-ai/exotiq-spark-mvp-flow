
-- ============================================================
-- Margin Big Push — Phase 1 schema
-- ============================================================

-- 1. Routing metadata on vehicle_expenses
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS auto_routed_reason text,
  ADD COLUMN IF NOT EXISTS requires_admin_approval boolean NOT NULL DEFAULT false;

-- 2. Recurring expense templates
CREATE TABLE IF NOT EXISTS public.recurring_expense_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  vehicle_id uuid NULL,
  location_id uuid NULL,
  name text NOT NULL,
  expense_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  vendor text NULL,
  notes text NULL,
  cadence text NOT NULL CHECK (cadence IN ('monthly','quarterly','annual')),
  day_of_month int NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  next_run_at date NOT NULL,
  last_run_at date NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expense_templates TO authenticated;
GRANT ALL ON public.recurring_expense_templates TO service_role;

ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view recurring templates"
  ON public.recurring_expense_templates FOR SELECT
  USING (public.is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Team admins manage recurring templates"
  ON public.recurring_expense_templates FOR ALL
  USING (
    public.is_team_member_of_record(auth.uid(), team_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'owner'::app_role)
         OR public.has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    public.is_team_member_of_record(auth.uid(), team_id)
    AND (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'owner'::app_role)
         OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE INDEX IF NOT EXISTS idx_recurring_templates_team ON public.recurring_expense_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_due ON public.recurring_expense_templates(next_run_at) WHERE is_active = true;

CREATE TRIGGER update_recurring_templates_updated_at
  BEFORE UPDATE ON public.recurring_expense_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. review_expense RPC — approve / reject with admin gating + atomic edits
CREATE OR REPLACE FUNCTION public.review_expense(
  p_expense_id uuid,
  p_action text,
  p_amount numeric DEFAULT NULL,
  p_expense_type text DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL,
  p_expense_date date DEFAULT NULL,
  p_vendor text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.vehicle_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.vehicle_expenses;
  v_is_admin boolean;
BEGIN
  SELECT * INTO v_row FROM public.vehicle_expenses WHERE id = p_expense_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Expense not found'; END IF;

  IF NOT public.is_team_member_of_record(auth.uid(), v_row.team_id) THEN
    RAISE EXCEPTION 'Not authorized for this team';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'owner'::app_role);

  IF p_action = 'approve' THEN
    IF v_row.status <> 'pending_review' THEN
      RAISE EXCEPTION 'Only pending expenses can be approved (current: %)', v_row.status;
    END IF;
    IF v_row.requires_admin_approval AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Admin or Owner approval required for this expense';
    END IF;

    UPDATE public.vehicle_expenses
    SET status = 'confirmed',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        amount = COALESCE(p_amount, amount),
        expense_type = COALESCE(p_expense_type, expense_type),
        vehicle_id = CASE WHEN p_vehicle_id IS NOT NULL THEN p_vehicle_id ELSE vehicle_id END,
        booking_id = CASE WHEN p_booking_id IS NOT NULL THEN p_booking_id ELSE booking_id END,
        expense_date = COALESCE(p_expense_date, expense_date),
        vendor = COALESCE(p_vendor, vendor),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_expense_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'reject' THEN
    UPDATE public.vehicle_expenses
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_expense_id
    RETURNING * INTO v_row;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_expense(uuid, text, numeric, text, uuid, uuid, date, text, text) TO authenticated;

-- 4. Generator for recurring expenses (called by cron)
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_count integer := 0;
  v_next date;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_expense_templates
    WHERE is_active = true AND next_run_at <= CURRENT_DATE
  LOOP
    -- Idempotency: skip if expense already exists for this template on this run date
    IF EXISTS (
      SELECT 1 FROM public.vehicle_expenses
      WHERE source_module = 'recurring' AND source_record_id = r.id
        AND expense_date = r.next_run_at
    ) THEN
      v_next := CASE r.cadence
        WHEN 'monthly' THEN (r.next_run_at + INTERVAL '1 month')::date
        WHEN 'quarterly' THEN (r.next_run_at + INTERVAL '3 months')::date
        WHEN 'annual' THEN (r.next_run_at + INTERVAL '1 year')::date
      END;
      UPDATE public.recurring_expense_templates
      SET next_run_at = v_next, last_run_at = CURRENT_DATE, updated_at = now()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    INSERT INTO public.vehicle_expenses (
      team_id, vehicle_id, location_id, expense_type, amount,
      expense_date, vendor, notes, source_module, source_record_id, created_by,
      status, review_reason, auto_routed_reason, ai_confidence
    ) VALUES (
      r.team_id, r.vehicle_id, r.location_id, r.expense_type, r.amount,
      r.next_run_at, r.vendor,
      COALESCE(r.notes, 'Recurring: ' || r.name),
      'recurring', r.id, r.created_by,
      'pending_review',
      'Recurring expense — confirm',
      'ok', 1.0
    );

    v_next := CASE r.cadence
      WHEN 'monthly' THEN (r.next_run_at + INTERVAL '1 month')::date
      WHEN 'quarterly' THEN (r.next_run_at + INTERVAL '3 months')::date
      WHEN 'annual' THEN (r.next_run_at + INTERVAL '1 year')::date
    END;

    UPDATE public.recurring_expense_templates
    SET next_run_at = v_next, last_run_at = CURRENT_DATE, updated_at = now()
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_recurring_expenses() TO authenticated, service_role;

-- 5. Allow 'recurring', 'stripe_fee', 'ai_receipt' source_module values implicitly (text col, no constraint).
-- No change needed.

-- 6. Damage trigger already exists — but it didn't set requires_admin_approval. Patch it.
CREATE OR REPLACE FUNCTION public.fn_log_damage_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
BEGIN
  v_amount := COALESCE(NEW.actual_cost, NEW.estimated_cost, 0);
  IF v_amount <= 0 OR NEW.team_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, booking_id, expense_type, amount,
    expense_date, notes, source_module, source_record_id, created_by,
    status, review_reason, linked_damage_claim_id,
    auto_routed_reason, requires_admin_approval
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, NEW.booking_id, 'damage', v_amount,
    COALESCE(NEW.reported_date::date, CURRENT_DATE),
    'Damage claim: ' || COALESCE(NEW.description, ''),
    'damage', NEW.id, NEW.user_id,
    'pending_review',
    'Damage claim awaiting owner confirmation',
    NEW.id,
    'damage_claim',
    v_amount > 5000
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    notes = EXCLUDED.notes,
    booking_id = EXCLUDED.booking_id,
    requires_admin_approval = EXCLUDED.requires_admin_approval,
    updated_at = now();
  RETURN NEW;
END;
$function$;
