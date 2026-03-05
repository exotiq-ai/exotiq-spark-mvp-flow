# Lovable Handoff: Photo Hub & Vehicle Photo Management

## Overview

We're building a Photo Hub for fleet operators to:
1. Bulk upload vehicle photos
2. AI-classify and organize photos automatically
3. Match photos to vehicles
4. Set hero photos for premium display

## Step 1: Add Supabase Secrets

Before running migrations, add these secrets in Lovable's Supabase settings:

```
GOOGLE_VISION_API_KEY = [User will provide this]
PHOTOROOM_API_KEY = [User will provide this - for hero photo enhancement]
```

The Google Vision API key is from GCP project `fine-program-464718-e2`.
The Photoroom API key is from photoroom.com (sandbox/free tier is fine).

## Step 2: Run Database Migration

Run the migration at `supabase/migrations/20260129000000_vehicle_photos.sql`

This creates:
- `vehicle_photos` - Main table for all vehicle photos
- `photo_upload_batches` - Tracks bulk upload jobs
- `unmatched_photos` - Queue for photos needing manual review
- RLS policies with team-based access
- Trigger to ensure only one hero photo per vehicle
- Helper function `get_vehicle_hero_photo(vehicle_id)`

## Step 3: Deploy Edge Functions

Deploy these Edge Functions:

### 3a. `analyze-vehicle-photo`
Location: `supabase/functions/analyze-vehicle-photo/`

This function:
- Accepts an image URL or base64 data
- Calls Google Cloud Vision API
- Returns: isVehicle, angle classification, quality score, suggested make/color

### 3b. `enhance-hero-photo` — **SUNSET / REMOVED**
~~This function used PhotoRoom API for background removal. It has been removed as of March 2026.~~
Database columns (`enhanced_url`, `is_enhanced`, `enhanced_at`, `enhancement_settings`) remain in the schema but are no longer written to.

## Step 4: Build Photo Hub UI

### Location
Create a new tab in the Fleet module: **Fleet → Photos**

Route: `/fleet/photos` (or integrate into existing Fleet page as a tab)

### Design Requirements

Follow existing EXOTIQ design patterns:
- Use `card-premium` class for cards
- Use existing color tokens (primary, secondary, muted)
- Icons from Lucide React
- Consistent with existing Fleet and Bookings UI

### Components to Build

#### 4.1 PhotoHubPage (`src/pages/PhotoHub.tsx`)

Main page with three sections:

```tsx
// Layout structure
<div className="space-y-6">
  {/* Stats Row */}
  <div className="grid grid-cols-4 gap-4">
    <StatCard icon={Image} label="Total Photos" value={stats.total} />
    <StatCard icon={Car} label="Vehicles with Photos" value={stats.vehiclesWithPhotos} />
    <StatCard icon={AlertCircle} label="Needs Review" value={stats.unmatched} color="warning" />
    <StatCard icon={Sparkles} label="Hero Photos" value={stats.heroCount} />
  </div>

  {/* Action Cards */}
  <div className="grid grid-cols-2 gap-4">
    <UploadCard onUpload={handleBulkUpload} />
    <ReviewQueueCard count={unmatched.length} onClick={goToReview} />
  </div>

  {/* Photo Grid - All vehicles */}
  <VehiclePhotoGrid vehicles={vehicles} />
</div>
```

#### 4.2 BulkUploadModal (`src/components/photos/BulkUploadModal.tsx`)

Dialog for uploading multiple photos:

```tsx
interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (batchId: string) => void;
}

// Features:
// - Drag and drop zone (use existing FileUploadZone pattern)
// - Accept: image/jpeg, image/png, image/webp, image/heic
// - Max file size: 10MB per file
// - Show upload progress for each file
// - After upload, trigger AI analysis for each photo
// - Smart matching: try to match by filename pattern first
//   Pattern: {vehicleName}-{angle}.jpg or {VIN}-{angle}.jpg
// - Unmatched photos go to review queue
```

#### 4.3 PhotoReviewQueue (`src/components/photos/PhotoReviewQueue.tsx`)

Review interface for unmatched photos:

```tsx
// Layout: Side-by-side
// Left: Large photo preview with AI analysis overlay
// Right: Vehicle selector dropdown + AI suggestions

// For each unmatched photo, show:
// - The photo (large)
// - AI detected info: "Looks like a front view of a red sports car"
// - Confidence: 75%
// - Suggested vehicle (if any)
// - Vehicle dropdown to manually assign
// - Actions: [Assign to Vehicle] [Skip] [Reject (not a car)]
```

#### 4.4 VehiclePhotoManager (`src/components/photos/VehiclePhotoManager.tsx`)

Per-vehicle photo management (also accessible from Vehicle Detail page):

```tsx
interface VehiclePhotoManagerProps {
  vehicleId: string;
  vehicleName: string;
}

// Features:
// - Grid of all photos for this vehicle
// - Drag to reorder (updates display_order)
// - Click photo to view full size
// - Set as Hero button (one per vehicle)
// - Delete button
// - Add more photos button
// - Show photo type badges (hero, exterior, interior, detail)
```

#### 4.5 PhotoCard (`src/components/photos/PhotoCard.tsx`)

Reusable photo card component:

