ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS gas_fee numeric DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS gas_fee_waived boolean DEFAULT false;