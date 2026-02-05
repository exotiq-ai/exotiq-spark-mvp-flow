-- Add source column to distinguish uploaded vs generated photos
ALTER TABLE vehicle_photos 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'uploaded' 
CHECK (source IN ('uploaded', 'generated', 'enhanced'));

-- Add generation metadata
ALTER TABLE vehicle_photos 
ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

-- Index for quick lookup of generated heroes
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_generated 
ON vehicle_photos (vehicle_id, source) 
WHERE source = 'generated';