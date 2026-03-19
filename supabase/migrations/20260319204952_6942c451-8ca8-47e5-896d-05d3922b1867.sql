
UPDATE vehicle_photos
SET photo_type = 'hero'
WHERE id IN (
  SELECT DISTINCT ON (vp.vehicle_id) vp.id
  FROM vehicle_photos vp
  JOIN vehicles v ON v.id = vp.vehicle_id
  WHERE v.team_id = '30a0f30f-66e6-4909-ba28-d935b82f146e'
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_photos vp2 
      WHERE vp2.vehicle_id = vp.vehicle_id AND vp2.photo_type = 'hero'
    )
  ORDER BY vp.vehicle_id, vp.created_at ASC
);
