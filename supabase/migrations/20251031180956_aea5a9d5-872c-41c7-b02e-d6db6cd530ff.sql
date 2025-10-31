-- Phase 1: Database Architecture - Create Foundation for CRM, Payments, Inspections, and Communications

-- Customer Profiles & CRM
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  drivers_license TEXT,
  license_expiry DATE,
  insurance_provider TEXT,
  insurance_policy TEXT,
  insurance_expiry DATE,
  date_of_birth DATE,
  address TEXT,
  customer_status TEXT DEFAULT 'active',
  blacklist_reason TEXT,
  lifetime_value NUMERIC DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  notes TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Customer Notes (for tracking interactions)
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Inspections & Damage Reports
CREATE TABLE vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  inspection_type TEXT NOT NULL,
  inspector_name TEXT,
  odometer_reading INTEGER NOT NULL,
  fuel_level INTEGER NOT NULL CHECK (fuel_level >= 0 AND fuel_level <= 100),
  exterior_condition TEXT DEFAULT 'excellent',
  interior_condition TEXT DEFAULT 'excellent',
  tire_condition TEXT DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Damage/Incident Photos
CREATE TABLE inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT,
  description TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Damage Claims
CREATE TABLE damage_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES vehicle_inspections(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_cost NUMERIC,
  actual_cost NUMERIC,
  insurance_claim_number TEXT,
  claim_status TEXT DEFAULT 'open',
  resolution_notes TEXT,
  reported_date TIMESTAMPTZ DEFAULT NOW(),
  resolved_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments & Invoicing
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  transaction_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automated Communications Log
CREATE TABLE automated_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhance bookings table
ALTER TABLE bookings
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN payment_status TEXT DEFAULT 'pending',
ADD COLUMN deposit_amount NUMERIC DEFAULT 0,
ADD COLUMN balance_due NUMERIC DEFAULT 0,
ADD COLUMN security_deposit_amount NUMERIC DEFAULT 0,
ADD COLUMN security_deposit_status TEXT DEFAULT 'pending',
ADD COLUMN pickup_odometer INTEGER,
ADD COLUMN return_odometer INTEGER,
ADD COLUMN mileage_limit INTEGER,
ADD COLUMN mileage_overage_fee NUMERIC DEFAULT 0.50,
ADD COLUMN pickup_fuel_level INTEGER,
ADD COLUMN return_fuel_level INTEGER,
ADD COLUMN requires_delivery BOOLEAN DEFAULT false,
ADD COLUMN delivery_address TEXT,
ADD COLUMN delivery_fee NUMERIC DEFAULT 0,
ADD COLUMN confirmed_at TIMESTAMPTZ,
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancellation_reason TEXT;

-- Enhance documents table for insurance verification
ALTER TABLE documents
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN verified_by TEXT,
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN verification_status TEXT DEFAULT 'pending';

-- Enable RLS on all new tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for customer_notes table
CREATE POLICY "Users can view own customer notes" ON customer_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customer notes" ON customer_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customer notes" ON customer_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customer notes" ON customer_notes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for vehicle_inspections table
CREATE POLICY "Users can view own inspections" ON vehicle_inspections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inspections" ON vehicle_inspections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inspections" ON vehicle_inspections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inspections" ON vehicle_inspections FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for inspection_photos table
CREATE POLICY "Users can view own inspection photos" ON inspection_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM vehicle_inspections WHERE vehicle_inspections.id = inspection_photos.inspection_id AND vehicle_inspections.user_id = auth.uid())
);
CREATE POLICY "Users can insert own inspection photos" ON inspection_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vehicle_inspections WHERE vehicle_inspections.id = inspection_photos.inspection_id AND vehicle_inspections.user_id = auth.uid())
);
CREATE POLICY "Users can delete own inspection photos" ON inspection_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM vehicle_inspections WHERE vehicle_inspections.id = inspection_photos.inspection_id AND vehicle_inspections.user_id = auth.uid())
);

-- RLS Policies for damage_claims table
CREATE POLICY "Users can view own damage claims" ON damage_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own damage claims" ON damage_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own damage claims" ON damage_claims FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own damage claims" ON damage_claims FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for payments table
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for automated_messages table
CREATE POLICY "Users can view own messages" ON automated_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON automated_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON automated_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON automated_messages FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX idx_vehicle_inspections_vehicle_id ON vehicle_inspections(vehicle_id);
CREATE INDEX idx_vehicle_inspections_booking_id ON vehicle_inspections(booking_id);
CREATE INDEX idx_damage_claims_vehicle_id ON damage_claims(vehicle_id);
CREATE INDEX idx_damage_claims_booking_id ON damage_claims(booking_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_automated_messages_booking_id ON automated_messages(booking_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);

-- Trigger to update customer lifetime_value and total_bookings
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE customers
    SET 
      total_bookings = (SELECT COUNT(*) FROM bookings WHERE customer_id = NEW.customer_id),
      lifetime_value = (SELECT COALESCE(SUM(total_value), 0) FROM bookings WHERE customer_id = NEW.customer_id AND status = 'completed'),
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_customer_stats_on_booking
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW
WHEN (NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION update_customer_stats();