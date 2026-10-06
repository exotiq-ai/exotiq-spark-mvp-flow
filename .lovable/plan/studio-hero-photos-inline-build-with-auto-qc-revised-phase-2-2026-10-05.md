# Studio Hero Photos — Inline Build with Auto-QC (revised Phase 2)

Builds on the approved plan `automatic-ark-style-studio-hero-photos-2026-10-05.md`. This revision answers three concerns from the EBTB test batch (27 renders: 23 clean, 4 failed, 1 wrong facing direction).

## The concerns, answered with today's data

1. **First-take quality / cost / speed.** Failure rate today was ~15% (4 of 27). At ~$0.04 per render, a vehicle that needs all 3 runs costs ~$0.12 worst case — the 3-render cap already makes cost a non-issue. Speed: rendering runs in the background after upload; the raw photo shows everywhere until the studio hero lands, so onboarding never blocks.
2. **Facing direction.** The master prompt says "45-degree front driver-side" but the model keeps the source photo's direction when it conflicts (the Dawn render faced right). Fix: normalize the source, not just the prompt.
3. **Independent QC worker.** Yes — a cheap vision check (~$0.001 per check) catches exactly the 4 failure modes we saw today, automatically, before the image is ever promoted.

## What gets built

### 1. Direction normalization (before rendering)
- The existing upload analysis (`identify-vehicle`, Gemini) already detects the photo's angle. If the best source photo faces front-right, the server mirrors it horizontally before sending it to the render model — a flipped photo facing left renders facing left, deterministically.
- Master prompt updated to state explicitly: "the front of the car points toward the LEFT edge of the frame."

### 2. Auto-QC worker (after every render, before promotion)
A second, cheap vision call (Gemini Flash, ~$0.001) scores each render against a fixed checklist:
- Front of car points left, true 45° front-quarter view
- Dark seamless studio backdrop — no brick, cinderblock, windows, or visible light fixtures
- Landscape orientation, car fills 75–80% of frame with padding
- Wheels, badges, grille, body kit, paint and calipers match the source photo
- No warped badges, extra wheels, or invented body panels

**Pass** → promote to hero (`display_order = 0`, `photo_type = 'hero'`), original kept one slot down.
**Fail** → auto re-render with the failure reason appended to the prompt (e.g. "seamless dark studio wall, no brick texture"). Counts toward the same 3-render cap. After 3 failed runs, existing escalation: Super Admin notification + email to hello@exotiq.ai with all renders.

### 3. Everything else from the approved plan, unchanged
- `hero_render_jobs` table, `render-studio-hero` edge function (Nano Banana via AI gateway, edit-style with source photo as reference)
- Auto-trigger on upload when a good 45° photo exists; "Add a 45° front driver-side photo" guidance when not
- Photos tab: hero next to original, Re-render button with counter, operator can revert to raw
- Studio hero counts for marketplace readiness; "Studio photo rendering" state while in progress
- `studioHeroAuto` feature flag + per-team override; per-team cost logging in Super Admin
- Master prompt versioned in one shared server module

## Cost per vehicle (worst case)
- 3 renders × $0.04 + 3 QC checks × $0.001 ≈ **$0.12**; typical vehicle (first-take pass) ≈ **$0.041**
- 100-vehicle fleet onboarding: ~$4–5 total

## Guardrails
- Additive only; original photos never altered or deleted
- No renter-app code changes; existing readiness/booking/payment rules untouched
- QC never blocks the raw photo from displaying — the fleet is always usable
- Feature flag kills the whole pipeline instantly

## Technical notes
- QC checklist lives server-side next to the master prompt, versioned together
- Mirroring uses a server-side image op before the render call; stored as a job step so it's auditable
- QC failure reasons stored on `hero_render_jobs` for prompt tuning and support review
