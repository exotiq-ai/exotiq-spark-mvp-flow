CREATE TABLE public.booking_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  extended_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_end_date TIMESTAMPTZ NOT NULL,
  new_end_date TIMESTAMPTZ NOT NULL,
  added_days INTEGER NOT NULL CHECK (added_days > 0),
  rate_cents_per_day BIGINT NOT NULL CHECK (rate_cents_per_day >= 0),
  added_subtotal_cents BIGINT NOT NULL DEFAULT 0,
  added_state_fee_cents BIGINT NOT NULL DEFAULT 0,
  added_processing_fee_cents BIGINT NOT NULL DEFAULT 0,
  added_platform_fee_cents BIGINT NOT NULL DEFAULT 0,
  added_total_cents BIGINT NOT NULL DEFAULT 0,
  charge_method TEXT NOT NULL CHECK (charge_method IN ('card_on_file', 'payment_link', 'manual')),
  payment_intent_id TEXT,
  invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'failed', 'manual')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_extensions_booking_id_idx ON public.booking_extensions(booking_id);
CREATE INDEX booking_extensions_team_id_idx ON public.booking_extensions(team_id);

GRANT SELECT, INSERT, UPDATE ON public.booking_extensions TO authenticated;
GRANT ALL ON public.booking_extensions TO service_role;

ALTER TABLE public.booking_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their bookings extensions"
  ON public.booking_extensions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = booking_extensions.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE POLICY "Team members can insert extensions for their bookings"
  ON public.booking_extensions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = booking_extensions.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE POLICY "Team members can update their bookings extensions"
  ON public.booking_extensions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = booking_extensions.team_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE TRIGGER update_booking_extensions_updated_at
  BEFORE UPDATE ON public.booking_extensions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
