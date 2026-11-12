# Studio Hero v2 — Two-stage "Identity Sheet + Locked Studio" pipeline

## Was this in the original plan?
Partly. The approved plans (Oct 5) had the right outline — analyze the source, render, independent QC, retry, escalate — but each "AI step" was thin:
- Stage 1 only classifies the photo (exterior/interior, facing direction, paint color). It does not describe the car's details.
- Stage 2 renders from **one** source photo plus the studio reference, using the older image model (Gemini 2.5 Flash Image / original Nano Banana).
- QC compares one source photo to the render, and if QC itself errors it lets the render through.
- The prompt has been edited in place (v1.0 → v1.5) without re-testing past winners, which is why some recent renders got worse (e.g. wrong wheels).

## How the current system works
```text
upload -> pick best photo (classify: exterior? facing? paint?)
       -> mirror if facing right, pad portraits
       -> render: 1 source photo + studio reference + master prompt
       -> QC: source vs render vs studio reference (pass/fail codes)
       -> pass: becomes hero | fail: retry with correction text (max 3) -> support
```

## What gets built (improvements)

### 1. Stage 1 — Vehicle Identity Sheet (new)
- Uses **all** exterior photos of the car, not just one.
- Produces a saved, structured description: make/model/trim, paint and finish, wheel design (spoke count, style, finish, center caps), caliper color, badges and lettering, grille, body kit and aero parts, mirrors, lights, roof state, notable features.
- Saved per vehicle and reused for every attempt; Super Admin can view and correct it before rendering.
- Low cost (text/vision only).

### 2. Stage 2 — Locked studio render
- Inputs: best 45-degree source + 1–2 extra reference photos (e.g. a wheel close-up / side view) + fixed studio reference + identity sheet + locked camera and lighting recipe (focal length, knee-height camera, left-facing driver-side three-quarter, light placement).
- Benchmark newer models (Nano Banana Pro / Gemini 3 image, GPT image) against the current one before switching.

### 3. Stricter QC
- QC checks the render against the identity sheet item by item (wheels, badges, calipers, paint, kit) and against multiple source photos.
- If QC is unavailable, the render waits instead of auto-passing.
- Wheel or detail mismatch retries reference the specific failed item.

### 4. Recipe versioning that only gets better
- Studio recipe and prompt become versioned records; old versions kept.
- A fixed benchmark set (about 8 approved EBTB cars incl. Maybach, Urus, GT3, G63 BRABUS, Dawn) is rerendered for any new version; a version only goes live if it scores at least as well as the current one on fidelity and studio consistency.
- Results saved for side-by-side review in Super Admin before switching.

### 5. Unchanged
3-attempt cap, support escalation to hello@exotiq.ai, originals never altered, existing heroes untouched until you approve rerenders, feature flag kill switch.

## Rollout
1. Build identity sheet + benchmark tool (no live changes).
2. Run benchmark: current model vs. 1–2 newer models; you pick the winner.
3. Switch live renderer to v2; optionally reset and rerender chosen EBTB cars.

## Cost (estimate)
Identity sheet ~ $0.002 once per car; render $0.04–0.15 depending on model; QC ~ $0.002. Benchmark run ~ $5–10 per model tested.

## Technical notes
- New table `vehicle_identity_sheets` (team-scoped RLS) and `studio_recipe_versions`; `hero_render_jobs` records recipe version and model.
- `render-studio-hero` gains model selection via recipe; QC fail-open removed (job set to `qc_pending` and retried).
- Benchmark runs as a Super Admin-only function writing to a separate results table; never promotes photos.
