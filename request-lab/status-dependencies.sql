-- Source-confirmed columns/constraint ONLY for this guarded partial laboratory.
-- customers:user_id is operator owner; SQL fixture inserts are not renter proof.
ALTER TABLE public.customers ADD CONSTRAINT lab_source_customers_user_email UNIQUE(user_id,email);
ALTER TABLE public.bookings ADD COLUMN payment_due_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN operator_payment_intent_id text;
ALTER TABLE public.bookings ADD COLUMN exotiq_payment_intent_id text;
