ALTER TABLE public.vehicle_photos DROP CONSTRAINT IF EXISTS vehicle_photos_source_check;
ALTER TABLE public.vehicle_photos ADD CONSTRAINT vehicle_photos_source_check
  CHECK (source = ANY (ARRAY['uploaded','generated','enhanced','studio_render']));