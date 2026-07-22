# Exotiq Tenant — Hero Image Cleanup

## What I found

The Audi S8 (2017) is currently showing an "unmatched" upload — a photo that was never confirmed to be an S8. It's a poor marketplace representation.

While auditing, I found **7 other marketplace-visible vehicles** on the Exotiq tenant with sub-par hero images:

| Vehicle | Current image issue |
|---|---|
| Audi S8 (2017) | Unmatched upload (not confirmed S8) |
| Mercedes-Benz AMG GT (2024) | Unmatched upload |
| Porsche Panamera Turbo S (2024) | Unmatched upload |
| Aston Martin DBX707 (2024) | Generic `/lovable-uploads/` static asset |
| Audi R8 V10 Plus (2024) | Generic `/lovable-uploads/` static asset |
| Bugatti Chiron Sport (2024) | Generic `/lovable-uploads/` static asset |
| Ferrari 296 GTB (2024) | Generic `/lovable-uploads/` static asset |
| McLaren 720S Spider (2024) | Generic `/lovable-uploads/` static asset |

The Lamborghini Sián is `retired` + not marketplace-visible, so skipping it.

All other Exotiq marketplace vehicles (54 total) already have proper generated hero images from the earlier seed job — this is the cleanup tail.

## Plan

Reuse the exact pipeline from the earlier 30-vehicle seed (editorial studio style, `google/gemini-3.1-flash-image`, uploaded to `vehicle-photos/c1de6533-.../generated/{vehicle_id}/hero.jpg`, 10-year signed URL, upsert into `vehicle_photos`, update `vehicles.image_url`).

Steps:
1. Deploy a one-shot edge function `seed-exotiq-heroes-batch2` targeting the 8 vehicle IDs above.
2. Run it, verify each vehicle has a new `image_url` and a `vehicle_photos` row.
3. Delete the seeder function.
4. Confirm all 55 marketplace vehicles now return valid hero URLs from `public_team_fleet`.

## Not in scope

- Regenerating hero images for vehicles that already have decent generated heroes (no visible complaints).
- Changing the aesthetic style — sticking with the "editorial studio" look already established across the fleet for visual consistency.
- Wider tenant cleanup (deposits, pricing, descriptions) — happy to spin up separate plans if you want.

Say the word and I'll run it.
