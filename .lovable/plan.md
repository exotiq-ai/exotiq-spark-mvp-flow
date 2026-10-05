# Automatic ARK-style studio hero photos

## How this compares to the earlier AI Hero Shots proposal
That proposal was wider: a per-angle camera guide overlay, automatic replacement with before/after, a studio engine on every photo, and OpenAI vs Gemini image models in one flow. This plan is deliberately narrower and cheaper. Only the one hero photo gets rendered, the original is always kept, and there's a hard 3-render cap per car. The camera guide survives only as an "add a 45° photo" hint when no good source exists. The model decision is settled below with a real comparison instead of a two-model toggle. Nothing in this plan contradicts the earlier proposal — it's the cost-controlled version of it.

## Goal
When an operator uploads photos, the best 45° front driver-side photo is turned into an ARK-style studio hero automatically. That one image becomes the car's main photo everywhere: the fleet card, the vehicle details screen, and the renter booking site. The operator can request up to 2 redos. After 3 total tries, the car goes to Exotiq support and hello@exotiq.ai gets an email. No buttons to learn, no settings to find — it just happens during onboarding and every later upload.

## Phase 1 — Lock in the master prompt across the whole EBTB fleet (no app changes)
Exotics By The Bay has 27 vehicles — the right stress test because it covers tall SUVs (Urus), bright colors, black, white, silver and metallic paints, open-top cars, and modified body kits.

1. Pull the best source photo for each of the 27 vehicles from their existing library.
2. Render each car with one fixed master prompt in the Sterrato/ARK style (the exact DNA below).
3. Review side by side against the originals, grade each on vehicle fidelity (wheels, badges, grille, body kit, paint, calipers, interior), and tighten the prompt after each round. Known risk profiles to watch: black-on-black separation (R8 needed side lighting), bright paint clipping, tall SUV proportions, open-top interiors, custom kits (Vorsteiner, Mansory).
4. Check crops at the renter app's mobile card size and the vehicle-page size — the badge safe-zone padding matters here.
5. Images go to the Files collection only; nothing is linked to any car. You approve the final master prompt before Phase 2 starts.

### The master prompt (DNA from the ARK Sterrato reference)
- Textured matte charcoal backdrop with a soft radial falloff behind the car — not a sterile digital gradient
- Seamless dark ceiling fade, no visible light fixtures or lightbox
- Soft overhead diffused highlights running along the shoulder line and hood
- Polished dark floor with realistic contact shadows and low-opacity reflections under tires and sills
- True 45° front driver-side three-quarter view from knee height, wheels turned slightly toward camera
- Car fills 75–80% of frame width, centered lower-middle, with padding so booking-site badges never overlap the car
- STRICT: preserve exact wheels, badges, grille, body kit, paint color/finish, calipers, and interior — never invent or restyle vehicle details

## Phase 2 — Build it into the Photo Hub

### Automatic on upload
- After photos are uploaded and sorted, the app picks the best 45° front-quarter photo (using the angle the analysis step already detects) and starts a studio render in the background. The operator never waits on screen.
- If no photo has a good enough angle, the car shows "Add a 45° front driver-side photo" with a camera-angle guide. No render is attempted, so no money is wasted on bad inputs.

### Hero is the default everywhere
- The finished render becomes the car's lead photo (`display_order = 0`, `photo_type = 'hero'`). The original is always kept, never overwritten, and moves down one slot.
- Fleet card, vehicle details, and the booking site all show the studio hero through the existing photo order — no renter-app code changes.
- Operators can switch back to their original photo at any time.

### Redo limit and support handoff
- The vehicle's Photos tab shows the studio hero next to the original, with a "Re-render" button and a counter ("2 of 3 renders used").
- After the 3rd render, the button becomes "Exotiq support is on it". A support notification appears in Super Admin, and hello@exotiq.ai gets an email with the team, the car, and all three renders attached.
- Super Admin can reset the counter or upload a hand-finished hero.

### Marketplace readiness
- A studio hero counts as a valid main photo for readiness. The original photo still counts too, so nothing that passes today starts failing.
- While a render is in progress, the car shows "Studio photo rendering".

### Cost controls
- Only the one hero photo is rendered, never the whole gallery.
- Hard cap of 3 renders per car, enforced server-side.
- Duplicate uploads are skipped.
- Each render's cost is logged per team and visible in Super Admin.

## Model choice and cost
- **Model: Nano Banana (Gemini image) via the AI gateway** — the same engine behind `generate-hero-image` and all our test renders. It's an edit-style call with the source photo as a reference image, not text-to-image, which is why vehicle fidelity stays high.
- **Alternatives considered:** OpenAI gpt-image (slower, pricier, no fidelity advantage in our tests); Flux (weaker instruction-following on "preserve exact details"); Photoroom-style background APIs (cheap but can't relight or re-angle — only swaps backgrounds). Nano Banana wins on fidelity-per-dollar for this job.
- **Cost shape:** roughly cents per render. At 1 hero per car and a 3-render cap, a 50-car fleet onboarding costs a few dollars total. Logging per team lets us watch real numbers before considering any tenant-facing pricing.
- The master prompt lives in one shared server module with a version number, so prompt improvements roll out without code churn and we can trace which prompt made which render.

## Guardrails
- Additive only: nothing removed or renamed, original photos never touched.
- Live renter app (`book.exotiq.rent`) code unchanged — it already serves the lead photo.
- Existing readiness, booking, and payment rules unchanged.
- One feature flag kills the whole thing; per-team override available.

## Technical details
- New table `hero_render_jobs`: `vehicle_id`, `team_id`, `source_photo_id`, `attempt` (1–3), `status`, `prompt_version`, `result_photo_id`, `cost_estimate`, `error`, timestamps. RLS scoped by `team_id`; super admins read all.
- Edge function `render-studio-hero`: validates JWT, checks team membership, enforces the 3-render cap server-side, calls the gateway with the source photo + master prompt, writes the result as a new `vehicle_photos` row.
- Trigger at the end of the upload pipeline fires the render when a `front_quarter` photo is confirmed.
- 3rd-render escalation: support notification + transactional email to hello@exotiq.ai via the existing email path.
- Feature flag `studioHeroAuto` in `src/lib/featureFlags.ts` plus per-team override.
