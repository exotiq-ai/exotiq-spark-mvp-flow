ALTER TABLE public.booking_extensions
  ADD COLUMN IF NOT EXISTS operator_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS exotiq_payment_intent_id TEXT;

UPDATE public.booking_extensions
   SET operator_payment_intent_id = payment_intent_id
 WHERE operator_payment_intent_id IS NULL
   AND payment_intent_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_extensions_status_check'
      AND conrelid = 'public.booking_extensions'::regclass
  ) THEN
    ALTER TABLE public.booking_extensions
      DROP CONSTRAINT booking_extensions_status_check;
  END IF;
END$$;

ALTER TABLE public.booking_extensions
  ADD CONSTRAINT booking_extensions_status_check
  CHECK (status IN ('pending', 'paid', 'partially_paid', 'manual', 'failed'));