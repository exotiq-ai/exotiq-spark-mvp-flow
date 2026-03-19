
UPDATE vehicles v
SET image_url = vp.url
FROM vehicle_photos vp
WHERE vp.vehicle_id = v.id
  AND vp.photo_type = 'hero'
  AND v.team_id = '30a0f30f-66e6-4909-ba28-d935b82f146e'
  AND (v.image_url IS NULL OR v.image_url = '');