```tsx
interface PhotoCardProps {
  photo: VehiclePhoto;
  onSetHero?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  showVehicleInfo?: boolean;
  selectable?: boolean;
}

// Display:
// - Thumbnail with aspect ratio preserved
// - Type badge in corner (Hero = gold star, Interior = seat icon, etc.)
// - Quality indicator if issues (yellow warning dot)
// - Hover: show actions overlay
```

### Data Fetching

Use TanStack Query for all data fetching:

```tsx
// Get all photos for a vehicle
const { data: photos } = useQuery({
  queryKey: ['vehicle-photos', vehicleId],
  queryFn: () => supabase
    .from('vehicle_photos')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('is_visible', true)
    .order('display_order', { ascending: true })
});

// Get unmatched photos for review
const { data: unmatched } = useQuery({
  queryKey: ['unmatched-photos'],
  queryFn: () => supabase
    .from('unmatched_photos')
    .select('*, suggested_vehicle:vehicles(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
});

// Get photo stats
const { data: stats } = useQuery({
  queryKey: ['photo-stats'],
  queryFn: async () => {
    const [total, heroCount, unmatched] = await Promise.all([
      supabase.from('vehicle_photos').select('id', { count: 'exact' }),
      supabase.from('vehicle_photos').select('id', { count: 'exact' }).eq('photo_type', 'hero'),
      supabase.from('unmatched_photos').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);
    return {
      total: total.count || 0,
      heroCount: heroCount.count || 0,
      unmatched: unmatched.count || 0
    };
  }
});
```

### Photo Upload Flow

```tsx
async function uploadAndAnalyzePhoto(file: File, vehicleId?: string) {
  const user = auth.user;
  const team = currentTeam;
  
  // 1. Upload to Supabase Storage
  const path = `${user.id}/vehicles/${vehicleId || 'unmatched'}/${Date.now()}-${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('vehicle-photos')
    .upload(path, file);
  
  if (uploadError) throw uploadError;
  
  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('vehicle-photos')
    .getPublicUrl(path);
  
  // 3. Call AI analysis
  const { data: analysis } = await supabase.functions.invoke('analyze-vehicle-photo', {
    body: { imageUrl: urlData.publicUrl, filename: file.name }
  });
  
  // 4. If vehicle matched, insert to vehicle_photos
  if (vehicleId && analysis.isVehicle) {
    await supabase.from('vehicle_photos').insert({
      vehicle_id: vehicleId,
      user_id: user.id,
      team_id: team?.id,
      storage_path: path,
      url: urlData.publicUrl,
      photo_type: 'exterior',
      detected_angle: analysis.angle,
      ai_analysis: analysis,
      is_vehicle_confirmed: analysis.isVehicle,
      quality_score: analysis.quality.score,
      quality_issues: analysis.quality.issues,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      analyzed_at: new Date().toISOString()
    });
  } else {
    // 5. Otherwise, add to unmatched queue
    await supabase.from('unmatched_photos').insert({
      user_id: user.id,
      team_id: team?.id,
      storage_path: path,
      url: urlData.publicUrl,
      original_filename: file.name,
      ai_analysis: analysis,
      suggested_make: analysis.suggestedVehicleMatch?.make,
      suggested_color: analysis.suggestedVehicleMatch?.color,
      suggestion_confidence: analysis.confidence
    });
  }
  
  return { path, url: urlData.publicUrl, analysis };
}
```

### Integration Points

1. **Fleet Module Navigation**: Add "Photos" tab to existing Fleet tabs
2. **Vehicle Detail Page**: Add Photos section/tab showing VehiclePhotoManager
3. **Vehicle Card**: Update to show hero photo from `get_vehicle_hero_photo()` function

### UI Polish

- Loading skeletons for photo grid
- Optimistic updates when reordering
- Toast notifications for success/error
- Empty states with helpful CTAs
- Responsive grid (4 cols desktop, 2 cols tablet, 1 col mobile)

## Step 5: Verification Checklist

After building, verify:

- [ ] Can upload single photo to specific vehicle
- [ ] Can bulk upload multiple photos
- [ ] AI analysis runs and returns angle/quality
- [ ] Unmatched photos appear in review queue
- [ ] Can match unmatched photo to vehicle
- [ ] Can set a photo as hero
- [ ] Only one hero per vehicle enforced
- [ ] Can reorder photos
- [ ] Can delete photos
- [ ] Photos show on vehicle detail page
- [ ] Stats update correctly

## Database Schema Reference

### vehicle_photos
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vehicle_id | UUID | FK to vehicles |
| photo_type | TEXT | hero, exterior, interior, detail, document |
| detected_angle | TEXT | front, rear, left_side, etc. |
| quality_score | INTEGER | 0-100 from AI |
| url | TEXT | Public URL |
| display_order | INTEGER | For ordering |

### unmatched_photos
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| batch_id | UUID | FK to upload batch |
| status | TEXT | pending, matched, skipped, rejected |
| suggested_make | TEXT | AI suggestion |
| suggested_vehicle_id | UUID | AI suggested match |

## Questions for Lovable

1. Should the Photo Hub be a separate route (`/fleet/photos`) or a tab within the existing Fleet page?
2. Should we show a "photo coverage" indicator on each vehicle card (e.g., "8/11 photos")?
3. For the review queue, should we process photos one at a time or show a batch view?

## Notes

- The Google Cloud Vision API key needs to be added as a Supabase secret
- Photoroom integration (hero photo enhancement) is Phase 2 - skip for now
- The `vehicle-photos` storage bucket already exists
