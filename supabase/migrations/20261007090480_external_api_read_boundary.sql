-- Narrow external-reader RPCs. Existing marketplace/tenant visibility authority
-- remains unchanged; default-off opt-in is independently managed in plan15.
CREATE TABLE public.external_operator_api_settings (
  operator_id uuid PRIMARY KEY REFERENCES public.teams(id),
  external_api_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.external_operator_api_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_operator_api_settings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.external_operator_api_settings TO service_role;
-- No insert/backfill/enable/setter is performed. Plan15 owns mutation audit.

CREATE FUNCTION public.external_catalog_operators(_after uuid DEFAULT NULL,_limit integer DEFAULT 21,
  _browse boolean DEFAULT false,_city text DEFAULT NULL,_operator_slug text DEFAULT NULL)
RETURNS TABLE(operator_id uuid,slug text,name text,city text,timezone text,storefront_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 51 OR length(_city)>80 OR length(_operator_slug)>80 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT coalesce(_browse,false) AND _operator_slug IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT t.id,c.slug,c.name,c.city,coalesce(c.timezone,'UTC'),
    ('https://book.exotiq.rent/'||c.slug)::text
  FROM public.teams t JOIN public.external_operator_api_settings settings ON settings.operator_id=t.id AND settings.external_api_enabled
  CROSS JOIN LATERAL public.public_team_by_slug(t.slug) c
  WHERE public.is_marketplace_team(t.id) AND (_after IS NULL OR t.id>_after)
    AND (_city IS NULL OR lower(c.city)=lower(_city))
    AND ((_operator_slug IS NOT NULL AND c.slug=_operator_slug) OR
      (_operator_slug IS NULL AND _browse AND EXISTS(SELECT 1 FROM public.public_marketplace_teams() market WHERE market.slug=t.slug)))
  ORDER BY t.id LIMIT _limit;
END $$;
CREATE FUNCTION public.external_catalog_vehicles(_after uuid DEFAULT NULL,_limit integer DEFAULT 21,
  _browse boolean DEFAULT false,_city text DEFAULT NULL,_operator_id uuid DEFAULT NULL,
  _pickup_at timestamptz DEFAULT NULL,_return_at timestamptz DEFAULT NULL,_timezone text DEFAULT NULL)
RETURNS TABLE(operator_id uuid,vehicle_id uuid,slug text,name text,city text,timezone text,vehicle_url text,availability_requires_check boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 51 OR length(_city)>80 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF (_pickup_at IS NULL) <> (_return_at IS NULL) OR (_pickup_at IS NULL) <> (_timezone IS NULL) OR
    (_pickup_at IS NOT NULL AND (_return_at<=_pickup_at OR _pickup_at<clock_timestamp() OR _return_at-_pickup_at>interval '365 days')) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT coalesce(_browse,false) AND _operator_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT t.id,v.id,f.vehicle_slug,f.name,c.city,coalesce(c.timezone,'UTC'),
    ('https://book.exotiq.rent/'||t.slug||'/'||f.vehicle_slug)::text,true
  FROM public.teams t JOIN public.external_operator_api_settings settings ON settings.operator_id=t.id AND settings.external_api_enabled
  CROSS JOIN LATERAL public.public_team_by_slug(t.slug) c
  CROSS JOIN LATERAL public.public_team_fleet(t.slug,false) f
  JOIN public.vehicles v ON v.team_id=t.id AND v.slug=f.vehicle_slug
  WHERE public.is_marketplace_vehicle(v.id) AND (_after IS NULL OR v.id>_after)
    AND (_city IS NULL OR lower(c.city)=lower(_city))
    AND (_pickup_at IS NULL OR (coalesce(c.timezone,'UTC')=_timezone AND public.agent_inventory_available(v.id,_pickup_at,_return_at) IS TRUE))
    AND ((_operator_id IS NOT NULL AND t.id=_operator_id) OR
      (_operator_id IS NULL AND _browse AND EXISTS(SELECT 1 FROM public.public_marketplace_fleet() market WHERE market.team_slug=t.slug AND market.vehicle_slug=v.slug)))
  ORDER BY v.id LIMIT _limit;
END $$;
CREATE FUNCTION public.external_api_target(_operator_id uuid,_vehicle_id uuid)
RETURNS TABLE(operator_id uuid,vehicle_id uuid,operator_slug text,vehicle_slug text,timezone text,external_api_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT t.id,v.id,t.slug,v.slug,coalesce(c.timezone,'UTC'),true
  FROM public.teams t JOIN public.vehicles v ON v.team_id=t.id
  JOIN public.external_operator_api_settings settings ON settings.operator_id=t.id AND settings.external_api_enabled
  CROSS JOIN LATERAL public.public_team_by_slug(t.slug) c
  CROSS JOIN LATERAL public.public_team_fleet(t.slug,false) f
  WHERE t.id=_operator_id AND v.id=_vehicle_id AND f.vehicle_slug=v.slug
    AND public.is_marketplace_team(t.id) AND public.is_marketplace_vehicle(v.id)
$$;
CREATE FUNCTION public.external_resolve_customer_link(_issuer text,_subject text,_operator_id uuid)
RETURNS TABLE(customer_id uuid,operator_id uuid,verified boolean,revoked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT links.customer_id,links.operator_id,links.verified_at IS NOT NULL,links.revoked_at IS NOT NULL
  FROM public.external_customer_links links JOIN public.customers c ON c.id=links.customer_id AND c.team_id=links.operator_id
  WHERE links.issuer=_issuer AND links.subject=_subject AND links.operator_id=_operator_id
$$;
-- One SQL statement observes visibility, current opt-in/buffer, and exact shared
-- inventory under the same snapshot. Observation is never a hold or promise.
CREATE FUNCTION public.external_api_observe_availability(_operator_id uuid,_vehicle_id uuid,
  _pickup_at timestamptz,_return_at timestamptz,_timezone text)
RETURNS TABLE(available boolean,source_checked_at timestamptz,buffer_policy_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT public.agent_inventory_available(v.id,_pickup_at,_return_at),statement_timestamp(),
    ('post-return-snapshot-v1/'||coalesce(t.rental_buffer_minutes,60)::text)::text
  FROM public.external_api_target(_operator_id,_vehicle_id) target
  JOIN public.vehicles v ON v.id=target.vehicle_id AND v.team_id=target.operator_id
  JOIN public.teams t ON t.id=v.team_id
  WHERE _timezone=target.timezone AND _pickup_at IS NOT NULL AND _return_at IS NOT NULL
    AND isfinite(_pickup_at) AND isfinite(_return_at) AND _pickup_at>=statement_timestamp()
    AND _return_at>_pickup_at AND _return_at-_pickup_at<=interval '365 days'
    AND coalesce(t.rental_buffer_minutes,60) BETWEEN 0 AND 10080
$$;
REVOKE ALL ON FUNCTION public.external_catalog_operators(uuid,integer,boolean,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.external_catalog_vehicles(uuid,integer,boolean,text,uuid,timestamptz,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.external_api_target(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.external_resolve_customer_link(text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.external_api_observe_availability(uuid,uuid,timestamptz,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_catalog_operators(uuid,integer,boolean,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.external_catalog_vehicles(uuid,integer,boolean,text,uuid,timestamptz,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.external_api_target(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.external_resolve_customer_link(text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.external_api_observe_availability(uuid,uuid,timestamptz,timestamptz,text) TO service_role;
