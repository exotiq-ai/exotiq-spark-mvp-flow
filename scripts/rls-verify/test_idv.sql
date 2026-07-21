-- Behavioral verification for 20260721180000_identity_verifications.sql.
-- Standalone stub (run against an empty scratch DB):
--   psql -f scripts/rls-verify/test_idv.sql

\set ON_ERROR_STOP on

-- --- Stub the runtime this migration assumes ---------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid
$$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE public.team_members (
  team_id uuid REFERENCES public.teams(id),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (team_id, user_id)
);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id),
  user_id uuid NOT NULL,
  full_name text NOT NULL DEFAULT 'Test Customer',
  email text NOT NULL DEFAULT 'test@example.com',
  id_verified boolean,
  id_verified_at timestamptz
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Real production definition (20260103050456).
CREATE OR REPLACE FUNCTION public.is_team_member_of_record(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _team_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = _user_id AND team_id = _team_id AND is_active = true
    )
  END
$$;

-- Mirrors production's team-scoped customers SELECT policy. The
-- identity_verifications SELECT policy nests an EXISTS over customers, which
-- runs under the caller's privileges — so customers RLS participates in the
-- check. Without a customers SELECT policy the ledger would be unreadable.
CREATE POLICY "Team members can view customers"
ON public.customers FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_team_member_of_record(auth.uid(), team_id)
);

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- --- Apply the migrations under test -----------------------------------------
-- The hosted project has no default privileges for externally-authored
-- tables, so grants ship as explicit follow-up migrations (Lovable-authored,
-- applied 2026-07-21). Loading them here means the test exercises the REAL
-- privilege posture: anon nothing, authenticated read-only, service_role all.
\i supabase/migrations/20260721180000_identity_verifications.sql

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

\i supabase/migrations/20260721183355_3bd95972-4cd9-4ac6-8c7b-cd71fd691e0f.sql
\i supabase/migrations/20260721183950_a5d5783d-559f-4496-9673-33e11a5b82ef.sql

CREATE OR REPLACE FUNCTION test_expect(label text, actual bigint, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN RAISE NOTICE 'PASS: % (value=%)', label, actual;
  ELSE RAISE EXCEPTION 'FAIL: % expected % got %', label, expected, actual;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION test_expect(text, bigint, bigint) TO authenticated;

-- --- Seed ---------------------------------------------------------------------
INSERT INTO public.teams (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111','Team One'),
  ('22222222-2222-2222-2222-222222222222','Team Two');
INSERT INTO public.team_members (team_id, user_id, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001', true),
  ('22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000003', true);
INSERT INTO public.customers (id, team_id, user_id) VALUES
  ('cc000000-0000-0000-0000-0000000000c1','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001');

-- Service-role (table owner here) writes the ledger row, like the edge functions do.
INSERT INTO public.identity_verifications (customer_id, stripe_verification_session_id, status)
VALUES ('cc000000-0000-0000-0000-0000000000c1','vs_test_123','created');

-- Check constraint rejects unknown status.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.identity_verifications (customer_id, stripe_verification_session_id, status)
    VALUES ('cc000000-0000-0000-0000-0000000000c1','vs_test_bad','totally_bogus');
    RAISE EXCEPTION 'FAIL: bogus status accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: status check constraint rejects unknown status';
  END;
END $$;

-- updated_at trigger fires.
DO $$
DECLARE before_ts timestamptz; after_ts timestamptz;
BEGIN
  SELECT updated_at INTO before_ts FROM public.identity_verifications WHERE stripe_verification_session_id='vs_test_123';
  PERFORM pg_sleep(0.01);
  UPDATE public.identity_verifications SET status='processing' WHERE stripe_verification_session_id='vs_test_123';
  SELECT updated_at INTO after_ts FROM public.identity_verifications WHERE stripe_verification_session_id='vs_test_123';
  IF after_ts > before_ts THEN RAISE NOTICE 'PASS: updated_at trigger fires on update';
  ELSE RAISE EXCEPTION 'FAIL: updated_at not bumped';
  END IF;
END $$;

-- --- RLS: same-team member reads, cross-team member does not ------------------
SET ROLE authenticated;
SET test.uid = 'a0000000-0000-0000-0000-000000000001';
SELECT test_expect('team member can read own-team verification row',
  (SELECT count(*) FROM public.identity_verifications), 1);
-- Client-side write must be blocked (no INSERT policy).
DO $$ BEGIN
  BEGIN
    INSERT INTO public.identity_verifications (customer_id, stripe_verification_session_id)
    VALUES ('cc000000-0000-0000-0000-0000000000c1','vs_client_write');
    RAISE EXCEPTION 'FAIL: client INSERT allowed on ledger';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: client INSERT blocked (service-role-only writes)';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.identity_verifications SET status='verified' WHERE stripe_verification_session_id='vs_test_123';
    IF NOT FOUND THEN
      RAISE NOTICE 'PASS: client UPDATE matched zero rows (no UPDATE policy)';
    ELSE
      RAISE EXCEPTION 'FAIL: client UPDATE mutated the ledger';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: client UPDATE blocked (service-role-only writes)';
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SET test.uid = 'c0000000-0000-0000-0000-000000000003';
SELECT test_expect('cross-team member sees zero verification rows',
  (SELECT count(*) FROM public.identity_verifications), 0);
RESET ROLE;

SELECT 'ALL IDV TESTS PASSED' AS result;
