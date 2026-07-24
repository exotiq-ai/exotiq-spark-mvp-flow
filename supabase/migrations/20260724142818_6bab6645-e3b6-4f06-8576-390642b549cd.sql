
-- M6b payment mirror: idempotent Stripe-sourced payment rows for marketplace bookings.

-- 1) Idempotency: one payment row per Stripe PaymentIntent id.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_unique
  ON public.payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 2) Remove the manual duplicate payment recorded on BK-03447 before the
--    real Stripe flow ran (2026-07-23 late-night manual entry).
DELETE FROM public.payments
WHERE id = '8d9cbe2a-da81-43f7-8b7d-8fcbeeee0b33';

-- 3) Backfill mirror rows for every marketplace booking that has already
--    been paid via the M6b flow (operator rental leg + Exotiq fee leg).
--    Skips 'none_required' sentinel and zero-fee bookings for the Exotiq leg.
INSERT INTO public.payments (
  user_id, booking_id, team_id, payment_type, amount,
  payment_status, stripe_payment_intent_id, transaction_date,
  payment_method, notes
)
SELECT b.user_id, b.id, b.team_id, 'rental', b.total_value,
       'completed', b.operator_payment_intent_id, b.paid_at,
       'stripe', 'Marketplace rental — Stripe destination charge'
FROM public.bookings b
WHERE b.booking_source = 'marketplace'
  AND b.operator_payment_intent_id IS NOT NULL
  AND b.operator_payment_intent_id <> 'none_required'
  AND b.paid_at IS NOT NULL
ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING;

INSERT INTO public.payments (
  user_id, booking_id, team_id, payment_type, amount,
  payment_status, stripe_payment_intent_id, transaction_date,
  payment_method, notes
)
SELECT b.user_id, b.id, b.team_id, 'fee',
       (COALESCE(b.platform_fee_cents,0) + COALESCE(b.protection_total_cents,0))::numeric / 100,
       'completed', b.exotiq_payment_intent_id, b.paid_at,
       'stripe', 'Exotiq booking fee + protection'
FROM public.bookings b
WHERE b.booking_source = 'marketplace'
  AND b.exotiq_payment_intent_id IS NOT NULL
  AND b.exotiq_payment_intent_id <> 'none_required'
  AND b.paid_at IS NOT NULL
  AND (COALESCE(b.platform_fee_cents,0) + COALESCE(b.protection_total_cents,0)) > 0
ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL DO NOTHING;
