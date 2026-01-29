-- =====================================================
-- Vehicle Photos Management System
-- Supports batch upload, AI classification, and hero photos
-- =====================================================

-- Create vehicle_photos table for multiple photos per vehicle
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Photo storage
  storage_path TEXT NOT NULL,  -- Path in Supabase storage bucket
  url TEXT NOT NULL,           -- Public or signed URL
  thumbnail_url TEXT,          -- Optional thumbnail for grid views
  
  -- Classification
  photo_type TEXT DEFAULT 'exterior' CHECK (photo_type IN (
    'hero',           -- Primary display photo (one per vehicle)
    'exterior',       -- General exterior shots
    'interior',       -- Inside the vehicle
    'detail',         -- Close-ups (wheels, badges, etc.)
    'document'        -- Registration, VIN plate, etc.
  )),
  
  -- AI-detected angle (from Vision API)
  detected_angle TEXT CHECK (detected_angle IN (
    'front', 'rear', 'left_side', 'right_side', 
    'front_quarter', 'rear_quarter', 'interior', 'detail', 'unknown'
  )),
  
  -- AI analysis results
  ai_analysis JSONB DEFAULT '{}',  -- Full analysis from Vision API
  is_vehicle_confirmed BOOLEAN DEFAULT TRUE,  -- AI confirmed it's a vehicle
  quality_score INTEGER DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_issues TEXT[],  -- Array of issues: ['too_dark', 'blurry', etc.]
  
  -- Hero photo enhancement (Phase 2)
  is_enhanced BOOLEAN DEFAULT FALSE,
  enhanced_url TEXT,           -- URL of AI-enhanced version
  enhancement_settings JSONB,  -- Background style, logo overlay, etc.
  
  -- Metadata
  original_filename TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- Ordering and display
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,  -- Can hide without deleting
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,  -- When AI analysis was run
  enhanced_at TIMESTAMPTZ   -- When hero enhancement was applied
);

-- Create photo_upload_batches table for tracking bulk uploads
CREATE TABLE IF NOT EXISTS photo_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Batch info
  batch_name TEXT,  -- Optional name like "Initial Fleet Upload"
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'import', 'cloud_sync')),
  
  -- Statistics
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  matched_files INTEGER DEFAULT 0,   -- Successfully matched to vehicles
  unmatched_files INTEGER DEFAULT 0, -- Needs manual review
  failed_files INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'review_needed', 'completed', 'failed'
  )),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create unmatched_photos table for review queue
CREATE TABLE IF NOT EXISTS unmatched_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES photo_upload_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Photo info (before it's assigned to a vehicle)
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  original_filename TEXT,
  
  -- AI suggestions
  ai_analysis JSONB DEFAULT '{}',
  suggested_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  suggestion_confidence INTEGER DEFAULT 0,
  suggested_make TEXT,
  suggested_model TEXT,
  suggested_color TEXT,
  
  -- Resolution
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Awaiting review
    'matched',     -- User matched to vehicle
    'skipped',     -- User chose to skip
    'rejected'     -- Not a valid vehicle photo
  )),
  matched_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_photos ENABLE ROW LEVEL SECURITY;

-- vehicle_photos policies
CREATE POLICY "Users can view own or team vehicle photos"
  ON vehicle_photos FOR SELECT
  USING (user_id = auth.uid() OR is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can insert own vehicle photos"
  ON vehicle_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or team vehicle photos"
  ON vehicle_photos FOR UPDATE
  USING (user_id = auth.uid() OR is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can delete own vehicle photos"
  ON vehicle_photos FOR DELETE
  USING (user_id = auth.uid());

-- photo_upload_batches policies
CREATE POLICY "Users can view own or team batches"
  ON photo_upload_batches FOR SELECT
  USING (user_id = auth.uid() OR is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can insert own batches"
  ON photo_upload_batches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own batches"
  ON photo_upload_batches FOR UPDATE
  USING (user_id = auth.uid());

-- unmatched_photos policies
CREATE POLICY "Users can view own or team unmatched photos"
  ON unmatched_photos FOR SELECT
  USING (user_id = auth.uid() OR is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can insert own unmatched photos"
  ON unmatched_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or team unmatched photos"
  ON unmatched_photos FOR UPDATE
  USING (user_id = auth.uid() OR is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can delete own unmatched photos"
  ON unmatched_photos FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_team_id ON vehicle_photos(team_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_photo_type ON vehicle_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_display_order ON vehicle_photos(vehicle_id, display_order);

CREATE INDEX IF NOT EXISTS idx_photo_batches_user_id ON photo_upload_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_batches_status ON photo_upload_batches(status);

CREATE INDEX IF NOT EXISTS idx_unmatched_photos_batch_id ON unmatched_photos(batch_id);
CREATE INDEX IF NOT EXISTS idx_unmatched_photos_status ON unmatched_photos(status);

-- =====================================================
-- Trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_vehicle_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vehicle_photos_updated_at
  BEFORE UPDATE ON vehicle_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_photos_updated_at();

-- =====================================================
-- Ensure only one hero photo per vehicle
-- =====================================================

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
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_hero
  BEFORE INSERT OR UPDATE ON vehicle_photos
  FOR EACH ROW
  WHEN (NEW.photo_type = 'hero')
  EXECUTE FUNCTION ensure_single_hero_photo();

-- =====================================================
-- View for easy photo queries with vehicle info
-- =====================================================

CREATE OR REPLACE VIEW vehicle_photos_with_vehicle AS
SELECT 
  vp.*,
  v.name AS vehicle_name,
  v.make AS vehicle_make,
  v.model AS vehicle_model,
  v.year AS vehicle_year,
  v.license_plate AS vehicle_plate
FROM vehicle_photos vp
JOIN vehicles v ON vp.vehicle_id = v.id;

-- =====================================================
-- Function to get hero photo URL for a vehicle
-- =====================================================

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
$$ LANGUAGE plpgsql STABLE;