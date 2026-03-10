
-- Add booking_id to customer_notes
ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_booking ON customer_notes(booking_id);

-- Add booking_ref to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref text;

-- Create sequence for booking refs
CREATE SEQUENCE IF NOT EXISTS booking_ref_seq START 1001;

-- Create trigger function
CREATE OR REPLACE FUNCTION generate_booking_ref() RETURNS trigger AS $$
BEGIN
  IF NEW.booking_ref IS NULL THEN
    NEW.booking_ref := 'BK-' || LPAD(nextval('booking_ref_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_booking_ref ON bookings;
CREATE TRIGGER set_booking_ref BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_ref();

-- Backfill existing bookings without a booking_ref
UPDATE bookings SET booking_ref = 'BK-' || LPAD(nextval('booking_ref_seq')::text, 5, '0') WHERE booking_ref IS NULL;
