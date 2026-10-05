# Automatic ARK-style studio hero photos

## Goal
When an operator uploads photos, the best 45° front driver-side photo is turned into an ARK-style studio hero automatically. That one image becomes the car's main photo everywhere: the fleet card, the vehicle details screen, and the renter booking site. The operator can ask for up to 2 redos. After 3 total tries, the car goes to Exotiq support and hello@exotiq.ai gets an email.

## Phase 1 — Lock in the master prompt (no app changes)
1. Pull the best source photo for every Exotics By The Bay vehicle. That's 27 cars, covering tall SUVs, bright colors, black, white, silver and metallic paints.
2. Render each car with one fixed master prompt in the Sterrato/ARK style:
   - textured matte charcoal backdrop with a soft radial falloff
   - seamless dark ceiling fade with no visible lights
   - soft overhead highlights along the shoulder line
   - polished dark floor with contact shadows
   - true 45° front driver-side view from knee height, wheels turned toward the camera
   - car fills 75–80% of the frame width, with safe padding for the booking-site badges
   - a strict rule to keep the wheels, badges, grille, body kit, paint, calipers and interior exactly as they are
3. Review the results side by side against the originals and tighten the prompt after each round. The images go to the Files collection only and are not linked to any car.
4. Check the crops at the renter app's mobile card size and the vehicle-page size.
5. You approve the final master prompt before Phase 2 starts.

## Phase 2 — Build it into the Photo Hub
**Automatic on upload**
- After photos are uploaded and sorted, the app picks the best 45° front-quarter photo and starts a studio render in the background. The operator never waits on screen.
- If no photo has a good enough angle, the car shows "Add a 45° front driver-side photo" with a camera-angle guide. No render is attempted, so no money is wasted on bad inputs.

**Hero is the default everywhere**
- The finished render becomes the car's lead photo. The original is always kept and never overwritten.
- The fleet card, vehicle details and booking site all show the studio hero, using the existing photo order.
- Operators can switch back to their original photo at any time.

**Redo limit and support handoff**
- The vehicle's Photos tab shows the studio hero next to the original, with a "Re-render" button and a counter (for example, "2 of 3 renders used").
- After the 3rd render, the button is replaced with "Exotiq support is on it". Support gets a notice in Super Admin, and hello@exotiq.ai gets an email with the team, the car and all three renders.
- Super Admin can reset the counter or upload a hand-finished hero.

**Marketplace readiness**
- A studio hero counts as a valid main photo for readiness. The original photo still counts too, so nothing that passes today will start failing.
- While a render is in progress, the car shows "Studio photo rendering".

**Cost controls**
- Only the one hero photo is rendered, never the whole gallery.
- There's a cap of 3 renders per car.
- Duplicate uploads are skipped.
- Each render's cost is logged for every team so it appears in Super Admin.

## Guardrails
- Only additions are made: nothing is removed or renamed, and the original photos are never touched.
- The live renter app's code is not changed. It already shows the lead photo.
- Existing readiness, booking and payment rules stay the same.
- All of this can be switched off with one setting, and it applies per team.

## Technical details
- Model: the image model already used by `generate-hero-image` (Nano Banana / Gemini image), called through the AI gateway with the source photo as a reference image. This is an edit-style call, not text-to-image. The master prompt is stored in one shared server module and has a version number.
- New table `hero_render_jobs`: `vehicle_id`, `team_id`, `source_photo_id`, `attempt` (1–3), `status`, `prompt_version`, `result_photo_id`, `cost_estimate`, `error` and timestamps. RLS is scoped by `team_id`, and super admins can read all teams.
- Renders are saved as new `vehicle_photos` rows with `photo_type = 'hero'`, `display_order = 0` and `generation_prompt` set. The source photo stays in place with `display_order` moved down by one.
- Edge function `render-studio-hero`: validates the user's login token, checks that the user belongs to the team, enforces the 3-render limit on the server, and runs the job.
- A trigger fires at the end of the upload pipeline. It uses the angle the photo-analysis step already detects (`front_quarter`).
- On the 3rd render, a support notification is created and an email is sent to hello@exotiq.ai through the existing transactional email path.
- Feature flag `studioHeroAuto` in `src/lib/featureFlags.ts`, plus a per-team override.
