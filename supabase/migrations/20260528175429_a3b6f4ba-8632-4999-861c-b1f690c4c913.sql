ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS premium_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS billing_frequency TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_billing_frequency_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_billing_frequency_check
      CHECK (billing_frequency IS NULL OR billing_frequency = ANY (ARRAY['monthly','quarterly','annually','one_time']));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_log_insurance_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove any prior auto-logged expense if the doc is no longer a premium-bearing insurance doc
  IF NEW.type <> 'insurance' OR NEW.premium_amount IS NULL OR NEW.premium_amount <= 0 OR NEW.team_id IS NULL THEN
    DELETE FROM public.vehicle_expenses
    WHERE source_module = 'vault' AND source_record_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.vehicle_expenses (
    team_id, vehicle_id, expense_type, amount,
    expense_date, vendor, notes, source_module, source_record_id, created_by
  ) VALUES (
    NEW.team_id, NEW.vehicle_id, 'insurance', NEW.premium_amount,
    COALESCE(NEW.created_at::date, CURRENT_DATE),
    NEW.name,
    'Auto-logged insurance premium ('
      || COALESCE(NEW.billing_frequency, 'one_time') || '): ' || COALESCE(NEW.name, ''),
    'vault', NEW.id, NEW.user_id
  )
  ON CONFLICT (source_module, source_record_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    vehicle_id = EXCLUDED.vehicle_id,
    notes = EXCLUDED.notes,
    vendor = EXCLUDED.vendor,
    updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_insurance_expense ON public.documents;
CREATE TRIGGER trg_log_insurance_expense
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_insurance_expense();