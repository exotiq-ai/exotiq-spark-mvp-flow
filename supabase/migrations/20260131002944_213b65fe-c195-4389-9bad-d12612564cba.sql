-- Make vehicle_id nullable in bookings to allow imports without vehicle match
ALTER TABLE bookings ALTER COLUMN vehicle_id DROP NOT NULL;