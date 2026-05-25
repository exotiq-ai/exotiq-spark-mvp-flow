
-- ============================================================
-- Margin Module Phase 1: Schema Foundation
-- ============================================================

-- ---------- vehicle_partners ----------
CREATE TABLE public.vehicle_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payout_method TEXT DEFAULT 'manual',
  stripe_connect_account_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_partners_team ON public.vehicle_partners(team_id);
ALTER TABLE public.vehicle_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view partners" ON public.vehicle_partners
FOR SELECT USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can insert partners" ON public.vehicle_partners
FOR INSERT WITH CHECK (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Managers can update partners" ON public.vehicle_partners
FOR UPDATE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Admins can delete partners" ON public.vehicle_partners
FOR DELETE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

-- ---------- vehicle_expenses ----------
CREATE TABLE public.vehicle_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  vehicle_id UUID,
  booking_id UUID,
  location_id UUID,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'fuel','insurance','maintenance','cleaning','storage','registration',
    'detailing','toll','parking','damage','partner_payout','transport','tax',
    'overhead','deposit_recovery','other'
  )),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT,
  notes TEXT,
  receipt_url TEXT,
  source_module TEXT NOT NULL DEFAULT 'margin_manual'
    CHECK (source_module IN ('margin_manual','vault','pulse','bookings','motoriq','deposits')),
  source_record_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_module, source_record_id)
);
CREATE INDEX idx_vehicle_expenses_team ON public.vehicle_expenses(team_id);
CREATE INDEX idx_vehicle_expenses_vehicle ON public.vehicle_expenses(vehicle_id);
CREATE INDEX idx_vehicle_expenses_booking ON public.vehicle_expenses(booking_id);
CREATE INDEX idx_vehicle_expenses_date ON public.vehicle_expenses(expense_date);
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view expenses" ON public.vehicle_expenses
FOR SELECT USING (
  (is_team_member_of_record(auth.uid(), team_id)
    AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  OR is_super_admin(auth.uid())
);
CREATE POLICY "Managers can insert expenses" ON public.vehicle_expenses
FOR INSERT WITH CHECK (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Managers can update expenses" ON public.vehicle_expenses
FOR UPDATE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Admins can delete expenses" ON public.vehicle_expenses
FOR DELETE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

-- ---------- partner_payouts ----------
CREATE TABLE public.partner_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  partner_id UUID NOT NULL,
  gross_rental_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_after_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  operator_adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_partner NUMERIC(12,2) NOT NULL DEFAULT 0,
  split_type TEXT NOT NULL CHECK (split_type IN ('percentage','flat')),
  split_value_snapshot NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','scheduled','paid','voided')),
  payout_method TEXT,
  payout_reference TEXT,
  void_reason TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);
CREATE INDEX idx_partner_payouts_team ON public.partner_payouts(team_id);
CREATE INDEX idx_partner_payouts_partner ON public.partner_payouts(partner_id);
CREATE INDEX idx_partner_payouts_status ON public.partner_payouts(status);
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view payouts" ON public.partner_payouts
FOR SELECT USING (
  (is_team_member_of_record(auth.uid(), team_id)
    AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)))
  OR is_super_admin(auth.uid())
);
CREATE POLICY "System can insert payouts" ON public.partner_payouts
FOR INSERT WITH CHECK (
  is_team_member_of_record(auth.uid(), team_id)
);
CREATE POLICY "Managers can update payouts" ON public.partner_payouts
FOR UPDATE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
);
CREATE POLICY "Admins can delete payouts" ON public.partner_payouts
FOR DELETE USING (
  is_team_member_of_record(auth.uid(), team_id)
  AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

-- ---------- bookings: platform fee snapshot columns ----------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS platform_fee_percent_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_base NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ---------- vehicles: ownership columns ----------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'owned'
    CHECK (ownership_type IN ('owned','partnered')),
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.vehicle_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_type TEXT CHECK (split_type IN ('percentage','flat')),
  ADD COLUMN IF NOT EXISTS split_value NUMERIC(10,2);

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_vehicle_partners_updated_at
  BEFORE UPDATE ON public.vehicle_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_vehicle_expenses_updated_at
  BEFORE UPDATE ON public.vehicle_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_partner_payouts_updated_at
  BEFORE UPDATE ON public.partner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Expense receipts storage bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Managers can read expense receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
);
CREATE POLICY "Managers can upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
);
CREATE POLICY "Managers can delete expense receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid() IS NOT NULL
);
