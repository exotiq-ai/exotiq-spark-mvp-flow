
-- Add discount columns to bookings
ALTER TABLE bookings ADD COLUMN discount_amount numeric DEFAULT 0;
ALTER TABLE bookings ADD COLUMN discount_reason text;

-- Update customer FK to SET NULL on delete
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Also update other tables that reference customers
ALTER TABLE customer_notes DROP CONSTRAINT IF EXISTS customer_notes_customer_id_fkey;
ALTER TABLE customer_notes ADD CONSTRAINT customer_notes_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_customer_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE damage_claims DROP CONSTRAINT IF EXISTS damage_claims_customer_id_fkey;
ALTER TABLE damage_claims ADD CONSTRAINT damage_claims_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE automated_messages DROP CONSTRAINT IF EXISTS automated_messages_customer_id_fkey;
ALTER TABLE automated_messages ADD CONSTRAINT automated_messages_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
