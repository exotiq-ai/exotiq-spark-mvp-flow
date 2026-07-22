-- Behavioral verification for 20260722050000_renter_booking_writes.sql.
-- Self-contained: run against an empty scratch DB from the repo root:
--   psql -f scripts/rls-verify/test_m5_booking_writes.sql

\set ON_ERROR_STOP on

-- --- Stub the runtime -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;

DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, slug text UNIQUE, owner_id uuid,
  timezone text DEFAULT 'America/Phoenix',
  currency text DEFAULT 'usd',
  platform_fee_percent numeric DEFAULT 10,
  is_demo_account boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  marketplace_visible boolean DEFAULT false,
  rental_buffer_minutes int DEFAULT 60
);

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id), user_id uuid,
  name text, make text, model text, year int, slug text,
  status text DEFAULT 'available', current_rate numeric DEFAULT 0,
  archived_at timestamptz, trashed_at timestamptz
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, team_id uuid REFERENCES public.teams(id),
  email text NOT NULL, full_name text NOT NULL, phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, team_id uuid, vehicle_id uuid REFERENCES public.vehicles(id),
  customer_id uuid REFERENCES public.customers(id),
  customer_name text NOT NULL, customer_email text, customer_phone text,
  start_date timestamptz NOT NULL, end_date timestamptz NOT NULL,
  pickup_location text NOT NULL,
  daily_rate numeric NOT NULL DEFAULT 0, total_value numeric,
  status text DEFAULT 'pending',
  booking_source text NOT NULL DEFAULT 'direct',
  booking_ref text, created_at timestamptz DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY['pending','confirmed','active','completed','cancelled']))
);

-- Mirrors the production set_booking_ref trigger (sequential BK- refs).
CREATE SEQUENCE booking_ref_seq START 1001;
CREATE OR REPLACE FUNCTION public.generate_booking_ref() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.booking_ref := 'BK-' || lpad(nextval('booking_ref_seq')::text, 5, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER set_booking_ref BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_ref();

CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, team_id uuid,
  activity_type text NOT NULL, entity_type text, entity_id text,
  metadata jsonb, created_at timestamptz DEFAULT now()
);

-- Marketplace helpers (real definitions from 20260715220000).
CREATE OR REPLACE FUNCTION public.is_marketplace_team(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id
    AND t.marketplace_visible AND coalesce(t.is_demo_account,false) = false
    AND coalesce(t.is_deleted,false) = false)
$$;
CREATE OR REPLACE FUNCTION public.is_marketplace_vehicle(_vehicle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = _vehicle_id
    AND v.status IN ('available','booked') AND v.archived_at IS NULL
    AND v.trashed_at IS NULL AND v.team_id IS NOT NULL
    AND public.is_marketplace_team(v.team_id))
$$;
-- Stub omits vehicles.marketplace_visible check (column added by M3 in prod;
-- eligibility logic itself is exercised via the team flag below).

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;

-- --- Apply the migration under test ----------------------------------------
\i supabase/migrations/20260722050000_renter_booking_writes.sql

CREATE OR REPLACE FUNCTION test_expect(label text, actual bigint, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN RAISE NOTICE 'PASS: % (value=%)', label, actual;
  ELSE RAISE EXCEPTION 'FAIL: % expected % got %', label, expected, actual;
  END IF;
END $$;

-- --- Seed -------------------------------------------------------------------
INSERT INTO public.teams (id, name, slug, owner_id, marketplace_visible) VALUES
  ('11111111-1111-1111-1111-111111111111','Desert Exotics','desert-exotics','a0000000-0000-0000-0000-000000000001', true);
INSERT INTO public.vehicles (id, team_id, user_id, name, make, model, year, slug, current_rate) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','McLaren 750S','McLaren','750S',2025,'2025-mclaren-750s',1999);

-- --- Happy path ---------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.create_marketplace_booking(
    'desert-exotics','2025-mclaren-750s','2026-08-04','2026-08-07','10:00 AM',
    'Gregory Ringler','gregory@example.com','+13035550184', 1999, 5997, 'pending_documents');
  IF r.booking_ref LIKE 'BK-%' AND r.confirmation_token IS NOT NULL AND r.status = 'pending_documents' THEN
    RAISE NOTICE 'PASS: happy path creates booking % status %', r.booking_ref, r.status;
  ELSE
    RAISE EXCEPTION 'FAIL: unexpected create result';
  END IF;
END $$;

SELECT test_expect('guest customer upserted into team CRM',
  (SELECT count(*) FROM public.customers WHERE email='gregory@example.com' AND team_id='11111111-1111-1111-1111-111111111111'), 1);
SELECT test_expect('audit row written with correct activity_type (drift fix)',
  (SELECT count(*) FROM public.user_activity_log WHERE activity_type='marketplace_booking_created'), 1);
SELECT test_expect('booking_source is marketplace (D2)',
  (SELECT count(*) FROM public.bookings WHERE booking_source='marketplace'), 1);

-- --- Overlap pre-check (same dates again → dates_unavailable) ------------------
DO $$ BEGIN
  BEGIN
    PERFORM public.create_marketplace_booking(
      'desert-exotics','2025-mclaren-750s','2026-08-05','2026-08-08','10:00 AM',
      'Second Renter','second@example.com','+13035550185', 1999, 5997, 'pending_documents');
    RAISE EXCEPTION 'FAIL: overlapping create did not raise';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%dates_unavailable%' THEN
      RAISE NOTICE 'PASS: overlapping create rejected (dates_unavailable)';
    ELSIF SQLERRM LIKE 'FAIL:%' THEN RAISE;
    ELSE RAISE EXCEPTION 'FAIL: wrong error %', SQLERRM;
    END IF;
  END;
END $$;

-- --- Concurrency backstop: bypass the pre-check, hit the constraint ------------
-- Simulates two racing transactions that both passed the pre-check: a direct
-- second insert with overlapping dates must violate bookings_no_marketplace_overlap.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bookings (user_id, team_id, vehicle_id, customer_name, start_date, end_date, pickup_location, daily_rate, status, booking_source)
    VALUES ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Racer',
            '2026-08-05T17:00:00Z','2026-08-06T17:00:00Z','x',1999,'requested','marketplace');
    RAISE EXCEPTION 'FAIL: exclusion constraint did not fire';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS: btree_gist exclusion constraint blocks racing marketplace insert';
  END;
