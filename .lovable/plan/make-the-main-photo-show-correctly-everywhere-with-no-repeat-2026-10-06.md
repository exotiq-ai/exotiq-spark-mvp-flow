# Make the main photo show correctly everywhere, with no repeats

## What's actually happening (checked in the database)
- The new studio photos ARE the main photo for all five cars. The booking pages in your screenshots show them first.
- The real problem is the gallery. Every failed or older studio attempt was saved as a *visible* gallery photo. For example, the Red GT3 and Dawn each have 3 old studio attempts still showing. That's why you see "01 / 06" and an older studio GT3 (the 997 one) in the thumbnails.
- The main booking page tile works out its photo with a different lookup than the detail page. The tile you saw is either a cached copy or uses that other lookup, so the plan checks and fixes both.

## Plan
1. **Clean up the five cars now.** Hide old and failed studio attempts from the public gallery. Nothing is deleted, so they stay available in the Photos tab and Super Admin. Then do the same across every tenant, but only for renders that never became the main photo.
2. **Stop it happening again.** Studio Hero attempts that fail checks or get replaced are saved as hidden. Only the render that passes checks is visible and becomes the main photo.
3. **One main photo everywhere.** When anyone picks a main photo (you in Super Admin, a tenant in the Photos tab, or the automatic studio render), the same steps run every time: it becomes the only main photo, moves to first place, and updates the listing image. The booking home tile, the detail page and fleet cards all read that one value.
4. **No repeats in the gallery.** The public detail page shows the main photo once at the top. The gallery then lists only the other visible photos, leaving out the main photo and any copies of the same file. Example: GT3 = studio main photo, then the garage photo. That's "01 / 02", not 06.
5. **Caching.** New photos get a new file name each time, so browsers can't keep showing an old one. Check the booking home page with a fresh load. If an old copy still shows after that, cut how long the fleet list is cached.
6. **Verify.** Run database checks: exactly one main photo per car, it matches the listing image, and no hidden render shows up publicly. Then check book.exotiq.rent/exotics-by-the-bay and the five detail pages on phone and desktop.

## Technical details
- Data: `UPDATE vehicle_photos SET is_visible=false WHERE source='studio_render' AND display_order>0` (EBTB first, then all teams), with a backup of the rows first.
- `render-studio-hero`: insert non-promoted or failed attempts with `is_visible=false`. On promotion, mark the previous studio hero `is_visible=false`.
- One shared `set_vehicle_hero(_photo_id)` SECURITY DEFINER function, with team access checked, used by `setAsHero` in usePhotoAnalysis.ts, the Super Admin UI and the edge function. It handles single hero, display_order 0, `vehicles.image_url` sync, and moves the old hero to `exterior`.
- New function `public_vehicle_gallery` (or a new column added to the detail function), returning photos where `is_visible` is true, excluding the hero URL, with duplicates removed by URL. The existing function signatures stay unchanged. The renter app's switch to this needs a handoff note for book.exotiq.rent, because that app lives in a separate repo.
- Nothing breaks: all changes are additive, rows are only hidden and never deleted, and current function outputs stay the same.
