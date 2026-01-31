
# Vehicle Image Dialog Enhancement Plan

## Summary

This plan addresses two key improvements:
1. **Keep Original Photo Option** - Allow users to view/revert to original after AI enhancement
2. **Hero Photo + Gallery in Overview** - Show the actual hero photo instead of static images, with ability to browse all vehicle photos

---

## Part 1: Keep Original Photo After Enhancement

### Current Behavior
When a hero photo is enhanced:
- Original photo URL is stored in `url` column
- Enhanced photo URL is stored in `enhanced_url` column  
- The UI only displays the enhanced version with no way to access the original

### Solution
Add a "View Original" / "Restore Original" option in the hero photo section and enhancement preview:

**Changes to HeroEnhancementPreview.tsx:**
- Add a toggle or button to switch between "Use Enhanced" and "Use Original" after enhancement
- Show side-by-side comparison is already there - add clear action buttons for "Save Enhanced" vs "Keep Original"

**Changes to VehiclePhotoManager.tsx:**
- When displaying an enhanced hero photo, add an option in the dropdown/overlay to:
  - "View Original" (opens comparison modal)
  - "Restore Original" (sets `is_enhanced: false` and clears the enhanced display preference)

**Database consideration:**
The schema already supports this - `url` always contains original, `enhanced_url` contains enhanced. No schema changes needed.

---

## Part 2: Show Hero Photo in Overview Tab

### Current Behavior
The Overview tab uses `getVehicleImage(vehicleName)` which returns static bundled images only. For vehicles like "Cadillac Escalade ESV" that aren't in the static mapping, it shows "No image available".

### Solution
Fetch and display the actual hero photo from the database:

**Changes to VehicleImageDialog.tsx:**
1. Import and use `useVehiclePhotos` hook to fetch vehicle photos
2. Find the hero photo (where `photo_type === 'hero'`)
3. Use cascading image resolution:
   - Enhanced hero URL (if available)
   - Original hero URL
   - Static mapping fallback
   - "No image" placeholder
4. Display the hero photo in the Overview tab

---

## Part 3: Photo Gallery in Overview Tab

### New Feature
Add a small photo thumbnail strip below the main hero image that allows clicking through all vehicle photos.

**UI Design:**
```
┌─────────────────────────────────────────┐
│                                         │
│           [Main Hero Photo]             │
│                                         │
├─────────────────────────────────────────┤
│ ○ ○ ● ○ ○ ○ ○ ○  (dot indicators)       │
│                                         │
│ [< ] [thumb] [thumb] [thumb] [thumb] [>]│
└─────────────────────────────────────────┘
```

**Components:**
- Carousel/swipe behavior for main image
- Thumbnail strip showing all photos
- Clicking a thumbnail shows that photo full-size
- Auto-highlights current photo in strip

---

## Implementation Details

### File: src/components/dialogs/VehicleImageDialog.tsx

**Changes:**
1. Add `useVehiclePhotos({ vehicleId })` hook to fetch photos
2. Replace static `imageUrl` with resolved hero photo
3. Add state for `selectedPhotoIndex`
4. Add thumbnail strip with click-to-view functionality
5. Add keyboard navigation (arrow keys) for gallery

```typescript
// New logic for image resolution
const { photos, loading: photosLoading } = useVehiclePhotos({ vehicleId });

const heroPhoto = useMemo(() => 
  photos.find(p => p.photo_type === 'hero'), 
  [photos]
);

// Cascading resolution: enhanced hero → original hero → static → null
const mainImageUrl = useMemo(() => {
  if (heroPhoto?.enhanced_url) return heroPhoto.enhanced_url;
  if (heroPhoto?.url) return heroPhoto.url;
  return getVehicleImage(vehicleName);
}, [heroPhoto, vehicleName]);
```

### File: src/components/photos/VehiclePhotoManager.tsx

**Changes:**
1. Add dropdown option "View Original" when photo is enhanced
2. Add dropdown option "Restore to Original" to remove enhancement
3. Show visual indicator that original is preserved

```typescript
// Add to hero photo dropdown
{heroPhoto.is_enhanced && (
  <>
    <DropdownMenuItem onClick={() => handleViewOriginal(heroPhoto)}>
      View Original
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleRestoreOriginal(heroPhoto.id)}>
      Restore to Original
    </DropdownMenuItem>
  </>
)}
```

### File: src/components/photos/HeroEnhancementPreview.tsx

**Changes:**
1. Add clearer messaging that original is preserved
2. Update footer to say "Original photo will be preserved"
3. Add post-save confirmation showing both options are available

---

## New Component: PhotoGalleryStrip

A reusable thumbnail strip for navigating between photos:

```typescript
interface PhotoGalleryStripProps {
  photos: VehiclePhoto[];
  currentIndex: number;
  onSelect: (index: number) => void;
  size?: 'sm' | 'md';
}
```

**Features:**
- Horizontal scrollable strip
- Visual highlight on selected thumbnail
- Click to navigate
- Optional carousel dots for mobile

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dialogs/VehicleImageDialog.tsx` | Fetch photos, show hero, add gallery strip |
| `src/components/photos/VehiclePhotoManager.tsx` | Add "View/Restore Original" options |
| `src/components/photos/HeroEnhancementPreview.tsx` | Add messaging about original preservation |
| New: `src/components/photos/PhotoGalleryStrip.tsx` | Reusable thumbnail navigation component |

---

## Expected User Experience

### After Enhancement:
1. User enhances a hero photo
2. Success message shows: "Enhanced photo saved! Original photo is preserved."
3. In VehiclePhotoManager, hero shows "Enhanced" badge
4. Dropdown menu includes "View Original" and "Restore to Original"
5. User can switch back at any time

### In Vehicle Details Dialog (Overview):
1. Opening a vehicle shows the actual hero photo (not placeholder)
2. If enhanced, shows the enhanced version
3. Thumbnail strip below shows all available photos
4. Clicking thumbnails swipes to that photo
5. Vehicle details remain below the gallery

---

## Technical Notes

- No database migration needed - schema already supports original/enhanced separation
- Uses existing `useVehiclePhotos` hook for data fetching
- Gallery uses existing photo URL generation logic
- Maintains backward compatibility with static image mapping for vehicles without uploaded photos
