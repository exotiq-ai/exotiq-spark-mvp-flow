-- Add location column to vehicles table for multi-location support
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Miami';

-- Add index for efficient location filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_location ON public.vehicles(location);

-- Add comment for documentation
COMMENT ON COLUMN public.vehicles.location IS 'Physical location of the vehicle fleet (e.g., Miami, Scottsdale)';