
-- ============================================================================
-- 1. TEAMS: country, currency, locale, tax config, VAT, business address
-- ============================================================================

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS tax_label text NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS business_address jsonb,
  ADD COLUMN IF NOT EXISTS invoice_sequence bigint NOT NULL DEFAULT 0;

-- Belt-and-suspenders: ensure any rows somehow created without defaults are US
UPDATE public.teams
   SET country_code     = COALESCE(country_code, 'US'),
       currency         = COALESCE(currency, 'USD'),
       locale           = COALESCE(locale, 'en-US'),
       tax_label        = COALESCE(tax_label, 'Tax'),
       tax_rate_percent = COALESCE(tax_rate_percent, 0),
       tax_inclusive    = COALESCE(tax_inclusive, false),
       invoice_sequence = COALESCE(invoice_sequence, 0)
 WHERE country_code     IS NULL
    OR currency         IS NULL
    OR locale           IS NULL
    OR tax_label        IS NULL
    OR tax_rate_percent IS NULL
    OR tax_inclusive    IS NULL
    OR invoice_sequence IS NULL;

-- Format guards
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_country_code_format,
  ADD  CONSTRAINT teams_country_code_format
       CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_currency_format,
  ADD  CONSTRAINT teams_currency_format
       CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_tax_rate_range,
  ADD  CONSTRAINT teams_tax_rate_range
       CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100);

-- ============================================================================
-- 2. BOOKINGS: per-booking currency + tax snapshot, invoice ref
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz;

-- Backfill: existing bookings are USD, 0% tax, subtotal == total_value
-- so totals are mathematically identical to today.
UPDATE public.bookings
   SET currency         = COALESCE(currency, 'USD'),
       tax_rate_percent = COALESCE(tax_rate_percent, 0),
       tax_inclusive    = COALESCE(tax_inclusive, false),
       tax_amount       = COALESCE(tax_amount, 0),
       subtotal         = COALESCE(NULLIF(subtotal, 0), COALESCE(total_value, 0))
 WHERE subtotal IS NULL
    OR subtotal = 0
    OR currency IS NULL
    OR tax_rate_percent IS NULL
    OR tax_inclusive IS NULL
    OR tax_amount IS NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_currency_format,
  ADD  CONSTRAINT bookings_currency_format
       CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_tax_rate_range,
  ADD  CONSTRAINT bookings_tax_rate_range
       CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100);

-- ============================================================================
-- 3. TENANT_INVOICES: immutable VAT invoice ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  booking_id          uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  invoice_number      text NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  tax_point_date      date NOT NULL,
  currency            text NOT NULL,
  subtotal            numeric(12,2) NOT NULL,
  tax_amount          numeric(12,2) NOT NULL,
  total               numeric(12,2) NOT NULL,
  tax_rate_percent    numeric(5,2)  NOT NULL,
  tax_inclusive       boolean       NOT NULL DEFAULT false,
  supplier_snapshot   jsonb         NOT NULL,
  customer_snapshot   jsonb         NOT NULL,
  line_items          jsonb         NOT NULL DEFAULT '[]'::jsonb,
  pdf_storage_path    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invoices_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT tenant_invoices_unique_per_team UNIQUE (team_id, invoice_number),
  CONSTRAINT tenant_invoices_one_per_booking UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS tenant_invoices_team_idx
  ON public.tenant_invoices(team_id, issued_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.tenant_invoices TO authenticated;
GRANT ALL ON public.tenant_invoices TO service_role;

ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

-- Team members can view invoices for their team
DROP POLICY IF EXISTS "Team members view tenant invoices" ON public.tenant_invoices;
CREATE POLICY "Team members view tenant invoices"
  ON public.tenant_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = tenant_invoices.team_id
         AND tm.user_id = auth.uid()
    )
  );

-- Only team owners/admins can insert invoices (the edge function uses service_role)
DROP POLICY IF EXISTS "Team admins insert tenant invoices" ON public.tenant_invoices;
CREATE POLICY "Team admins insert tenant invoices"
  ON public.tenant_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = tenant_invoices.team_id
         AND tm.user_id = auth.uid()
         AND tm.role IN ('owner', 'admin')
    )
  );

-- Updates (e.g. attaching pdf_storage_path) restricted to team admins
DROP POLICY IF EXISTS "Team admins update tenant invoices" ON public.tenant_invoices;
CREATE POLICY "Team admins update tenant invoices"
  ON public.tenant_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = tenant_invoices.team_id
         AND tm.user_id = auth.uid()
         AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = tenant_invoices.team_id
         AND tm.user_id = auth.uid()
         AND tm.role IN ('owner', 'admin')
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tenant_invoices_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_invoices_updated_at ON public.tenant_invoices;
CREATE TRIGGER tenant_invoices_updated_at
  BEFORE UPDATE ON public.tenant_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tenant_invoices_set_updated_at();

-- ============================================================================
-- 4. next_invoice_number(): atomic sequential assignment per team
-- ============================================================================

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_team_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
  v_year text;
BEGIN
  -- Atomic increment + read in one statement; locks the team row briefly
  UPDATE public.teams
     SET invoice_sequence = invoice_sequence + 1
   WHERE id = p_team_id
   RETURNING invoice_sequence INTO v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Team % not found', p_team_id;
  END IF;

  v_year := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  RETURN 'INV-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;
