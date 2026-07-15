-- Additional stub tables for M3 public-RPC verification (loaded after setup_stub.sql).

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend teams with columns used by M3 (full prod table has more; stub mirrors what M3 touches).
ALTER TABLE public.teams
  ADD COLUMN is_demo_account boolean DEFAULT false,
  ADD COLUMN is_deleted boolean DEFAULT false,
  ADD COLUMN slug text UNIQUE,
  ADD COLUMN logo_url text,
  ADD COLUMN timezone text,
  ADD COLUMN currency text DEFAULT 'usd',
  ADD COLUMN platform_fee_percent numeric DEFAULT 10,
  ADD COLUMN rental_buffer_minutes int DEFAULT 60;

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id),
  name text,
  city text,
  state text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id),
  user_id uuid,
  name text,
  make text NOT NULL,
  model text NOT NULL,
  year int,
  color text,
  vin text,
  license_plate text,
  status text DEFAULT 'available',
  ops_status text,
  current_rate numeric NOT NULL DEFAULT 0,
  rate_3hr numeric,
  rate_6hr numeric,
  rate_multiday numeric,
  default_mileage_limit int,
  mileage_overage_rate numeric,
  image_url text,
  location_id uuid REFERENCES public.locations(id),
  archived_at timestamptz,
  trashed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vehicle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id),
  team_id uuid,
  user_id uuid,
  url text NOT NULL,
  enhanced_url text,
  thumbnail_url text,
  storage_path text DEFAULT '',
  display_order int,
  is_visible boolean DEFAULT true,
  is_vehicle_confirmed boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id),
  team_id uuid,
  customer_name text NOT NULL DEFAULT 'PII Customer',
  booking_ref text,
  status text DEFAULT 'pending',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Deliberately NO grants and NO policies for anon on base tables:
-- the tests assert anon cannot read them directly while RPCs work.
GRANT USAGE ON SCHEMA public TO anon;
