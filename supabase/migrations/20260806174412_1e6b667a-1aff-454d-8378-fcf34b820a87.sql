DO $$
DECLARE
  v_token text;
  v_base  text := 'https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/';
  v_anon  text;
  r       record;
BEGIN
  SELECT substring(command from 'x-cron-token"\s*:\s*"([^"]+)"'),
         substring(command from 'apikey"\s*:\s*"([^"]+)"')
    INTO v_token, v_anon
  FROM cron.job
  WHERE jobname = 'check-fleet-alerts-hourly';

  IF v_token IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'Could not resolve cron token/anon key from existing job';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('rent-payment-scheduler-every-15-min', 'rent-payment-scheduler', '*/15 * * * *'),
      ('retention-sweeper-daily',             'retention-sweeper',      '0 3 * * *'),
      ('daily-generate-recurring-expenses',   'generate-recurring-expenses', '0 3 * * *')
    ) AS t(jobname, fn, sched)
  LOOP
    PERFORM cron.unschedule(r.jobname);
    PERFORM cron.schedule(
      r.jobname,
      r.sched,
      format(
        $q$select net.http_post(url := %L, headers := %L::jsonb, body := jsonb_build_object('trigger','cron','time', now())) as request_id;$q$,
        v_base || r.fn,
        json_build_object(
          'Content-Type', 'application/json',
          'apikey', v_anon,
          'Authorization', 'Bearer ' || v_anon,
          'x-cron-token', v_token
        )::text
      )
    );
  END LOOP;
END $$;