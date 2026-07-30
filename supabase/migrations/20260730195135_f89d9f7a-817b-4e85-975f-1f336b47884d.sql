ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS consumer text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_stripe_event_id_key;

ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_consumer_event_key UNIQUE (consumer, stripe_event_id);