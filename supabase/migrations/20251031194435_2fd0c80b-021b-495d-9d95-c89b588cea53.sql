-- Create storage bucket for vehicle photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- RLS policies for vehicle-photos bucket
CREATE POLICY "Users can view all vehicle photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Users can upload their own vehicle photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own vehicle photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own vehicle photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable realtime for key tables
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE damage_claims REPLICA IDENTITY FULL;
ALTER TABLE customers REPLICA IDENTITY FULL;
ALTER TABLE vehicle_inspections REPLICA IDENTITY FULL;