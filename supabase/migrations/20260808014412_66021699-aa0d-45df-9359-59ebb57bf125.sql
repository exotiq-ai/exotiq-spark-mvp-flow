update public.vehicles v
set image_url = null
where v.id = 'bbbe73aa-c0a6-49d7-a684-e7e46fcb27d9'
  and exists (
    select 1 from public.vehicle_photos p
    where p.vehicle_id = v.id and p.created_at >= '2026-08-08 01:35'
      and v.image_url = p.url
  );

delete from public.vehicle_photos
where vehicle_id = 'bbbe73aa-c0a6-49d7-a684-e7e46fcb27d9'
  and created_at >= '2026-08-08 01:35';