-- 1) Missing expense columns the Margin UI relies on
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS is_reimbursable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reimbursed_amount numeric NOT NULL DEFAULT 0;

-- 2) Fix partner payout generation
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

  -- Gross rental base, independent of booking source (direct bookings have no platform fee base)
  v_base := public.compute_rental_base(NEW.daily_rate, NEW.start_date, NEW.end_date, NEW.rental_duration_type);
  IF COALESCE(v_base, 0) = 0 THEN
    v_base := COALESCE(NEW.total_value, 0);
  END IF;

  v_net := GREATEST(v_base - COALESCE(NEW.platform_fee_amount, 0), 0);

  IF v_vehicle.split_type = 'percentage' THEN
    -- split_value = partner's share %
    v_partner_share := ROUND(v_net * (v_vehicle.split_value / 100.0), 2);
  ELSE
    -- flat per-day to partner
    v_days := GREATEST(CEIL(EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date))/86400.0), 1);
    v_partner_share := LEAST(ROUND(v_vehicle.split_value * v_days, 2), v_net);
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
$function$;

-- 3) Seed test data for demo team "Exotiq"
-- Partners
INSERT INTO public.vehicle_partners (team_id, name, email, phone, payout_method, is_active, notes)
VALUES
  ('c1de6533-ab44-4973-a123-007a8007b5ba', 'Velocity Capital Partners', 'payouts@velocitycap.com', '+1-305-555-0142', 'ach', true, 'Revenue-share partner — 40% of net rental.'),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', 'Marcus Reuben (Private Owner)', 'marcus.reuben@gmail.com', '+1-310-555-0188', 'wire', true, 'Flat per-day owner payout.')
ON CONFLICT DO NOTHING;

-- Assign partnered vehicles
UPDATE public.vehicles
SET ownership_type = 'partnered',
    partner_id = (SELECT id FROM public.vehicle_partners WHERE team_id='c1de6533-ab44-4973-a123-007a8007b5ba' AND name='Velocity Capital Partners' LIMIT 1),
    split_type = 'percentage',
    split_value = 40,
    updated_at = now()
WHERE id = '09d2fa1c-bd57-49f2-94af-863a9ed6c8dc';

UPDATE public.vehicles
SET ownership_type = 'partnered',
    partner_id = (SELECT id FROM public.vehicle_partners WHERE team_id='c1de6533-ab44-4973-a123-007a8007b5ba' AND name='Marcus Reuben (Private Owner)' LIMIT 1),
    split_type = 'flat',
    split_value = 1500,
    updated_at = now()
WHERE id = '0dd4f240-0457-465f-985e-e575a7d8a9fb';

-- Re-trigger payouts for already-completed bookings on the partnered vehicles
CREATE TEMP TABLE _toflip ON COMMIT DROP AS
  SELECT id FROM public.bookings
  WHERE team_id='c1de6533-ab44-4973-a123-007a8007b5ba'
    AND vehicle_id IN ('09d2fa1c-bd57-49f2-94af-863a9ed6c8dc','0dd4f240-0457-465f-985e-e575a7d8a9fb')
    AND status='completed';

UPDATE public.bookings SET status='confirmed' WHERE id IN (SELECT id FROM _toflip);
UPDATE public.bookings SET status='completed' WHERE id IN (SELECT id FROM _toflip);

-- Mark the two earliest payouts per partner as paid (realistic history)
WITH ranked AS (
  SELECT pp.id, row_number() OVER (PARTITION BY pp.partner_id ORDER BY b.start_date) rn
  FROM public.partner_payouts pp
  JOIN public.bookings b ON b.id = pp.booking_id
  WHERE pp.team_id='c1de6533-ab44-4973-a123-007a8007b5ba'
)
UPDATE public.partner_payouts p
SET status='paid',
    paid_at = now() - interval '8 days',
    payout_method = CASE WHEN p.split_type='percentage' THEN 'ach' ELSE 'wire' END,
    payout_reference = 'BATCH-2026-05-20'
FROM ranked r
WHERE p.id = r.id AND r.rn <= 2;

-- Realistic expenses (mix of per-vehicle and overhead)
INSERT INTO public.vehicle_expenses
  (team_id, vehicle_id, expense_type, amount, currency, expense_date, vendor, notes, source_module, created_by, is_reimbursable, reimbursed_amount)
VALUES
  ('c1de6533-ab44-4973-a123-007a8007b5ba', NULL, 'insurance', 8500, 'USD', '2026-05-01', 'Hagerty Fleet Policy', 'Monthly fleet insurance premium', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '67cac4d3-bd49-40ec-9c00-b7c60663d9e2', 'maintenance', 12400, 'USD', '2026-04-15', 'Pagani Service Miami', 'Annual service + carbon-ceramic brake inspection', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '2ce57711-bb45-4945-83c1-113936e327e2', 'detailing', 1850, 'USD', '2026-04-02', 'Exotic Detail Co', 'Full paint correction + ceramic refresh', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '09d2fa1c-bd57-49f2-94af-863a9ed6c8dc', 'fuel', 480, 'USD', '2026-03-20', 'Shell V-Power', 'Refuel after client return', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '0dd4f240-0457-465f-985e-e575a7d8a9fb', 'transport', 2200, 'USD', '2026-03-10', 'Reliable Carriers', 'Enclosed transport to client residence', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '04a58a47-d292-44e8-b169-eb955a620231', 'registration', 920, 'USD', '2026-02-28', 'FL DMV', 'Annual registration renewal', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '81e3bbac-05f7-4ead-a343-f6e0d4975aeb', 'cleaning', 320, 'USD', '2026-02-14', 'Sparkle Auto', 'Interior deep clean', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', NULL, 'storage', 4200, 'USD', '2026-02-01', 'Prestige Storage', 'Climate-controlled garage (monthly)', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '2ce57711-bb45-4945-83c1-113936e327e2', 'maintenance', 26500, 'USD', '2026-01-18', 'Bugatti Certified Service', 'Tire set replacement + major inspection', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '09d2fa1c-bd57-49f2-94af-863a9ed6c8dc', 'toll', 85, 'USD', '2026-01-05', 'SunPass', 'Toll charges during rental', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', true, 85),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '0dd4f240-0457-465f-985e-e575a7d8a9fb', 'damage', 6400, 'USD', '2025-12-20', 'Body Shop Elite', 'Curb rash repair — recovered from renter deposit', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', true, 6400),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', NULL, 'parking', 650, 'USD', '2025-12-10', 'Valet Garage Downtown', 'Event parking', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '67cac4d3-bd49-40ec-9c00-b7c60663d9e2', 'detailing', 2100, 'USD', '2025-11-22', 'Exotic Detail Co', 'Pre-delivery detail', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', NULL, 'tax', 15000, 'USD', '2025-11-05', 'FL Dept of Revenue', 'Quarterly sales tax remittance', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0),
  ('c1de6533-ab44-4973-a123-007a8007b5ba', '2ce57711-bb45-4945-83c1-113936e327e2', 'fuel', 720, 'USD', '2025-10-15', 'Shell V-Power', 'Refuel after extended rental', 'margin_manual', '99d902d4-5878-4b59-a108-142bafb1c862', false, 0);