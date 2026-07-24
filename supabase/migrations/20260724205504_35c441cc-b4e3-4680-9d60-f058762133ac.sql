-- Reproducible registration of the rent-payment-scheduler cron.
-- The dev environment already has this job; this migration is idempotent and
-- serves as the source of truth for cutover environments.
--
-- The scheduler fires every 15 minutes to:
--   1. Expire overdue marketplace bookings past payment_due_at.
--   2. Send 24h reminders for pending_payment bookings.
--
-- NOTE: The apikey header must be the environment-specific Supabase anon key.
-- Replace <PROJECT_REF> and <ANON_KEY> at cutover.

DO $$
DECLARE
  v_project_ref text := 'jlgwbbqydjeokypoenoc';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZ3diYnF5ZGplb2t5cG9lbm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzgzNTEsImV4cCI6MjA3NzM1NDM1MX0.CIh8I-Y5bMERvkGLPeegkTNrW8Xbx7dijVhl2zyZ9ac';
  v_command text;
BEGIN
  v_command := format($cmd$
    select net.http_post(
      url := 'https://%s.supabase.co/functions/v1/rent-payment-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', %L,
        'Authorization', 'Bearer ' || %L
      ),
      body := jsonb_build_object('trigger', 'cron', 'time', now())
    ) as request_id;
  $cmd$, v_project_ref, v_anon_key, v_anon_key);

  -- Unschedule any existing job with this name (idempotent), then re-register.
  PERFORM cron.unschedule('rent-payment-scheduler-every-15-min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rent-payment-scheduler-every-15-min');

  PERFORM cron.schedule(
    'rent-payment-scheduler-every-15-min',
    '*/15 * * * *',
    v_command
  );
END $$;