-- Additive internal snapshots. Apply only after reviewed 090000 auth migration.
-- Pricing remains public_vehicle_quote; no quote creates an inventory hold.
CREATE TABLE public.external_quotes (
  quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 500),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 500),
  audience text NOT NULL CHECK (length(audience) BETWEEN 1 AND 500),
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 500),
  operator_id uuid NOT NULL REFERENCES public.teams(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  pickup_at timestamptz NOT NULL,
  return_at timestamptz NOT NULL CHECK (return_at > pickup_at),
  timezone text NOT NULL,
  selected_options jsonb NOT NULL CHECK (jsonb_typeof(selected_options) = 'array' AND jsonb_array_length(selected_options) = 1),
  authority jsonb NOT NULL CHECK (jsonb_typeof(authority) = 'object'),
  pricing_version text NOT NULL CHECK (pricing_version ~ '^[a-f0-9]{64}$'),
  terms_version text NOT NULL CHECK (terms_version ~ '^[a-f0-9]{64}$'),
  terms_hash text NOT NULL CHECK (terms_hash ~ '^[a-f0-9]{64}$'),
  availability_checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_booking_id uuid UNIQUE REFERENCES public.bookings(id),
  FOREIGN KEY (issuer,subject,operator_id,customer_id)
    REFERENCES public.external_customer_links(issuer,subject,operator_id,customer_id),
  CHECK (availability_checked_at <= created_at AND created_at - availability_checked_at <= interval '30 seconds'),
  CHECK (expires_at > created_at AND expires_at <= availability_checked_at + interval '15 minutes'),
  CHECK (terms_version = terms_hash)
);
CREATE INDEX external_quotes_principal_lookup ON public.external_quotes(issuer,subject,client_id,quote_id);
ALTER TABLE public.external_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_quotes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.external_quotes TO service_role;

ALTER TABLE public.external_consent_receipts ADD CONSTRAINT external_consent_receipts_quote_fk
  FOREIGN KEY (quote_id) REFERENCES public.external_quotes(quote_id);

CREATE FUNCTION public.external_quote_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR
     (to_jsonb(NEW) - 'consumed_booking_id') IS DISTINCT FROM (to_jsonb(OLD) - 'consumed_booking_id') OR
     OLD.consumed_booking_id IS NOT NULL OR NEW.consumed_booking_id IS NULL THEN
    RAISE EXCEPTION 'quote_immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'quote_expired' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = NEW.consumed_booking_id
    AND b.team_id = NEW.operator_id AND b.vehicle_id = NEW.vehicle_id AND b.customer_id = NEW.customer_id
    AND b.start_date = NEW.pickup_at AND b.end_date = NEW.return_at) THEN
    RAISE EXCEPTION 'consent_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.external_quote_immutable() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER external_quote_immutable BEFORE UPDATE OR DELETE ON public.external_quotes
FOR EACH ROW EXECUTE FUNCTION public.external_quote_immutable();

