-- Preparation only: actual quote/request wrappers are integrated sequentially
-- after09/14 final source handoff. All switches begin disabled.
CREATE TABLE public.external_api_runtime_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 external_api_new_writes_enabled boolean NOT NULL DEFAULT false,
 event_retention_days integer NOT NULL DEFAULT 30 CHECK(event_retention_days BETWEEN 1 AND 90),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_by uuid
);
INSERT INTO public.external_api_runtime_settings(singleton) VALUES(true);
-- Global rollout authority is independently reviewed and seeded only by a
-- trusted database administrator. No email inference or public/service setter
-- can grant this binding; an editable source super_admins row is insufficient.
CREATE TABLE public.external_rollout_admins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),active boolean NOT NULL DEFAULT true,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.external_rollout_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_rollout_admins FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.external_rollout_admins TO service_role;
CREATE TABLE public.external_flag_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,
 operator_id uuid REFERENCES public.teams(id),
 change_type text NOT NULL CHECK(change_type IN('global_new_writes','operator_opt_in','retention')),
 before_value jsonb NOT NULL,after_value jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.external_redacted_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event jsonb NOT NULL CHECK(jsonb_typeof(event)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 claimed_until timestamptz,claim_token uuid,attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
 delivery_state text NOT NULL DEFAULT 'pending' CHECK(delivery_state IN('pending','delivered','manual_review')),
 delivered_at timestamptz
);
ALTER TABLE public.external_api_runtime_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_flag_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_redacted_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.external_api_runtime_settings,public.external_flag_audit,public.external_redacted_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.external_api_runtime_settings,public.external_flag_audit,public.external_redacted_events TO service_role;
-- Reuse07 operator settings; never create a competing opt-in table.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.external_operator_api_settings FROM PUBLIC,anon,authenticated,service_role;

