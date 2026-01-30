-- Create trigger to sync hero photo URL to vehicles.image_url
CREATE OR REPLACE FUNCTION public.sync_hero_to_vehicle()
RETURNS TRIGGER AS $$
BEGIN
  -- When a photo is set as hero, update the vehicle's image_url
  IF NEW.photo_type = 'hero' THEN
    UPDATE public.vehicles 
    SET image_url = COALESCE(NEW.enhanced_url, NEW.url),
        updated_at = NOW()
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS sync_hero_photo_to_vehicle ON public.vehicle_photos;
CREATE TRIGGER sync_hero_photo_to_vehicle
  AFTER INSERT OR UPDATE OF photo_type, enhanced_url
  ON public.vehicle_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_hero_to_vehicle();