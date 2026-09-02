# Tenant Walkthrough Video — ~90s Onboarding Refresher

A narrated screen-capture video that shows real Command Center screens, recaps the daily basics, and introduces the two new features (blocked dates, per-location tax). Delivered as an MP4 you can send to tenants or drop into the LMS.

## What the video covers

| # | Beat | Approx. time |
|---|------|--------------|
| 1 | Title card — Exotiq lockup, "What's new in your Command Center" | 0:00-0:06 |
| 2 | Dashboard / Pulse: the 30-second morning check | 0:06-0:20 |
| 3 | Fleet: vehicle cards, status chips (On Rental, Out of Service) | 0:20-0:32 |
| 4 | **New — Block dates**: card menu → Block dates dialog → pick range → reason (Rented on Turo) → save → neutral "Blocked · Rented on Turo" chip | 0:32-0:56 |
| 5 | Booking safety: New Booking shows that vehicle as unavailable; public booking site shows those days busy | 0:56-1:10 |
| 6 | **New — Per-location tax**: Settings → Locations → Edit Location → rate, label, tax-inclusive; booking total pulls tax from pickup location | 1:10-1:26 |
| 7 | Close card — where to get help, ⌘K reminder | 1:26-1:32 |

## How it gets made

1. **Capture** — a Playwright script signs into the demo workspace, drives each beat, and saves a numbered PNG frame sequence (plus short hold frames on key states) at 1920x1080. No production tenant data appears; the demo fleet is used.
2. **Narration** — script written per beat, spoken by the existing Rari voice through the project's `text-to-speech` function, one MP3 per beat, then concatenated. Pronunciation fixes (Exotique, Rarri, Motor I.Q.) reused from the demo orchestrator.
3. **Assembly** — a Remotion project under `remotion/` composes the captured frames into scenes: soft Ken Burns drift so nothing sits static, callout arrows/highlight rings on the exact control being discussed, burned-in captions matched to the narration, and Exotiq-branded title/end cards. Scene lengths are set from the measured audio duration of each narration clip.
4. **Render** — MP4 (H.264, 1920x1080, 30fps) written to `/mnt/documents/exotiq-tenant-walkthrough.mp4`, with the audio track muxed in via ffmpeg after the Remotion render.

## Technical notes

- Remotion source lives in `remotion/` so the video can be re-rendered or edited later when more features ship; capture script and narration script are stored alongside it.
- Capture runs headless against `localhost:8080` in the sandbox — no changes to app code, no production writes. Any block created during capture is created and removed inside the demo workspace.
- Narration audio is generated once and cached as files in the Remotion `public/` folder, so re-renders don't re-bill TTS.
- Captions are rendered from the same script text used for narration, so they never drift.
- Two deliverables: the full MP4, and (if useful) a silent captions-only cut for embedding where autoplay audio is blocked.

## Open items

- If any beat can't be captured cleanly in the demo workspace (e.g. a dialog needs data that isn't seeded), that beat falls back to a static annotated screenshot with the same narration rather than being dropped.
