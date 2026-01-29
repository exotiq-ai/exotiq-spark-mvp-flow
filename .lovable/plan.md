
# Photo Hub Integration Fix Plan

## ✅ COMPLETED

### Step 1: Edge Function Import - DONE
- Fixed `send-deletion-confirmation/index.ts` to use `esm.sh` pattern

### Step 2: Database Migration - DONE
- Created `vehicle_photos` table
- Created `photo_upload_batches` table
- Created `unmatched_photos` table
- All RLS policies applied
- Indexes created
- Triggers and functions created with proper search_path

### Step 3: Security Fixes - DONE
- Fixed view security (INVOKER instead of DEFINER)
- Fixed function search_path settings

---

## Remaining Tasks

### Types Regeneration
The types file will auto-regenerate on next build with the new tables.

### Questions Pending User Response
1. **Google Vision API Key**: Is `GOOGLE_VISION_API_KEY` configured?
2. **Photo Hub Route**: Separate route (`/fleet/photos`) or tab within Fleet page?
3. **Photo Coverage Indicator**: Show photo count on vehicle cards (e.g., "8/11 photos")?

---

## Next Steps After User Answers
1. Add "Photos" tab to Fleet module navigation
2. Create PhotoHubPage component with stats, upload, and review queue
3. Integrate VehiclePhotoManager into Vehicle Detail page
4. Update VehicleCard to use `get_vehicle_hero_photo()` for thumbnails
