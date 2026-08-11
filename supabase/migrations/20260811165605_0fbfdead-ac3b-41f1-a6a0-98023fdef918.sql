ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bookings.is_historical IS 'Booking logged after the fact for record-keeping. Suppresses renter emails, payment collection, and calendar sync.';
CREATE INDEX IF NOT EXISTS idx_bookings_team_historical ON public.bookings (team_id, is_historical);

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS default_mileage_limit integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS default_mileage_overage_rate numeric;