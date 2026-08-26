UPDATE public.vehicle_photos SET is_visible = true WHERE is_visible IS NULL;
UPDATE public.vehicle_photos SET is_vehicle_confirmed = true WHERE is_vehicle_confirmed IS NULL;

ALTER TABLE public.vehicle_photos
  ALTER COLUMN is_visible SET DEFAULT true,
  ALTER COLUMN is_visible SET NOT NULL,
  ALTER COLUMN is_vehicle_confirmed SET DEFAULT true,
  ALTER COLUMN is_vehicle_confirmed SET NOT NULL;

-- Repo/production parity: the vehicle-photos bucket is PUBLIC for reads.
-- Migration 20251031232021 last set it private; the hosted flag was flipped
-- outside migrations and stored URLs now rely on the /object/public/ form.
-- Writes stay restricted to authenticated team members by the storage.objects
-- policies from 20260715211500, which are intentionally left untouched.
COMMENT ON TABLE public.vehicle_photos IS
  'Vehicle photo library. Stored url/thumbnail_url MUST be stable public URLs derived from storage_path (bucket vehicle-photos is public for reads); never persist signed URLs — they expire.';