END $$;

-- Operator (direct) bookings are NOT constrained (scoped guard) but ARE caught by the pre-check.
INSERT INTO public.bookings (user_id, team_id, vehicle_id, customer_name, start_date, end_date, pickup_location, daily_rate, status, booking_source)
VALUES ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Operator Direct',
        '2026-08-05T18:00:00Z','2026-08-06T18:00:00Z','x',1999,'confirmed','direct');
SELECT test_expect('operator-source overlap insert allowed (constraint scoped to marketplace)',
  (SELECT count(*) FROM public.bookings WHERE booking_source='direct'), 1);

-- --- New lifecycle statuses accepted; bogus rejected ----------------------------
UPDATE public.bookings SET status='refunded' WHERE booking_source='direct';
SELECT test_expect('new lifecycle status (refunded) accepted by widened CHECK',
  (SELECT count(*) FROM public.bookings WHERE status='refunded'), 1);
DO $$ BEGIN
  BEGIN
    UPDATE public.bookings SET status='bogus' WHERE booking_source='direct';
    RAISE EXCEPTION 'FAIL: bogus status accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: bogus status rejected';
  END;
END $$;

-- --- D4 token-gated confirmation read -------------------------------------------
DO $$
DECLARE v_ref text; v_token uuid; unauth record; auth_row record;
BEGIN
  SELECT booking_ref, confirmation_token INTO v_ref, v_token
  FROM public.bookings WHERE booking_source='marketplace' LIMIT 1;

  SELECT * INTO unauth FROM public.public_booking_by_ref(v_ref, NULL);
  IF unauth.authorized = false AND unauth.vehicle_name IS NULL AND unauth.start_at IS NULL AND unauth.status IS NOT NULL THEN
    RAISE NOTICE 'PASS: tokenless read returns status only (D4 restricted view)';
  ELSE
    RAISE EXCEPTION 'FAIL: tokenless read leaked fields';
  END IF;

  SELECT * INTO auth_row FROM public.public_booking_by_ref(v_ref, v_token);
  IF auth_row.authorized AND auth_row.vehicle_name IS NOT NULL AND auth_row.total_cents = 599700 THEN
    RAISE NOTICE 'PASS: token read returns renter-safe summary (total=599700c)';
  ELSE
    RAISE EXCEPTION 'FAIL: token read wrong (total=%)', auth_row.total_cents;
  END IF;
END $$;

-- --- Privilege posture -----------------------------------------------------------
DO $$
DECLARE ok boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text)', 'EXECUTE') INTO ok;
  IF ok THEN RAISE EXCEPTION 'FAIL: anon can execute create_marketplace_booking';
  ELSE RAISE NOTICE 'PASS: anon cannot execute create_marketplace_booking'; END IF;
  SELECT has_function_privilege('authenticated', 'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text)', 'EXECUTE') INTO ok;
  IF ok THEN RAISE EXCEPTION 'FAIL: authenticated can execute create_marketplace_booking';
  ELSE RAISE NOTICE 'PASS: authenticated cannot execute create_marketplace_booking'; END IF;
  SELECT has_function_privilege('anon', 'public.public_booking_by_ref(text,uuid)', 'EXECUTE') INTO ok;
  IF ok THEN RAISE NOTICE 'PASS: anon can execute public_booking_by_ref';
  ELSE RAISE EXCEPTION 'FAIL: anon cannot execute public_booking_by_ref'; END IF;
END $$;

SELECT 'ALL M5 TESTS PASSED' AS result;
