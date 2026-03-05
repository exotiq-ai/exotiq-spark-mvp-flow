

# Sunset PhotoRoom Enhancement — Cleanup Plan

## Summary
Remove the PhotoRoom background-removal feature entirely. This touches one edge function, two UI components, and several references to `enhanced_url` / `is_enhanced` across the photo module. The database columns stay (harmless, avoids migration risk), but nothing will write to them going forward.

## Changes

### 1. Delete edge function
- **Delete** `supabase/functions/enhance-hero-photo/index.ts` — the entire PhotoRoom integration

### 2. Delete UI components
- **Delete** `src/components/photos/HeroEnhancementPreview.tsx` — the enhance dialog
- **Delete** `src/components/photos/OriginalPhotoDialog.tsx` — the original-vs-enhanced comparison dialog

### 3. Edit `src/components/photos/VehiclePhotoManager.tsx`
- Remove imports: `HeroEnhancementPreview`, `OriginalPhotoDialog`, `Wand2`, `Eye`, `RotateCcw`, `Sparkles` (keep if used elsewhere)
- Remove state: `enhanceDialogOpen`, `selectedHeroPhoto`, `originalPhotoDialog`, `isRestoring`
- Remove handlers: `handleEnhanceHero`, `handleViewOriginal`, `handleRestoreOriginal`
- In `handleSetAsHero`: remove the post-set "offer enhancement" block (lines 149-153)
- Hero photo display: change `heroPhoto.enhanced_url || heroPhoto.url` → `heroPhoto.url`
- Remove "Enhanced" badge on hero photo
- Remove hover actions: "Enhance" / "Re-enhance" button, "Original" button
- Remove the two dialog renders at bottom (`HeroEnhancementPreview`, `OriginalPhotoDialog`)

### 4. Edit `src/components/dialogs/VehicleImageDialog.tsx`
- Change `heroPhoto?.enhanced_url` fallback to just use `heroPhoto?.url`
- Change `photo?.enhanced_url || photo?.url` to `photo?.url`

### 5. Edit `src/components/photos/usePhotoAnalysis.ts`
- In `setAsHero`, remove the `enhanced_url` from the select query and the `photo.enhanced_url || photo.url` logic — just use `photo.url`

### 6. Edit `src/components/photos/PhotoGalleryStrip.tsx`
- Remove `enhanced_url` from the photo interface (optional cleanup)

### 7. Edit `src/components/photos/types.ts`
- Remove `is_enhanced`, `enhanced_url`, `enhancement_settings` from the `VehiclePhoto` interface (or mark as deprecated)

### 8. Edit `LOVABLE_PHOTO_HUB_HANDOFF.md`
- Remove references to PhotoRoom / enhance-hero-photo as active features

## What stays unchanged
- **Database columns** (`enhanced_url`, `is_enhanced`, `enhanced_at`, `enhancement_settings`) — left in place to avoid migration risk; they'll just be null going forward
- **`PHOTOROOM_API_KEY` secret** — harmless to leave, no code references it after cleanup
- **`generate-hero-image` edge function** — this is the AI showroom generator (Gemini), unrelated to PhotoRoom
- **`useGenerateHeroImage` hook** — stays, it's the AI-generated preview feature, not PhotoRoom

## Risk Assessment
- Low risk: PhotoRoom was an optional enhancement layer. All photo display logic falls back to `url` when `enhanced_url` is null, which is already the default state for 99%+ of photos
- The `sync_hero_to_vehicle` DB trigger references `COALESCE(enhanced_url, url)` — this is fine, it'll just always use `url` now

