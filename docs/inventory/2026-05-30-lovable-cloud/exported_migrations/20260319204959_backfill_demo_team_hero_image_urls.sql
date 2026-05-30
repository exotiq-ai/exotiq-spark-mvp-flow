-- Exported 2026-05-30 from live DB (supabase_migrations.schema_migrations version=20260319204959).
-- Applied directly via the migration tool; was previously not committed to supabase/migrations/.
-- Stored HERE (not in supabase/migrations/) because the Lovable migration system refuses
-- direct file creation under supabase/migrations/. Before any cutover to a new project, move
-- this file to supabase/migrations/20260319204959_backfill_demo_team_hero_image_urls.sql.
--
-- One-shot demo-data backfill — idempotent (WHERE excludes vehicles that already have image_url).

UPDATE vehicles v
SET image_url = vp.url
FROM vehicle_photos vp
WHERE vp.vehicle_id = v.id
  AND vp.photo_type = 'hero'
  AND v.team_id = '30a0f30f-66e6-4909-ba28-d935b82f146e'
  AND (v.image_url IS NULL OR v.image_url = '');
