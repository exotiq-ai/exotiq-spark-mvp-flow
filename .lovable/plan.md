# EBTB Studio Hero reset + Maybach white-render fix

## What happened (confirmed)
- The Maybach S680's first photo (the one marked as its main photo) is a **white interior shot** (rear seats). The renderer always starts from the first photo, so the AI was handed white leather, not the black car, and invented a white exterior.
- The listing itself also says the paint color is **White**, so nothing contradicted it.
- The quality checker only compares the render to the photo it was given, so "white car" looked faithful. It failed all 3 tries on direction only, then escalated to support. Nothing got promoted, so the live photos are unchanged.

## Steps
1. **Reset EBTB's allotment, whole fleet.** Archive every Studio Hero attempt for Exotics by the Bay so each car gets 3 fresh tries again. Nothing gets deleted, and current heroes stay as they are.
2. **Fix the Maybach listing.** Change its paint color from White to Black (the exterior photos show a black car), and move the black front 45° photo ahead of the interior shot.
3. **Re-render the Maybach** from the black front 45° photo (mirrored to face left), check it against the original, and promote it only if it passes.

## Avoiding this going forward
- **Smarter source pick:** before rendering, a quick image check makes sure the source is an exterior shot of the whole car, front-quarter if possible. Interior, detail, rear and collage photos get skipped, and the renderer picks the best exterior photo instead of just the first one.
- **Color guard:** the listed paint color goes into the prompt as a hint. The checker gets a new test that fails if the render's paint doesn't match the source photo. If the listing and the photo disagree (like White vs a black car), the render is held and the team gets a "check paint color" note instead of using up tries.
- **No exterior photo?** Skip without using a try, and show "Add a front 45° exterior photo" in Photos.

## Technical details
- Reset: `update hero_render_jobs set archived_at=now() where team_id=<EBTB> and archived_at is null` (the attempt count only counts rows that aren't archived; I'll confirm that in code first).
- `render-studio-hero`: add a Gemini classification step (`exterior_front_quarter | exterior_other | interior | detail | collage`) on candidate photos, ordered by display_order. Choose the first `exterior_front_quarter`, falling back to `exterior_other`. Super Admin's sourcePhotoId override still wins.
- `_shared/studioHero.ts` v1.4: add `PAINT HINT: {color}` (source wins on conflict) and a QC `paint_mismatch` code with its own correction text. Additive only. The existing mirror and portrait handling stays as it is.
- One shared rule for every car; booking site and public pages untouched.
