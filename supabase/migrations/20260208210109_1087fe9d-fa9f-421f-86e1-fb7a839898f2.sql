
-- Create function to purge old notifications
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule daily purge at 3:00 AM UTC
SELECT cron.schedule(
  'purge-old-notifications',
  '0 3 * * *',
  $$SELECT public.purge_old_notifications()$$
);
