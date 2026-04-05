
-- Phase 2: Add Stripe Connect columns to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) NOT NULL DEFAULT 0.00;

-- Add booking source to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'direct';

-- Add hold/refund columns to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_charge_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS hold_status text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS original_amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS platform_fee numeric;

-- Add team_id to payouts
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

-- Create stripe_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

-- RLS for stripe_webhook_events (service role only, no public access)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
