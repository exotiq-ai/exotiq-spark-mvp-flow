-- Source-confirmed fields selected ONLY for request slice. Still partial schema:
-- no Supabase auth, provider, whole-schema/default/trigger parity.
-- bookings.created_at used by source expiry jobs and original booking defaults.
ALTER TABLE public.bookings ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
-- Existing rent-create-booking explicitly selects these current team fields.
ALTER TABLE public.teams ADD COLUMN support_email text, ADD COLUMN support_phone text;
-- Exact identity ledger shape from 20260721180000_identity_verifications.sql;
-- only fields this slice reads; not the full migration or RLS deployment.
CREATE TABLE public.identity_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'created', document_expiry date,
 verified_at timestamptz
);
