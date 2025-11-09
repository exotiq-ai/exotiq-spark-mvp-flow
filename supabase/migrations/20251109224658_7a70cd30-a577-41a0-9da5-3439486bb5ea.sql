-- Add performance indexes for faster queries
-- These indexes significantly improve query performance for common operations

-- Index for vehicles table
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

-- Indexes for bookings table
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date_range ON public.bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON public.bookings(user_id, status);

-- Indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);

-- Indexes for maintenance_schedules table
CREATE INDEX IF NOT EXISTS idx_maintenance_user_id ON public.maintenance_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON public.maintenance_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON public.maintenance_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_schedules(status);

-- Indexes for customers table
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(customer_status);

-- Indexes for documents table
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id ON public.documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON public.documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);

-- Indexes for damage_claims table
CREATE INDEX IF NOT EXISTS idx_damage_claims_user_id ON public.damage_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_vehicle_id ON public.damage_claims(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_booking_id ON public.damage_claims(booking_id);
CREATE INDEX IF NOT EXISTS idx_damage_claims_status ON public.damage_claims(claim_status);

-- Indexes for vehicle_inspections table
CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON public.vehicle_inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle_id ON public.vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_booking_id ON public.vehicle_inspections(booking_id);