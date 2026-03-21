
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS rate_3hr NUMERIC,
  ADD COLUMN IF NOT EXISTS rate_6hr NUMERIC,
  ADD COLUMN IF NOT EXISTS rate_multiday NUMERIC;

COMMENT ON COLUMN public.vehicles.rate_3hr IS 'Flat rate for 3-hour rentals. Null = not offered for this vehicle.';
COMMENT ON COLUMN public.vehicles.rate_6hr IS 'Flat rate for 6-hour rentals. Null = not offered for this vehicle.';
COMMENT ON COLUMN public.vehicles.rate_multiday IS 'Per-day rate for 2+ day rentals. Null = falls back to current_rate (24hr daily rate).';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rental_duration_type TEXT DEFAULT 'daily';

COMMENT ON COLUMN public.bookings.rental_duration_type IS 'Duration tier: 3hr, 6hr, daily, or multiday. Defaults to daily for backwards compatibility.';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS min_rate NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS rental_buffer_minutes INTEGER DEFAULT 60;

COMMENT ON COLUMN public.teams.min_rate IS 'Minimum allowed rental rate across all tiers. Default $100.';
COMMENT ON COLUMN public.teams.rental_buffer_minutes IS 'Buffer time between hourly rentals in minutes. Default 60. Used in Phase 2.';
