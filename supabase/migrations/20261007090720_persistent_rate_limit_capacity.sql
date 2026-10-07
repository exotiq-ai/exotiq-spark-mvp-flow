-- The previous limiter returned true at capacity without incrementing, allowing
-- every subsequent request in that window. Reserve one slot atomically; denied
-- requests never increment. This keeps existing server-only call signatures.
CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text,_limit integer,_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE v_window_start timestamptz;v_reserved integer;
BEGIN
 IF _bucket IS NULL OR length(_bucket) NOT BETWEEN 1 AND 512 OR _limit IS NULL OR _limit<1 OR _window_seconds IS NULL OR _window_seconds<1 THEN RETURN false;END IF;
 v_window_start:=to_timestamp(floor(extract(epoch FROM clock_timestamp())/_window_seconds)*_window_seconds);
 INSERT INTO public.rate_limit_counters(bucket,window_start,count) VALUES(_bucket,v_window_start,0)
 ON CONFLICT(bucket,window_start) DO NOTHING;
 UPDATE public.rate_limit_counters SET count=count+1
 WHERE bucket=_bucket AND window_start=v_window_start AND count<_limit RETURNING count INTO v_reserved;
 IF random()<0.01 THEN DELETE FROM public.rate_limit_counters WHERE window_start<clock_timestamp()-interval '1 day';END IF;
 RETURN v_reserved IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