-- Source profile email alone is NOT admin/customer proof. Require current
-- verified Supabase identity plus its matching profile, with direct admin UUID.
-- No source is_super_admin email-fallback authorization is used.
CREATE FUNCTION public.external_verified_flag_actor(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT _actor IS NOT NULL AND _actor=auth.uid() AND EXISTS(
  SELECT FROM auth.users u JOIN public.profiles p ON p.id=u.id
  WHERE u.id=_actor AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
  AND lower(p.email)=lower(u.email))
$$;
CREATE FUNCTION public.external_verified_flag_admin(_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.external_verified_flag_actor(_actor) AND EXISTS(
  SELECT FROM public.super_admins sa JOIN public.external_rollout_admins rollout ON rollout.user_id=sa.user_id
  WHERE sa.user_id=_actor AND sa.is_active IS TRUE AND rollout.active IS TRUE)
$$;
CREATE FUNCTION public.external_set_global_new_writes(_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE actor uuid:=auth.uid(); previous boolean;
BEGIN
 IF _enabled IS NULL THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF NOT public.external_verified_flag_admin(actor) THEN RAISE EXCEPTION 'forbidden';END IF;
 SELECT external_api_new_writes_enabled INTO previous FROM public.external_api_runtime_settings WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
 UPDATE public.external_api_runtime_settings SET external_api_new_writes_enabled=_enabled,updated_at=clock_timestamp(),updated_by=actor WHERE singleton;
 INSERT INTO public.external_flag_audit(actor_id,change_type,before_value,after_value)VALUES(actor,'global_new_writes',to_jsonb(previous),to_jsonb(_enabled));
 RETURN _enabled;
END $$;
CREATE FUNCTION public.external_set_operator_api_enabled(_operator_id uuid,_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE actor uuid:=auth.uid(); previous boolean;
BEGIN
 IF _enabled IS NULL OR _operator_id IS NULL THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF NOT public.external_verified_flag_actor(actor) OR NOT EXISTS(
  SELECT FROM public.team_members m JOIN public.teams t ON t.id=m.team_id
  WHERE m.team_id=_operator_id AND m.user_id=actor AND m.is_active IS TRUE
  AND (m.role::text='admin' OR (m.role::text='owner' AND t.owner_id=actor))) THEN RAISE EXCEPTION 'forbidden';END IF;
 INSERT INTO public.external_operator_api_settings(operator_id)VALUES(_operator_id) ON CONFLICT(operator_id) DO NOTHING;
 SELECT external_api_enabled INTO previous FROM public.external_operator_api_settings WHERE operator_id=_operator_id FOR UPDATE;
 UPDATE public.external_operator_api_settings SET external_api_enabled=_enabled,updated_at=clock_timestamp() WHERE operator_id=_operator_id;
 INSERT INTO public.external_flag_audit(actor_id,operator_id,change_type,before_value,after_value)VALUES(actor,_operator_id,'operator_opt_in',to_jsonb(previous),to_jsonb(_enabled));
 RETURN _enabled;
END $$;
CREATE FUNCTION public.external_set_event_retention(_days integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE actor uuid:=auth.uid(); previous integer;
BEGIN
 IF _days IS NULL OR _days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF NOT public.external_verified_flag_admin(actor) THEN RAISE EXCEPTION 'forbidden';END IF;
 SELECT event_retention_days INTO previous FROM public.external_api_runtime_settings WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
 UPDATE public.external_api_runtime_settings SET event_retention_days=_days,updated_at=clock_timestamp(),updated_by=actor WHERE singleton;
 INSERT INTO public.external_flag_audit(actor_id,change_type,before_value,after_value)VALUES(actor,'retention',to_jsonb(previous),to_jsonb(_days));
 RETURN _days;
END $$;
CREATE FUNCTION public.external_read_operation_flags(_operator_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='4s' AS $$
 SELECT jsonb_build_object('new_writes_enabled',r.external_api_new_writes_enabled,'operator_enabled',coalesce(o.external_api_enabled,false))
 FROM public.external_api_runtime_settings r LEFT JOIN public.external_operator_api_settings o ON o.operator_id=_operator_id WHERE r.singleton
$$;

-- Defense in depth: the database itself validates telemetry, even when a
-- trusted caller bypasses the TypeScript allowlist. No arbitrary detail field.
CREATE FUNCTION public.external_enqueue_redacted_event(_event jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='4s' AS $$
DECLARE key text; value jsonb;
BEGIN
 IF _event IS NULL OR jsonb_typeof(_event)<>'object' OR octet_length(_event::text)>4096 THEN RAISE EXCEPTION 'invalid_input';END IF;
 IF NOT (_event ?& ARRAY['request_id','action','outcome']) THEN RAISE EXCEPTION 'invalid_input';END IF;
 FOR key,value IN SELECT * FROM jsonb_each(_event) LOOP
  IF key IN('request_id') THEN
   IF jsonb_typeof(value)<>'string' OR (_event->>key)!~'^[A-Za-z0-9_-]{16,80}$' THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key IN('action') THEN
   IF jsonb_typeof(value)<>'string' OR (_event->>key) NOT IN('catalog:read','availability:read','quote:create','request:create','request:read','request:replay','grant:reauthorize','consent:new-delegation','identity:handoff','checkout:handoff','nonce:resolve','payment:reconcile','payment:settlement','payment:confirmation','notification:delivery','scheduler:tick','flags:change') THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key IN('outcome') THEN
   IF jsonb_typeof(value)<>'string' OR (_event->>key) NOT IN('success','denied','unknown','replay','conflict','deferred','failed') THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key IN('operator_id','quote_id','booking_id') THEN
   IF jsonb_typeof(value)<>'string' OR (_event->>key)!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key IN('principal_pseudonym','terms_version','pricing_version') THEN
   IF jsonb_typeof(value)<>'string' OR (_event->>key)!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key IN('latency_ms','scheduler_lag_ms') THEN
   IF jsonb_typeof(value)<>'number' OR (value::text)::numeric<0 OR (value::text)::numeric<>trunc((value::text)::numeric)
    OR (value::text)::numeric>(CASE WHEN key='latency_ms' THEN 300000 ELSE 31536000000 END) THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSIF key='itemization_equal' THEN
   IF jsonb_typeof(value)<>'boolean' THEN RAISE EXCEPTION 'invalid_input';END IF;
  ELSE RAISE EXCEPTION 'invalid_input';END IF;
 END LOOP;
 INSERT INTO public.external_redacted_events(event)VALUES(_event);
 RETURN true;
END $$;
CREATE FUNCTION public.external_claim_redacted_events(_limit integer DEFAULT 3)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='500ms' SET statement_timeout='4s' AS $$
DECLARE e public.external_redacted_events%ROWTYPE; moment timestamptz:=clock_timestamp();
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_input';END IF;
 UPDATE public.external_redacted_events SET delivery_state='manual_review' WHERE delivery_state='pending' AND attempts>=10;
 FOR e IN SELECT * FROM public.external_redacted_events WHERE delivery_state='pending' AND available_at<=moment AND (claimed_until IS NULL OR claimed_until<=moment) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT _limit LOOP
  UPDATE public.external_redacted_events SET claim_token=gen_random_uuid(),claimed_until=moment+interval '2 minutes',attempts=attempts+1 WHERE id=e.id RETURNING * INTO e;
  RETURN NEXT jsonb_build_object('id',e.id,'claim_token',e.claim_token,'event',e.event,'created_at',e.created_at);
 END LOOP;
END $$;
CREATE FUNCTION public.external_finish_redacted_event(_id uuid,_claim_token uuid,_delivered boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='4s' AS $$
BEGIN
 UPDATE public.external_redacted_events SET delivery_state=CASE WHEN _delivered THEN 'delivered' ELSE delivery_state END,
  delivered_at=CASE WHEN _delivered THEN clock_timestamp() ELSE delivered_at END,claimed_until=NULL,claim_token=NULL,
  available_at=clock_timestamp()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer))
 WHERE id=_id AND claim_token=_claim_token AND claimed_until>clock_timestamp() AND delivery_state='pending';
 RETURN FOUND;
END $$;
CREATE FUNCTION public.external_operational_maintenance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='4s' AS $$
DECLARE retention integer; deleted integer; lag numeric; pending bigint; manual bigint;
BEGIN
 SELECT event_retention_days INTO retention FROM public.external_api_runtime_settings WHERE singleton;
 IF retention IS NULL THEN RAISE EXCEPTION 'configuration_unavailable';END IF;
 DELETE FROM public.external_redacted_events WHERE created_at<clock_timestamp()-make_interval(days=>retention);GET DIAGNOSTICS deleted=ROW_COUNT;
 -- Notification contexts contain private customer delivery material; expire it
 -- at the same retention boundary after delivery or explicit manual review.
 UPDATE public.external_booking_outbox SET notification_context='{}'::jsonb WHERE created_at<clock_timestamp()-make_interval(days=>retention) AND delivery_state IN('delivered','manual_review') AND notification_context<>'{}'::jsonb;
 SELECT count(*) FILTER(WHERE delivery_state='pending'),count(*) FILTER(WHERE delivery_state='manual_review'),
  greatest(0,coalesce(extract(epoch FROM (clock_timestamp()-min(available_at) FILTER(WHERE delivery_state='pending')))*1000,0)) INTO pending,manual,lag FROM public.external_booking_outbox;
 RETURN jsonb_build_object('events_expired',deleted,'notification_pending',pending,'notification_manual_review',manual,'notification_lag_ms',trunc(lag));
END $$;
-- Tighten06 acknowledgements: an expired lease cannot complete another worker's
-- receipt. Provider response ambiguity keeps the durable key and retry window.
CREATE OR REPLACE FUNCTION public.external_ack_booking_outbox(_id uuid,_claim_token uuid,_message_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='4s' AS $$
BEGIN
 IF _message_id IS NULL OR length(_message_id) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid_input';END IF;
 UPDATE public.external_booking_outbox SET delivered_at=clock_timestamp(),provider_message_id=_message_id,delivery_state='delivered',claimed_until=NULL
 WHERE id=_id AND claim_token=_claim_token AND claimed_until>clock_timestamp() AND delivered_at IS NULL AND delivery_state='pending';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.external_verified_flag_actor(uuid),public.external_verified_flag_admin(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.external_set_global_new_writes(boolean),public.external_set_operator_api_enabled(uuid,boolean),public.external_set_event_retention(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.external_set_global_new_writes(boolean),public.external_set_operator_api_enabled(uuid,boolean),public.external_set_event_retention(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.external_read_operation_flags(uuid),public.external_enqueue_redacted_event(jsonb),public.external_claim_redacted_events(integer),public.external_finish_redacted_event(uuid,uuid,boolean),public.external_operational_maintenance() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.external_read_operation_flags(uuid),public.external_enqueue_redacted_event(jsonb),public.external_claim_redacted_events(integer),public.external_finish_redacted_event(uuid,uuid,boolean),public.external_operational_maintenance() TO service_role;
