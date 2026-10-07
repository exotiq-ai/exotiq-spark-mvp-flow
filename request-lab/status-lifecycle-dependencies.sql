-- PARTIAL synthetic lab prerequisites only; root guarded runner applies.
-- Exact source column authority: 20260721180000_identity_verifications.sql;
-- 20260724015013_c1c8f150-af28-400e-8b5d-aae1e1515305.sql;
-- 20260722181945_26aa77e2-5dba-433a-8154-1218025badb4.sql;
-- 20251224065037_8c8edc7b-4cc0-4f2d-9b2b-42d6f31d0666.sql;
-- 20251031180956_aea5a9d5-872c-41c7-b02e-d6db6cd530ff.sql.
-- No historical DML, policies or whole migrations are imported.
ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS stripe_verification_session_id text UNIQUE;
ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS verified_name text;
ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS redacted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS identity_status text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_verified_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_test_account_id text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_stripe_mode text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS balance_due numeric DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS exotiq_charge_cents bigint NOT NULL DEFAULT 0;