-- Lock configuration rows through the caller's transaction. Future request RPC06
-- reuses this function inside its serialized booking transaction and compares
-- complete pricing/terms/window/options JSONB before receipt/quote consumption.
CREATE FUNCTION public.external_quote_authority(
  _operator_id uuid, _vehicle_id uuid, _pickup_at timestamptz, _return_at timestamptz,
  _timezone text, _selected_options jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  t public.teams%ROWTYPE; v public.vehicles%ROWTYPE; l public.locations%ROWTYPE;
  q jsonb; terms jsonb; win jsonb; checked timestamptz;
  local_start date; local_end date; available boolean; cent_field text;
BEGIN
  IF _operator_id IS NULL OR _vehicle_id IS NULL OR _pickup_at IS NULL OR _return_at IS NULL OR
    _timezone IS NULL OR _selected_options IS NULL OR jsonb_typeof(_selected_options) <> 'array' OR
    jsonb_array_length(_selected_options) <> 1 OR _selected_options->>0 IS NULL OR
    jsonb_typeof(_selected_options->0) <> 'string' OR _selected_options->>0 NOT IN ('premium','standard','decline') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';
  END IF;
  SELECT * INTO t FROM public.teams WHERE id = _operator_id FOR SHARE;
  IF NOT FOUND OR NOT public.is_marketplace_team(t.id) THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = _vehicle_id AND team_id = t.id FOR SHARE;
  IF NOT FOUND OR NOT public.is_marketplace_vehicle(v.id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _timezone IS DISTINCT FROM coalesce(t.timezone,'UTC') OR
     NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _timezone) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  local_start := (_pickup_at AT TIME ZONE _timezone)::date;
  local_end := (_return_at AT TIME ZONE _timezone)::date;
  IF _pickup_at < clock_timestamp() OR _return_at <= _pickup_at OR local_end <= local_start OR
    _return_at - _pickup_at > interval '365 days' OR _pickup_at <> date_trunc('milliseconds',_pickup_at) OR
    _return_at <> date_trunc('milliseconds',_return_at) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF v.location_id IS NOT NULL THEN
    SELECT * INTO l FROM public.locations WHERE id = v.location_id AND team_id = t.id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  END IF;
  -- Exact term-authority helper can choose a default location; protect that row too.
  PERFORM 1 FROM public.locations WHERE team_id = t.id AND coalesce(is_active,true) FOR SHARE;
  PERFORM 1 FROM public.state_rental_fees WHERE state_code = public.team_state_code(t.id) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  -- Defined by reviewed inventory migration090300. Forward reference intentionally
  -- means no quote can be issued until all wave3 dependencies are applied.
  -- One shared predicate owns post-return buffers, historical and paid records.
  available := public.agent_inventory_available(v.id,_pickup_at,_return_at);
  IF available IS NULL THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  IF available IS NOT TRUE THEN RAISE EXCEPTION 'dates_unavailable'; END IF;
  checked := clock_timestamp();
  SELECT to_jsonb(result) INTO q FROM public.public_vehicle_quote(t.slug,v.slug,local_start,local_end,
    jsonb_build_object('protection',_selected_options->>0)) result;
  IF q IS NULL OR q->>'currency' IS DISTINCT FROM 'USD' OR q->>'state_code' IS NULL OR
    q->>'operator_tax_rate' IS NULL OR q->>'state_fee_daily_cents' IS NULL OR
    (q->>'platform_fee_percent')::numeric < 0 OR (q->>'operator_tax_rate')::numeric < 0 OR
    q->>'protection_tier' IS DISTINCT FROM _selected_options->>0 THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  terms := jsonb_build_object(
    'operator_tax_inclusive',coalesce(l.tax_inclusive,t.tax_inclusive,false),
    'cancellation_policy',public.cancellation_policy_text(),
    'pickup_address',public.resolve_pickup_address(t.id,v.id),
    'pickup_instructions',nullif(btrim(t.pickup_instructions),''),
    'mileage_limit',coalesce(v.default_mileage_limit,t.default_mileage_limit),
    'mileage_overage_rate',coalesce(v.mileage_overage_rate,t.default_mileage_overage_rate)::text,
    'currency',q->>'currency',
    -- Preserve numeric declaration text across JSON decoders without rounding.
    'operator_tax_rate_percent',q->>'operator_tax_rate',
    'platform_fee_percent',q->>'platform_fee_percent',
    'rental_buffer_minutes',coalesce(t.rental_buffer_minutes,60),
    'operator_approval_required',true,
    'payment_schedule',jsonb_build_array(
      jsonb_build_object('payee','operator','amount_cents',q->'operator_total_cents','due','after_operator_approval'),
      jsonb_build_object('payee','exotiq','amount_cents',q->'exotiq_total_cents','due','after_operator_charge')),
    'deposit_disclosure','Security deposit is separate from rental charges. This quote does not create a card authorization.'
  );
  IF terms->>'cancellation_policy' IS NULL THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  -- Contract-supported shape must be proven BEFORE INSERT. Conservative UTF8
  -- byte bounds are narrower than JSON Schema codepoint bounds and also avoid
  -- astral Unicode/UTF16 reader disagreement without truncating customer terms.
  IF octet_length(terms->>'cancellation_policy') NOT BETWEEN 1 AND 8000 OR
    octet_length(terms->>'pickup_address') NOT BETWEEN 1 AND 4096 OR
    octet_length(terms->>'pickup_instructions') NOT BETWEEN 1 AND 4096 OR
    octet_length(terms->>'deposit_disclosure') NOT BETWEEN 1 AND 2000 OR
    octet_length(q->>'operator_tax_label') NOT BETWEEN 1 AND 160 OR
    octet_length(q->>'state_fee_label') NOT BETWEEN 1 AND 160 OR
    q->>'state_code' !~ '^[A-Z]{2}$' OR (q->>'rental_days')::integer NOT BETWEEN 1 AND 365 OR
    q->>'operator_tax_rate' !~ '^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$' OR
    q->>'platform_fee_percent' !~ '^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$' OR
    (terms->>'mileage_overage_rate' IS NOT NULL AND terms->>'mileage_overage_rate' !~ '^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$') THEN
    RAISE EXCEPTION 'upstream_unavailable';
  END IF;
  -- Validate supported precision, never round or derive substitute pricing.
  FOREACH cent_field IN ARRAY ARRAY['daily_rate_cents','rental_subtotal_cents','deposit_cents',
    'operator_total_cents','platform_fee_cents','protection_daily_cents','protection_total_cents',
    'state_fee_cents','processing_fee_cents','exotiq_total_cents','grand_total_cents',
    'state_fee_daily_cents','operator_tax_cents'] LOOP
    IF q->>cent_field IS NULL OR q->>cent_field !~ '^(0|[1-9][0-9]*)$' OR
      (q->>cent_field)::numeric > 9007199254740991 THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  END LOOP;
  IF (q->>'operator_total_cents')::bigint + (q->>'exotiq_total_cents')::bigint <> (q->>'grand_total_cents')::bigint OR
    (q->>'operator_total_cents')::bigint <> (q->>'rental_subtotal_cents')::bigint +
      (CASE WHEN (terms->>'operator_tax_inclusive')::boolean THEN 0 ELSE (q->>'operator_tax_cents')::bigint END) OR
    (q->>'exotiq_total_cents')::bigint <> (q->>'platform_fee_cents')::bigint + (q->>'protection_total_cents')::bigint +
      (q->>'state_fee_cents')::bigint + (q->>'processing_fee_cents')::bigint OR
    ((terms->>'operator_tax_inclusive')::boolean AND (q->>'operator_tax_cents')::bigint > (q->>'rental_subtotal_cents')::bigint) OR
    (q->>'rental_days')::int <> local_end-local_start OR
    coalesce(v.default_mileage_limit,t.default_mileage_limit) < 0 OR
    coalesce(v.mileage_overage_rate,t.default_mileage_overage_rate) < 0 THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  -- Window uses UTC instants internally. API maps into tenant offset timestamps;
  -- authority comparisons always use timestamptz columns, never display formatting.
  win := jsonb_build_object('operator_id',t.id,'vehicle_id',v.id,'timezone',_timezone,'selected_options',_selected_options,
    'pickup_at',to_char(_pickup_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'return_at',to_char(_return_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  RETURN jsonb_build_object('pricing',q,'terms',terms,'window',win,'selected_options',_selected_options,
    'availability','AVAILABLE','availability_checked_at',checked);
END $$;
REVOKE ALL ON FUNCTION public.external_quote_authority(uuid,uuid,timestamptz,timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.external_quote_authority(uuid,uuid,timestamptz,timestamptz,text,jsonb) TO service_role;

CREATE FUNCTION public.external_create_quote(
  _subject text, _customer_id uuid, _issuer text, _audience text, _client_id text,
  _operator_id uuid, _vehicle_id uuid, _pickup_at timestamptz, _return_at timestamptz,
  _timezone text, _selected_options jsonb, _ttl_seconds integer DEFAULT 900
) RETURNS SETOF public.external_quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE a jsonb; pricing_hash text; term_hash text; checked timestamptz; created timestamptz;
BEGIN
  IF _subject IS NULL OR _customer_id IS NULL OR _issuer IS NULL OR _audience IS NULL OR _client_id IS NULL OR
    length(_subject) NOT BETWEEN 1 AND 500 OR length(_issuer) NOT BETWEEN 1 AND 500 OR
    length(_audience) NOT BETWEEN 1 AND 500 OR length(_client_id) NOT BETWEEN 1 AND 500 OR
    _ttl_seconds IS NULL OR _ttl_seconds NOT BETWEEN 1 AND 900 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  PERFORM 1 FROM public.customers WHERE id = _customer_id AND team_id = _operator_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  PERFORM 1 FROM public.external_customer_links WHERE issuer = _issuer AND subject = _subject
    AND operator_id = _operator_id AND customer_id = _customer_id AND verified_at IS NOT NULL
    AND revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  a := public.external_quote_authority(_operator_id,_vehicle_id,_pickup_at,_return_at,_timezone,_selected_options);
  checked := (a->>'availability_checked_at')::timestamptz;
  created := clock_timestamp();
  IF created - checked > interval '30 seconds' THEN RAISE EXCEPTION 'upstream_unavailable'; END IF;
  pricing_hash := encode(sha256(convert_to((a->'pricing')::text,'UTF8')),'hex');
  term_hash := encode(sha256(convert_to(jsonb_build_object('pricing',a->'pricing','terms',a->'terms','window',a->'window',
    'selected_options',a->'selected_options')::text,'UTF8')),'hex');
  RETURN QUERY INSERT INTO public.external_quotes(subject,customer_id,issuer,audience,client_id,operator_id,vehicle_id,
    pickup_at,return_at,timezone,selected_options,authority,pricing_version,terms_version,terms_hash,
    availability_checked_at,created_at,expires_at)
    VALUES (_subject,_customer_id,_issuer,_audience,_client_id,_operator_id,_vehicle_id,
      _pickup_at,_return_at,_timezone,_selected_options,a,pricing_hash,term_hash,term_hash,
      checked,created,least(created + make_interval(secs=>_ttl_seconds), checked + interval '15 minutes'))
    RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.external_create_quote(text,uuid,text,text,text,uuid,uuid,timestamptz,timestamptz,text,jsonb,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.external_create_quote(text,uuid,text,text,text,uuid,uuid,timestamptz,timestamptz,text,jsonb,integer)
  TO service_role;
