
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS default_mileage_limit integer DEFAULT 250,
ADD COLUMN IF NOT EXISTS mileage_overage_rate numeric DEFAULT 1.50;
