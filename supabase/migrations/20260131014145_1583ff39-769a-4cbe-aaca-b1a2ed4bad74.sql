-- Add missing columns to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS mileage integer DEFAULT 0;

-- Set default for current_rate to allow imports without rate
ALTER TABLE vehicles 
ALTER COLUMN current_rate SET DEFAULT 0;

-- Add vehicle_name column to bookings for storing unmatched vehicle names
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS vehicle_name text;

-- Update booking status CHECK constraint to allow 'active'
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY['pending', 'confirmed', 'active', 'completed', 'cancelled']));