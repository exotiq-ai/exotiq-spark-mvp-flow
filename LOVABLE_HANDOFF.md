# Lovable Handoff: Guided Inspection Feature

This document contains copy/paste prompts for Lovable to complete the database setup for the new guided inspection feature.

---

## PROJECT CONTEXT (Paste First)

Copy this entire block and paste it into Lovable to set context before making requests:

---

```
# Project Context: EXOTIQ Fleet Management Platform

## What This App Is
EXOTIQ is a premium fleet management platform for exotic car rental businesses. It manages:
- Vehicle fleet (exotic/luxury cars and SUVs)
- Bookings and reservations
- Customer management
- Multi-location operations
- Team members with role-based access (owner, admin, manager, operator, viewer)
- Vehicle inspections and damage claims
- Payments and financial tracking
- Internal team messaging

## Tech Stack
- Frontend: React 18.3 + TypeScript + Vite 5.4
- UI: shadcn/ui + Tailwind CSS 3.4 + Radix primitives
- State: TanStack Query 5.56 + React Context
- Backend: Supabase (PostgreSQL + Auth + Storage + RLS)
- Routing: React Router DOM 6.26
- Forms: React Hook Form 7.53 + Zod validation
- Animation: Framer Motion 12.23
- AI: Rari AI assistant integration

## Current Database Tables (relevant to this feature)
- vehicles - Fleet inventory
- bookings - Rental reservations  
- customers - Customer records
- vehicle_inspections - Inspection records (being extended)
- inspection_photos - Photos attached to inspections (being extended)
- damage_claims - Damage reports linked to inspections
- profiles - User accounts
- teams - Multi-tenant organizations

## What We're Building
A guided vehicle inspection feature for staff check-in/check-out workflows. This includes:
1. AR-like guided photo capture (11 angles with corner bracket overlays)
2. Free-form damage documentation with type/location/severity
3. Checklist form (odometer, fuel, keys, cleanliness, conditions)
4. Integration with existing booking flow

## Code Already Written (in local IDE)
Components have been built in src/components/inspections/:
- InspectionWidget.tsx - Main entry point widget
- GuidedCaptureWizard.tsx - Multi-step photo capture flow
- CameraViewfinder.tsx - Camera with corner brackets overlay
- DamageCaptureModal.tsx - Damage documentation modal
- InspectionChecklistForm.tsx - Checklist form
- types.ts - TypeScript types and configs

## What We Need From You (Lovable)
Database migrations and type generation - the frontend code is ready but needs the schema updated.
```

---

## STEP 1: Apply Database Migration

Copy and paste this entire prompt into Lovable:

---

**PROMPT FOR LOVABLE:**

```
I need you to run a database migration for the guided inspection feature. This is extending existing tables, not replacing them.

IMPORTANT: 
- Do NOT modify any existing frontend components
- Do NOT create new React components (they already exist locally)
- ONLY run the SQL and regenerate types

Here's exactly what needs to happen:

1. Run this SQL migration (use IF NOT EXISTS to be safe):

---SQL START---

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

---SQL END---

2. After the SQL runs successfully, regenerate the TypeScript types at src/integrations/supabase/types.ts

3. Confirm what was added:
   - vehicle_inspections: 14 new columns
   - inspection_photos: 4 new columns  
   - inspection_damage_items: new table with 9 columns
   - 4 RLS policies on inspection_damage_items
   - 4 indexes

Do NOT create any React components or modify any .tsx files.
```

---

## STEP 2: Storage Bucket - SKIP THIS STEP

**No action needed.** The existing `vehicle-photos` bucket will be used. 

The InspectionWidget has been updated to use `vehicle-photos` instead of creating a new bucket.

---

## STEP 3: Verify Completion

After Lovable completes steps 1-2, ask it to confirm:

---

**PROMPT FOR LOVABLE:**

```
Please confirm the inspection feature database setup is complete:

1. Does inspection_damage_items table exist with these columns?
   - id, inspection_id, photo_url, damage_type, vehicle_location, severity, notes, quality_warning, created_at

2. Does vehicle_inspections have these NEW columns?
   - inspection_direction, status, started_at, completed_at, location_lat, location_lng, device_info, keys_count, cleanliness_rating, report_url, report_web_url, reviewed_by, reviewed_at, signature_url

3. Does inspection_photos have these NEW columns?
   - photo_role, quality_warning, skipped, captured_at

4. Does the "inspection-photos" storage bucket exist?

5. Were the TypeScript types regenerated in src/integrations/supabase/types.ts?

List any issues found.
```

---

## What to Check in TypeScript Types

After Lovable completes the migration, the `src/integrations/supabase/types.ts` file should include:

### New table: `inspection_damage_items`
```typescript
inspection_damage_items: {
  Row: {
    id: string
    inspection_id: string
    photo_url: string
    damage_type: string
    vehicle_location: string
    severity: string | null
    notes: string | null
    quality_warning: boolean | null
    created_at: string | null
  }
  // ... Insert and Update types
}
```

### New columns on `vehicle_inspections`
- `inspection_direction`
- `status`
- `started_at`
- `completed_at`
- `location_lat`
- `location_lng`
- `device_info`
- `keys_count`
- `cleanliness_rating`
- `report_url`
- `report_web_url`
- `reviewed_by`
- `reviewed_at`
- `signature_url`

### New columns on `inspection_photos`
- `photo_role`
- `quality_warning`
- `skipped`
- `captured_at`

---

## STEP 4: Pull Changes & Continue with Claude

After Lovable confirms completion:

```bash
git pull origin main
```

Then come back to Claude (Cursor) and say:

> "Lovable completed the database migration and storage bucket. Types are updated. Ready to continue."

---

## Reference: What's Already Built Locally

These components exist in your local repo (built by Claude in Cursor):

| File | Purpose |
|------|---------|
| `src/components/inspections/InspectionWidget.tsx` | Main entry point widget |
| `src/components/inspections/GuidedCaptureWizard.tsx` | Multi-step photo capture flow |
| `src/components/inspections/CameraViewfinder.tsx` | Camera with corner brackets + branding |
| `src/components/inspections/DamageCaptureModal.tsx` | Damage photo capture with type/location |
| `src/components/inspections/InspectionChecklistForm.tsx` | Checklist form (odometer, fuel, etc.) |
| `src/components/inspections/types.ts` | TypeScript types and configs |
| `src/components/inspections/index.ts` | Barrel export file |
| `supabase/migrations/20260128000000_guided_inspections.sql` | Migration file (reference) |

**DO NOT ask Lovable to create or modify these files** - they're managed locally.

---

## Next Steps After Database Setup

1. ✅ Database migration applied (Lovable)
2. ✅ Storage bucket created (Lovable)  
3. ✅ Types regenerated (Lovable)
4. ⬜ Pull changes locally
5. ⬜ Remove type assertions from InspectionWidget (Claude)
6. ⬜ Integrate widget into booking detail page (Claude)
7. ⬜ Test full flow
8. ⬜ Add inspection history to vehicle detail page (Claude)

---

## Checklist

Before continuing, confirm with Lovable:
- [ ] SQL migration ran without errors
- [ ] inspection_damage_items table created
- [ ] New columns added to vehicle_inspections
- [ ] New columns added to inspection_photos
- [ ] Storage bucket "inspection-photos" created
- [ ] TypeScript types regenerated
- [ ] Changes committed to repo
