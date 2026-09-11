# Rari-narrated Instagram Reels (3 × ~30s, 9:16)

## What we're making

Three vertical short-form marketing reels, each built around ONE differentiator, narrated by the existing Rari voice, with burned-in captions. These are hooks, not demos — no walkthrough pacing, no feature tours.

## Why build them here (not ElevenLabs/creative tools)

- We already have the full pipeline in-project: Rari's ElevenLabs voice ID, the Remotion render setup, and real 1080p UI captures from the overview video.
- The credibility of the ad IS the real product UI + the real Rari voice. Template tools can't supply either.
- Vertical reframing, hook timing, and caption styling are all code-side changes to the existing Remotion project.

## Format (each reel)

- 1080×1920 (9:16), ~25–30 seconds, H.264 MP4, 30fps.
- Structure: 0–3s text hook + Rari line → 3–20s one differentiator on real UI with zoom-pan → 20–27s payoff line → 27–30s Exotiq brand card.
- Captions burned in, sized for muted autoplay; safe margins for IG UI overlays (bottom ~250px clear).
- Deliver both the narrated MP4 and a muted-friendly check (captions carry the story alone).

## The three reels

1. **"Prices itself"** — MotorIQ demand-based dynamic pricing. Hook on the demand heat/pricing screen; payoff: revenue per car without touching a spreadsheet.
2. **"Double-booking killer"** — mark a car out of service, it becomes instantly unbookable everywhere. Hook on the fleet card status flip; payoff: never explain a conflict to a customer again.
3. **"Money, not limbo"** — Stripe-powered payments, deposits, balance due in one place. Hook on the payments view; payoff: money in your account.

(Each reel's script is 4–6 short Rari lines, ~65–75 words max. I'll draft scripts for your approval before generating voice.)

## Production steps

1. Draft the 3 scripts (hook/line/payoff per reel) — you approve or edit in chat first.
2. Generate Rari narration clips via the existing ElevenLabs voice; measure timings.
3. Create a vertical composition in the existing `remotion/` project (new `Reel.tsx` components, reusing Backdrop/ShotFrame/Caption patterns, reframed 9:16).
4. Reuse existing UI captures where framing works; capture 1–2 new vertical-friendly screenshots only if a crop fails.
5. Spot-check frames, render 3 MP4s to `/mnt/documents/`, verify with ffprobe (duration, resolution, audio present).
6. Optional: 1:1 square crops of each for feed posts.

## Technical details

- New Remotion compositions at 1080×1920 registered alongside the existing `main` one; existing overview video untouched.
- Voice: ElevenLabs voice ID already used for Rari (`lcMyyd2HUfFzxdCaC4Ta`), mp3 clips stored under `remotion/public/audio/reels/`.
- No changes to the app codebase; this is entirely inside `remotion/` + generated assets.
- Estimated turn cost: mostly 3 short ElevenLabs generations + 3 short renders (fast, ~30s each of video).
