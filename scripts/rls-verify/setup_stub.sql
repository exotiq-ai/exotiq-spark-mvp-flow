-- Minimal stub of the Supabase runtime needed to verify the M2 migration.
-- Creates: auth.uid() stub, storage schema stub, tenancy tables + helpers.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- auth.uid() reads a session GUC so tests can impersonate users.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid
$$;

-- Roles used by policies.
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- storage stub.
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- Tenancy tables (minimal columns used by helpers/policies).
CREATE TYPE public.app_role AS ENUM ('owner','admin','manager','operator','viewer');

CREATE TABLE public.teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);

CREATE TABLE public.team_members (
  team_id uuid REFERENCES public.teams(id),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE public.super_admins (user_id uuid PRIMARY KEY);

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = check_user_id)
$$;

-- stripe_webhook_events as in 20260405032534.
CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public, storage, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
