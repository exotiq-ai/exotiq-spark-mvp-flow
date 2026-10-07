-- PARTIAL laboratory dependency schema. NOT a Supabase schema dump.
-- Supports exact selected source functions only. RLS, unrelated business triggers,
-- provider integrations, historical data and default privilege parity are omitted.
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE TABLE public.lab_identity (name text PRIMARY KEY CHECK(name='exotiq-agent-test-partial'), schema_parity boolean NOT NULL CHECK(schema_parity=false));
INSERT INTO public.lab_identity VALUES ('exotiq-agent-test-partial', false);
CREATE TABLE public.teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, owner_id uuid NOT NULL,
 slug text UNIQUE CHECK(slug LIKE 'agent-test-%'), timezone text DEFAULT 'America/New_York',
 is_deleted boolean DEFAULT false, is_demo_account boolean DEFAULT false,
 marketplace_visible boolean DEFAULT false, marketplace_request_status text DEFAULT 'none',
 currency text DEFAULT 'USD', rental_buffer_minutes integer DEFAULT 60,
 platform_fee_percent numeric DEFAULT 10, tax_rate_percent numeric DEFAULT 0,
 tax_label text DEFAULT 'Tax', tax_inclusive boolean DEFAULT false,
 business_address jsonb DEFAULT '{}', pickup_address text, pickup_instructions text,
 default_mileage_limit integer, default_mileage_overage_rate numeric
);
CREATE TABLE public.locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid REFERENCES public.teams(id),
 address text, city text, state text, zip_code text, is_active boolean DEFAULT true,
 is_default boolean DEFAULT false, created_at timestamptz DEFAULT now(),
 tax_rate_percent numeric, tax_label text, tax_inclusive boolean
);
CREATE TABLE public.vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid REFERENCES public.teams(id),
 location_id uuid REFERENCES public.locations(id), slug text CHECK(slug LIKE 'agent-test-%'),
 name text NOT NULL, current_rate numeric(10,2) NOT NULL DEFAULT 0,
 status text DEFAULT 'available', marketplace_visible boolean DEFAULT false,
 archived_at timestamptz, trashed_at timestamptz, default_mileage_limit integer,
 mileage_overage_rate numeric, UNIQUE(team_id,slug)
);
CREATE TABLE public.customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, team_id uuid REFERENCES public.teams(id),
 email text CHECK(email LIKE '%@example.invalid'), full_name text, phone text, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, team_id uuid REFERENCES public.teams(id),
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id), customer_id uuid REFERENCES public.customers(id),
 customer_name text NOT NULL, customer_email text CHECK(customer_email LIKE '%@example.invalid'), customer_phone text,
 start_date timestamptz NOT NULL, end_date timestamptz NOT NULL CHECK(end_date>start_date),
 pickup_location text NOT NULL, pickup_address text, pickup_instructions text,
 mileage_limit integer, mileage_overage_fee numeric, cancellation_policy text,
 daily_rate numeric(10,2) NOT NULL, total_value numeric(10,2) NOT NULL,
 status text DEFAULT 'pending', booking_source text DEFAULT 'direct', is_historical boolean DEFAULT false,
 booking_ref text NOT NULL DEFAULT ('agent-test-'||gen_random_uuid()::text), confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
 protection_tier text, platform_fee_cents bigint, protection_total_cents bigint,
 state_fee_cents bigint, processing_fee_cents bigint, operator_tax_cents bigint,
 gas_fee numeric DEFAULT 0, gas_fee_waived boolean DEFAULT false
);
CREATE TABLE public.vehicle_blocked_dates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.teams(id),
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id), start_date timestamptz NOT NULL,
 end_date timestamptz NOT NULL CHECK(end_date>start_date)
);
CREATE TABLE public.state_rental_fees (state_code text PRIMARY KEY, daily_cents bigint NOT NULL DEFAULT 0, label text NOT NULL);
CREATE TABLE public.user_activity_log (id uuid DEFAULT gen_random_uuid(), user_id uuid, team_id uuid, activity_type text, entity_type text, entity_id uuid, metadata jsonb);
