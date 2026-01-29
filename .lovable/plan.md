
# Photo Hub Integration Fix Plan

## Issue Summary

There are **3 critical build errors** that need to be addressed:

1. **Edge Function Import Error**: `send-deletion-confirmation/index.ts` uses `npm:resend@2.0.0` but the Deno environment requires the `esm.sh` pattern used elsewhere (already fixed in `rari-email-summary`)

2. **Missing Database Tables**: The `vehicle_photos`, `unmatched_photos`, and `photo_upload_batches` tables haven't been created yet - the migration file exists at `supabase/migrations/20260129000000_vehicle_photos.sql` but was never applied

3. **TypeScript Compilation Errors**: The `usePhotoAnalysis.ts` hook references tables that don't exist in the generated types, causing ~20+ type errors

---

## Root Cause Analysis

The handoff document (`LOVABLE_PHOTO_HUB_HANDOFF.md`) outlines a Photo Hub feature that requires:
- 3 new database tables (`vehicle_photos`, `unmatched_photos`, `photo_upload_batches`)
- 2 edge functions (`analyze-vehicle-photo`, `enhance-hero-photo`) - these already exist
- Frontend components - already built in `src/components/photos/`

**However**, the database migration was never executed. The code references tables that don't exist, causing the build to fail.

---

## Fix Strategy

### Step 1: Fix Edge Function Import (Immediate)

**File:** `supabase/functions/send-deletion-confirmation/index.ts`

Change line 3:
```typescript
// From:
import { Resend } from "npm:resend@2.0.0";

// To:
import { Resend } from 'https://esm.sh/resend@4.0.0';
```

This matches the pattern already used in `rari-email-summary/index.ts`.

---

### Step 2: Apply Database Migration

Run the SQL migration from `supabase/migrations/20260129000000_vehicle_photos.sql` which creates:

**Tables:**
- `vehicle_photos` - Main table for all vehicle photos with columns for storage, classification, AI analysis, hero enhancement, and metadata
- `photo_upload_batches` - Tracks bulk upload jobs
- `unmatched_photos` - Queue for photos needing manual review

**RLS Policies:**
- Team-based access using existing `is_team_member_of_record()` function
- User ownership checks for inserts and deletes

**Triggers:**
- `vehicle_photos_updated_at` - Auto-updates `updated_at` column
- `ensure_single_hero` - Enforces one hero photo per vehicle

**Views & Functions:**
- `vehicle_photos_with_vehicle` - Join view with vehicle info
- `get_vehicle_hero_photo()` - Helper to get hero photo URL

---

### Step 3: Regenerate TypeScript Types

After the migration runs, the types file at `src/integrations/supabase/types.ts` must be regenerated to include:
- `vehicle_photos` table type
- `unmatched_photos` table type  
- `photo_upload_batches` table type

This will resolve all ~20 TypeScript errors in `usePhotoAnalysis.ts`.

---

### Step 4: Code Cleanup in usePhotoAnalysis.ts

After types are regenerated, remove the `as any` type assertions that were added as workarounds:
- Line 98, 106: Remove `as any` from insert objects
- Line 123, 127: Remove `as any` from insert objects
- Line 194, 202, 216, 220: Remove `as any` from insert objects
- Line 285, 292, 306, 318, 360: Remove `as any` from update/select objects

---

## Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/send-deletion-confirmation/index.ts` | Fix Resend import |
| Database | Run migration from `20260129000000_vehicle_photos.sql` |
| `src/integrations/supabase/types.ts` | Auto-regenerate after migration |
| `src/components/photos/usePhotoAnalysis.ts` | Remove `as any` assertions after types exist |

---

## Verification Checklist

After fixes:
- [ ] Build completes without errors
- [ ] Edge functions deploy successfully
- [ ] `vehicle_photos` table exists in database
- [ ] `unmatched_photos` table exists in database
- [ ] `photo_upload_batches` table exists in database
- [ ] Types file includes new table definitions
- [ ] Photo Hub can be added to Fleet module

---

## Questions/Clarifications Needed

1. **Google Vision API Key**: The handoff mentions `GOOGLE_VISION_API_KEY` needs to be added as a secret. Is this already configured? (I don't see it in the secrets list)

2. **Photo Hub Route**: Should this be a separate route (`/fleet/photos`) or a tab within the existing Fleet page?

3. **Photo Coverage Indicator**: Should vehicle cards show a photo count (e.g., "8/11 photos")?

---

## Next Steps After This Fix

Once the database and types are in place:
1. Add "Photos" tab to Fleet module navigation
2. Create PhotoHubPage component with stats, upload, and review queue
3. Integrate VehiclePhotoManager into Vehicle Detail page
4. Update VehicleCard to use `get_vehicle_hero_photo()` for thumbnails
