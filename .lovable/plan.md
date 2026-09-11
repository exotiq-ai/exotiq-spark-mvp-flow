# Instagram Reels — final copy locked, production plan (3 × ~30s, 9:16)

Copy approved via review. Voice will be generated verbatim — no paraphrasing at generation time.

## Claims verified against the product

- Reel 3 line 2 ("overdue" state): confirmed — the payments view flags overdue bookings against their payment deadline with a red count badge.
- Reel 2 line 3 (one click, fleet-wide): confirmed — MotorIQ has a single "Apply All AI Optimizations" action that pushes pricing across the fleet.

## Format (applies to all three)

- 1080×1920, ~28–30s, H.264, 30fps. Plus 4:5 (1080×1350) feed cuts with their own text layout — not a crop. Hook position, type size, and safe zones are re-laid for the feed frame so the hook never sits under the feed UI.
- No title card, no logo, no fade-in. Frame 1 is real UI mid-motion with hook text over it; Rari's first word lands by frame 15.
- Three text layers: hook text (big, short), Rari lines as burned-in captions (verbatim), payoff text (separate).
- Spoken CTA at ~24s, before the end card. End card: Instagram handle on top, exotiq.ai under it. Music rises.
- Music: dark minimal pulse, ducked ~12dB under Rari, up over the end card.
- Safe margins (9:16): bottom ~250px, top ~120px. Feed cut gets its own margins.
- Each Rari line is generated as its own audio clip, never one take per reel — exact caption sync, and any single flat line can be regenerated on its own.
- Launch order: 1) Double-booking killer, 2) Prices itself, 3) Money, not limbo.

## Locked copy

### Reel 1 — Double-booking killer
- Hook text: **Same car. Two renters. Saturday.** (first pick of three)
- Rari lines:
  1. You pull a car for service.
  2. I make it unbookable. Instantly.
  3. Calendar. Booking site. Your team's phones. One answer, every surface Exotiq runs.
  4. No apology call. No comped weekend.
  5. You never explain a conflict to a customer again.
  6. Comment TRUTH and I'll DM you the walkthrough.
- Payoff text: **One fleet. One truth.**
- Post caption: Pull a car, and it's gone from every booking surface at once. Comment TRUTH for the walkthrough.

### Reel 2 — Prices itself
- Hook text: **Same rate Tuesday and Saturday?**
- Rari lines:
  1. Race weekend? Convention in town? I already know.
  2. I price every car for the day it's actually in. Not the rate you set in March.
  3. You review. One click. The whole fleet moves.
  4. More per car. No spreadsheet. No late-night rate edits.
  5. Comment PRICE and I'll DM you the walkthrough.
- Payoff text: **Priced for today. Not last month.**
- Post caption: Your fleet priced for the weekend it's actually in. Comment PRICE for the walkthrough.

### Reel 3 — Money, not limbo
- Hook text: **Who still owes you a deposit?**
- Rari lines:
  1. Deposit. Balance. Hold. I tie every one to its booking.
  2. Paid, pending, overdue. You see which is which before the customer calls.
  3. Stripe underneath. Every charge is real money, not a note in a spreadsheet.
  4. No chasing. No guessing. No limbo.
  5. Comment MONEY and I'll DM you the whole flow.
- Payoff text: **Money. Not limbo.**
- Post caption: Every deposit, balance and hold tied to its booking. Comment MONEY for the walkthrough.

## Production steps

1. Generate one audio clip per Rari line, verbatim (voice ID `lcMyyd2HUfFzxdCaC4Ta`), measure each clip, lay the timeline to those measurements. Any weak read gets regenerated in isolation.
2. Build the 1080×1920 Remotion compositions (reel components reframed for vertical) alongside the untouched overview video.
3. Source the music bed and mix with ducking keyed to narration segment timings.
4. Reuse existing UI captures; re-capture vertically only where a crop fails (fleet status flip, MotorIQ pricing, payments).
5. Build separate 1080×1350 compositions with their own text layout and safe zones, sharing the same audio and captures.
6. Render 3 MP4s + 3 feed cuts to `/mnt/documents/`, verify with ffprobe, and check each plays muted with captions alone.

## Open items (flagged, not blocking)

- **Instagram handle** for the end card — I have exotiq.ai for the domain but not the handle. Placeholder is `@exotiq.ai`; send the real one before render.
- **DM automation.** "Comment X and I'll DM you" promises a fast reply. If no automation or responder is live at launch, the spoken and on-screen CTA becomes "Link in bio" — one line per reel, changed before rendering.

## Technical details

- New Remotion compositions at 1080×1920 and 1080×1350; existing `main` composition untouched.
- Voice mp3 clips under `remotion/public/audio/reels/`; music as a separate track with a volume envelope.
- No app codebase changes — all work sits in `remotion/` plus generated assets.
