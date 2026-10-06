# EBTB Fleet Studio Heroes — Render, QC, Promote

## Where things stand (checked today)
- Exotics By The Bay has 27 cars. None has a studio hero yet, and none has any render history in the app. All the earlier test renders exist only in the Files collection.
- Only 1 of the 27 cars (Mercedes G63, 17190e81) has a photo the app has tagged as a 45° front-quarter shot. The automatic picker would skip the other 26 and show "Add a 45° photo" for them.
- 9 cars have only one photo (R8 Spyder, Escalade V, Urus, McLaren GTS, G63 845361f5, S580, GLE53, BRABUS G800, GT3, Rolls Dawn). For those cars, that one photo is the only possible source.
- Known gaps from last round: tall (portrait) photos aren't widened before rendering, and the G800's photo isn't of the right car.

## Plan

### Step 1 — Pick the right source photo for each car
- Re-run the angle check on all of EBTB's photos so the angle tags reflect what's actually in each photo.
- Choose one source per car. Order of preference: a true 45° front driver-side landscape shot, then any front-quarter shot (the app mirrors it if it faces right), then the best full-car landscape photo.
- I'll show you the list of chosen sources before any render runs. Cars without a usable full-car photo get flagged and skipped (the G800 is the expected one).

### Step 2 — Close the two gaps in the live pipeline
- **Tall photos:** pad tall photos to landscape before rendering, the same way the successful GT3 re-run did, so they don't burn all 3 tries.
- **Source override:** let the render accept a specific photo chosen by a Super Admin, so Step 1's picks are used even when the angle tag is weak. Operators' automatic flow stays unchanged.

### Step 3 — Render in small batches through the real pipeline
- Batches of 5 cars, each run through the live render service: render, independent quality check, then automatic re-render with corrections if the check fails. The 3-try cap and support handoff still apply.
- Order: easy cars first (sports cars with good landscape shots), then risky ones (black paint, tall SUVs, convertibles, widebody kits).
- Stop and report if more than 2 cars in a batch escalate.

### Step 4 — Promotion (automatic only when a render passes)
- A render that passes quality check becomes the car's main photo on the fleet card, in vehicle details and on book.exotiq.rent. The original photo is kept and moves to second place.
- Failed or escalated cars keep their current photo. Nothing about them changes on the renter site.

### Step 5 — Verify end to end
- Database check: each passed car has exactly one main photo, it's the studio render, and its listing image matches.
- Browser check: screenshots of the EBTB fleet dashboard and book.exotiq.rent/ebtb at phone and desktop sizes, confirming the new heroes show and badges don't cover the car.
- A final report for you: passed / escalated / skipped, with before and after images and the total render cost.

## What you'll need to give me
- A correct photo for the BRABUS G800, and for any other car Step 1 flags.

## Guardrails
- Additive only. Original photos are never edited or deleted. Readiness, booking and payment rules don't change.
- No code changes to the renter app.
- Easy rollback: Super Admin's "Reset counter" plus switching back to the original photo in the Photos tab.
- Cost cap: 27 cars × up to 3 tries × about $0.04 comes to roughly $3.30 at most.

## Technical details
- Angle refresh: re-invoke `identify-vehicle` per EBTB photo and update `detected_angle` only.
- `render-studio-hero`: add an optional `sourcePhotoId` (Super Admin only, checked against the team) and a portrait-to-landscape padding step before the gateway call. Record the padding as a job step.
- Batches run by invoking the function with a Super Admin session. Results are read back from `hero_render_jobs` and `vehicle_photos`, filtered to `source='studio_render'`, `display_order=0`.
- Promotion uses the existing pass path: set `photo_type='hero'`, shift the original down one slot, and sync `vehicles.image_url`.
