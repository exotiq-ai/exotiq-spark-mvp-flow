ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fee_model_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_fee_cents bigint,
  ADD COLUMN IF NOT EXISTS tax_lines jsonb,
  ADD COLUMN IF NOT EXISTS deposit_hold_cents bigint,
  ADD COLUMN IF NOT EXISTS terms_consent_status text;
COMMENT ON COLUMN public.bookings.fee_model_version IS '1 = legacy split (taxes on Exotiq leg); 2 = taxes on operator transfer, Exotiq leg = service fee only.';

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fuel_type text;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_fuel_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_fuel_type_check CHECK (fuel_type IS NULL OR fuel_type IN ('Gasoline','Electric','Hybrid'));

CREATE TABLE IF NOT EXISTS public.legal_assents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  booking_ref text,
  renter_email text NOT NULL,
  doc_id text NOT NULL CHECK (doc_id IN ('terms','privacy','release')),
  doc_version text NOT NULL,
  checkbox_text_hash text NOT NULL CHECK (checkbox_text_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  team_id uuid,
  storefront_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.legal_assents IS 'Append-only renter legal assent log. Retention: 7 years. Writes only via rent-log-assent edge function.';
GRANT SELECT, INSERT ON public.legal_assents TO service_role;
ALTER TABLE public.legal_assents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read assents" ON public.legal_assents FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
GRANT SELECT ON public.legal_assents TO authenticated;
CREATE INDEX IF NOT EXISTS legal_assents_booking_idx ON public.legal_assents(booking_ref);

CREATE OR REPLACE FUNCTION public.legal_assents_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'legal_assents is append-only'; END $$;
CREATE TRIGGER legal_assents_no_update BEFORE UPDATE OR DELETE ON public.legal_assents
  FOR EACH ROW EXECUTE FUNCTION public.legal_assents_block_mutation();