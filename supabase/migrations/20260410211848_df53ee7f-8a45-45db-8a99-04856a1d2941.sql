
-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Daily: purge notifications older than 30 days
SELECT cron.schedule(
  'purge-old-notifications-daily',
  '0 3 * * *',
  $$SELECT public.purge_old_notifications()$$
);

-- Weekly (Sunday 4am UTC): invoke cleanup-unmatched-photos edge function
SELECT cron.schedule(
  'cleanup-unmatched-photos-weekly',
  '0 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/cleanup-unmatched-photos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZ3diYnF5ZGplb2t5cG9lbm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzgzNTEsImV4cCI6MjA3NzM1NDM1MX0.CIh8I-Y5bMERvkGLPeegkTNrW8Xbx7dijVhl2zyZ9ac"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
