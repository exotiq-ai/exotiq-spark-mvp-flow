-- =====================================================
-- Fix Security Linter Issues for Photo Hub Tables
-- =====================================================

-- Fix 1: Change view from SECURITY DEFINER to SECURITY INVOKER
DROP VIEW IF EXISTS vehicle_photos_with_vehicle;

CREATE VIEW vehicle_photos_with_vehicle
WITH (security_invoker = true)
AS
SELECT 
  vp.*,
  v.name AS vehicle_name,
  v.make AS vehicle_make,
  v.model AS vehicle_model,
  v.year AS vehicle_year,
  v.license_plate AS vehicle_plate
FROM vehicle_photos vp
JOIN vehicles v ON vp.vehicle_id = v.id;

-- Fix 2: Update functions with proper search_path
CREATE OR REPLACE FUNCTION update_vehicle_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION ensure_single_hero_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a photo as hero, unset any existing hero for this vehicle
  IF NEW.photo_type = 'hero' THEN
    UPDATE vehicle_photos 
    SET photo_type = 'exterior' 
    WHERE vehicle_id = NEW.vehicle_id 
      AND photo_type = 'hero' 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION get_vehicle_hero_photo(p_vehicle_id UUID)
RETURNS TEXT AS $$
DECLARE
  hero_url TEXT;
BEGIN
  -- First try to get enhanced hero, then regular hero, then first photo
  SELECT COALESCE(enhanced_url, url) INTO hero_url
  FROM vehicle_photos
  WHERE vehicle_id = p_vehicle_id 
    AND photo_type = 'hero'
    AND is_visible = TRUE
  LIMIT 1;
  
  -- Fallback to first visible photo if no hero
  IF hero_url IS NULL THEN
    SELECT url INTO hero_url
    FROM vehicle_photos
    WHERE vehicle_id = p_vehicle_id 
      AND is_visible = TRUE
    ORDER BY display_order ASC, created_at ASC
    LIMIT 1;
  END IF;
  
  RETURN hero_url;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;