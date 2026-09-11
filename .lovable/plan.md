# Instagram Reels — revised after feedback (3 × ~30s, 9:16)

All of the feedback is accepted. The plan below replaces the earlier one.

## Accepted changes

- **No title card.** Frame 1 is already the real UI mid-motion, hook text over it. Rari's first word lands by frame 15 (0.5s). No logo, no fade-in at the top.
- **Spoken CTA before the end card.** Mechanism: comment a keyword. Rari says it (~3s before the end), and it also appears as on-screen text. End card carries exotiq.ai only, not the ask.
- **Rari speaks in first person** as the operator's fleet manager: "I reprice your fleet while you sleep," never "MotorIQ uses demand-based pricing."
- **Claim accuracy.** Reel 2 says "every channel you run through Exotiq" — no implied Turo sync. Reel 3 sells certainty, not payout speed.
- **Three text layers per reel**: hook text (big, short), Rari lines (captions transcribe verbatim), payoff text (separate, punchier). Captions never duplicate the hook or payoff wording.
- **Scripts come from you.** I generate voice from your approved copy verbatim — no paraphrasing, no rewriting at generation time.
- **Feed cut is 4:5** (1080×1350), not 1:1.
- **Launch order**: 1) Double-booking killer, 2) Prices itself, 3) Money, not limbo.
- **Music**: dark minimal pulse, sub-bass and sparse ticks, ducked ~12dB under Rari, faded up in the last 3s over the end card.

## Per-reel structure (~28–30s)

```text
0.0–0.5s   real UI already moving + hook text        (no card, no logo)
0.5–3.0s   Rari's first line lands over the UI
3–20s      one differentiator on real UI, slow zoom-pan
20–24s     payoff text + Rari payoff line
24–27s     Rari speaks the CTA + on-screen keyword line
27–30s     end card: exotiq.ai, music up
```

Safe margins: bottom ~250px and top ~120px kept clear of anything load-bearing.

## Copy slots I need from you

For each of the three reels: hook text (≤6 words), 4–6 Rari first-person lines, payoff text (≤6 words), and the comment keyword. Send them and I generate voice from them exactly as written.

## Production steps

1. You send approved copy (3 reels × 3 layers + keyword).
2. Generate Rari narration verbatim; measure per-line timings and lay the timeline to those measurements.
3. Build a 1080×1920 Remotion composition (new reel components, reframed for vertical) alongside the untouched overview video.
4. Source the music bed, mix with sidechain-style ducking under narration.
5. Reuse existing UI captures; re-capture vertically only where a crop fails (fleet status flip, MotorIQ pricing, payments).
6. Render 3 MP4s to `/mnt/documents/`, verify duration/resolution/audio with ffprobe, and check each plays muted with captions alone.
7. Export 4:5 feed cuts of all three.

## Technical details

- New Remotion compositions at 1080×1920 and 1080×1350; existing `main` composition untouched.
- Rari voice ID `lcMyyd2HUfFzxdCaC4Ta`; mp3 clips under `remotion/public/audio/reels/`.
- Music bed as a separate audio track with a volume envelope keyed off the narration segment timings.
- No app codebase changes — all work sits in `remotion/` plus generated assets.
