-- Make vehicle-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'vehicle-photos';

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Users can view all vehicle photos" ON storage.objects;

-- Create new RLS policy that requires authentication and user ownership
CREATE POLICY "Users can view own vehicle photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);