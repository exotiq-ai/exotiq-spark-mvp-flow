

# One-Time: Set Hero Photos for Existing Vehicles

## What This Does
For every vehicle in your account that has photos but **no** hero photo, the earliest-uploaded photo will be promoted to `photo_type = 'hero'`.

## How
A single SQL UPDATE using a subquery — no schema changes, no code changes. Uses the data insert tool to run:

```sql
UPDATE vehicle_photos
SET photo_type = 'hero', updated_at = now()
WHERE id IN (
  SELECT DISTINCT ON (vehicle_id) id
  FROM vehicle_photos
  WHERE vehicle_id NOT IN (
    SELECT vehicle_id FROM vehicle_photos WHERE photo_type = 'hero'
  )
  ORDER BY vehicle_id, display_order ASC, created_at ASC
);
```

This picks the first photo per vehicle (by display order, then upload date) and sets it as hero — only for vehicles that don't already have one. One-time operation, no code changes needed. The existing auto-hero logic stays intact for future uploads.

