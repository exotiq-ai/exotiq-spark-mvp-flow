CREATE OR REPLACE FUNCTION public.public_vehicle_availability(_team_slug text, _vehicle_slug text, _range_start date, _range_end date)
 RETURNS TABLE(busy_start date, busy_end date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT v.id AS vehicle_id, coalesce(t.rental_buffer_minutes, 60) AS buffer_minutes
    FROM public.vehicles v
    JOIN public.teams t ON t.id = v.team_id
    WHERE t.slug = _team_slug
      AND v.slug = _vehicle_slug
      AND public.is_marketplace_vehicle(v.id)
  )
  SELECT (b.start_date - make_interval(mins => tg.buffer_minutes))::date AS busy_start,
         GREATEST(
           (b.start_date - make_interval(mins => tg.buffer_minutes))::date,
           (b.end_date - interval '1 day')::date
         ) AS busy_end
  FROM public.bookings b
  JOIN target tg ON tg.vehicle_id = b.vehicle_id
  WHERE b.status IN ('requested', 'pending_documents', 'pending_payment', 'pending', 'confirmed', 'active')
    AND coalesce(b.is_historical, false) = false
    AND b.end_date >= _range_start::timestamptz
    AND b.start_date <= LEAST(_range_end, _range_start + interval '1 year')::timestamptz
  ORDER BY 1
$function$;