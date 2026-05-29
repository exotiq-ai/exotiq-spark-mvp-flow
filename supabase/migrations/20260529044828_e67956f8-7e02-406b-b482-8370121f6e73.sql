
ALTER TABLE public.vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_source_module_check;
ALTER TABLE public.vehicle_expenses ADD CONSTRAINT vehicle_expenses_source_module_check
  CHECK (source_module = ANY (ARRAY[
    'margin_manual','vault','pulse','bookings','motoriq','deposits',
    'maintenance','work_orders','damage','ai_receipt','recurring','stripe_fee'
  ]));

ALTER TABLE public.vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_expense_type_check;
ALTER TABLE public.vehicle_expenses ADD CONSTRAINT vehicle_expenses_expense_type_check
  CHECK (expense_type = ANY (ARRAY[
    'fuel','insurance','maintenance','cleaning','storage','registration','detailing',
    'toll','parking','damage','partner_payout','transport','tax','overhead',
    'deposit_recovery','processing_fee','other'
  ]));
