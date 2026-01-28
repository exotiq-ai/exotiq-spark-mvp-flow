-- Guided Inspection System Enhancement
-- Adds support for AR-like guided photo capture workflow

-- Extend vehicle_inspections table with new columns for guided workflow
ALTER TABLE vehicle_inspections 
ADD COLUMN IF NOT EXISTS inspection_direction TEXT CHECK (inspection_direction IN ('check_in', 'check_out')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'reviewed')),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS device_info JSONB,
ADD COLUMN IF NOT EXISTS keys_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER CHECK (cleanliness_rating IS NULL OR (cleanliness_rating >= 1 AND cleanliness_rating <= 5)),
ADD COLUMN IF NOT EXISTS report_url TEXT,
ADD COLUMN IF NOT EXISTS report_web_url TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Extend inspection_photos table for guided capture
ALTER TABLE inspection_photos
ADD COLUMN IF NOT EXISTS photo_role TEXT,
ADD COLUMN IF NOT EXISTS quality_warning BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NOW();

-- Create inspection damage items table for free-form damage documentation
CREATE TABLE IF NOT EXISTS inspection_damage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  damage_type TEXT NOT NULL CHECK (damage_type IN (
    'scratch', 'dent', 'chip', 'crack', 'scuff', 
    'stain', 'tear', 'missing_part', 'mechanical', 'other'
  )),
  vehicle_location TEXT NOT NULL CHECK (vehicle_location IN (
    'front_bumper', 'rear_bumper', 'hood', 'roof', 'trunk',
    'front_left_fender', 'front_right_fender', 'rear_left_quarter', 'rear_right_quarter',
    'left_door_front', 'left_door_rear', 'right_door_front', 'right_door_rear',
    'left_mirror', 'right_mirror', 'windshield', 'rear_window',
    'left_front_wheel', 'left_rear_wheel', 'right_front_wheel', 'right_rear_wheel',
    'headlight_left', 'headlight_right', 'taillight_left', 'taillight_right',
    'dashboard', 'steering_wheel', 'center_console', 'seats_front', 'seats_rear',
    'carpet_floor', 'door_panel_left', 'door_panel_right', 'other'
  )),
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'major')),
  notes TEXT,
  quality_warning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on inspection_damage_items
ALTER TABLE inspection_damage_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inspection_damage_items table (with team-based access)
CREATE POLICY "Users can view own or team inspection damage items" ON inspection_damage_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicle_inspections vi
    WHERE vi.id = inspection_damage_items.inspection_id 
    AND (vi.user_id = auth.uid() OR is_team_member_of_record(auth.uid(), vi.team_id))
  )
);
CREATE POLICY "Users can insert own or team inspection damage items" ON inspection_damage_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicle_inspections vi
    WHERE vi.id = inspection_damage_items.inspection_id 
    AND (vi.user_id = auth.uid() OR is_team_member_of_record(auth.uid(), vi.team_id))
  )
);
CREATE POLICY "Users can update own or team inspection damage items" ON inspection_damage_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM vehicle_inspections vi
    WHERE vi.id = inspection_damage_items.inspection_id 
    AND (vi.user_id = auth.uid() OR is_team_member_of_record(auth.uid(), vi.team_id))
  )
);
CREATE POLICY "Users can delete own or team inspection damage items" ON inspection_damage_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM vehicle_inspections vi
    WHERE vi.id = inspection_damage_items.inspection_id 
    AND (vi.user_id = auth.uid() OR is_team_member_of_record(auth.uid(), vi.team_id))
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inspection_damage_items_inspection_id ON inspection_damage_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_status ON vehicle_inspections(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_direction ON vehicle_inspections(inspection_direction);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_role ON inspection_photos(photo_role);

-- Create a view for inspection summary (useful for reports)
CREATE OR REPLACE VIEW inspection_summary AS
SELECT 
  vi.id,
  vi.vehicle_id,
  vi.booking_id,
  vi.inspection_type,
  vi.inspection_direction,
  vi.status,
  vi.odometer_reading,
  vi.fuel_level,
  vi.keys_count,
  vi.cleanliness_rating,
  vi.exterior_condition,
  vi.interior_condition,
  vi.tire_condition,
  vi.started_at,
  vi.completed_at,
  vi.created_at,
  v.make,
  v.model,
  v.year,
  v.license_plate,
  v.vin,
  (SELECT COUNT(*) FROM inspection_photos ip WHERE ip.inspection_id = vi.id AND ip.skipped = false) as photo_count,
  (SELECT COUNT(*) FROM inspection_damage_items idi WHERE idi.inspection_id = vi.id) as damage_count
FROM vehicle_inspections vi
LEFT JOIN vehicles v ON vi.vehicle_id = v.id;

-- Add comment for documentation
COMMENT ON TABLE inspection_damage_items IS 'Stores individual damage items documented during vehicle inspections with type, location, and severity';
COMMENT ON COLUMN vehicle_inspections.inspection_direction IS 'Whether this is a check_in (vehicle arriving) or check_out (vehicle departing) inspection';
COMMENT ON COLUMN vehicle_inspections.status IS 'Inspection workflow status: draft -> in_progress -> completed -> reviewed';
COMMENT ON COLUMN inspection_photos.photo_role IS 'The guided capture role: front, rear, left_side, right_side, front_left_quarter, etc.';
