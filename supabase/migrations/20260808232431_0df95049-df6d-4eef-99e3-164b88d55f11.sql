UPDATE public.bookings b
SET vehicle_name = trim(both ' ' from coalesce(v.name, concat_ws(' ', v.year::text, v.make, v.model)))
FROM public.vehicles v
WHERE v.id = b.vehicle_id
  AND nullif(trim(b.vehicle_name), '') IS NULL
  AND nullif(trim(coalesce(v.name, concat_ws(' ', v.year::text, v.make, v.model))), '') IS NOT NULL;