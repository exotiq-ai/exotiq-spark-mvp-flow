# Rebuild Reel 1: Mobile-First Proof, No Desktop Crops

## What the audit confirmed
- The previous renderer force-filled 1920×1080 desktop screenshots into a portrait window. That crop method is rejected.
- The live product already has a native phone layout: single-column Fleet cards, a full-width Maintenance sheet, and a full-screen New Booking flow.
- At phone size, the Maintenance sheet clearly shows the vehicle, **Out of Service** switch, and “Blocks this vehicle from new bookings” explanation without zooming.
- The New Booking flow is readable at phone size and can show an unavailable vehicle after dates are selected.
- The current demo data has a readable Lamborghini Fleet card, but no matching Lamborghini maintenance record. Production therefore needs isolated, disposable demo proof data before capture.

## Objective
Rebuild only Reel 1 as a 25–28 second, 1080×1920 social ad. Every product shot uses Exotiq’s actual mobile layout and keeps the entire phone screen visible. A cold viewer must understand “car unavailable → booking blocked” by 0:02, muted or with sound.

## Revised cold-audience script
Each line is generated as a separate Rari clip.

1. **“Car down Friday. Saturday booking blocked.”**
2. **“That’s Exotiq stopping the apology call before it starts.”**
3. **“I’m Rari, Exotiq’s AI fleet manager.”**
4. **“Mark the Lamborghini Out of Service once. I carry that status into your fleet and booking flow.”**
5. **“Your team sees one answer, and the car can’t be selected for those dates.”**
6. **“No double-booking. No comped weekend.”**
7. **“Comment TRUTH and I’ll send you the walkthrough.”**

**Frame-one hook text**

> CAR DOWN FRIDAY.
> SATURDAY BOOKING BLOCKED.

**Payoff text**

> ONE FLEET. ONE TRUTH.

**Identity**

> @exotiq_ai
> exotiq.ai

## Mobile capture system
1. Use Playwright at a fixed 9:16 mobile viewport that stays below Exotiq’s desktop breakpoint. Capture at 2× pixel density for a native 1080×1920 source.
2. Record the real mobile interactions—not desktop screens and not simulated desktop crops.
3. Keep the full phone viewport in every Remotion scene with `contain`, never `cover`. No crop rectangle, artificial pan, or full-height desktop screenshot is allowed.
4. Remove cookie prompts and unrelated overlays before recording. Keep the Exotiq header, vehicle identity, dates, control, and status visible.
5. Use only small editorial callouts outside the phone content. Never enlarge the interface until surrounding context disappears.
6. Use hard cuts and match cuts between complete phone screens. Do not animate one screenshot for the whole reel.

## Proof data setup
- First verify the capture account is an isolated demo/staging tenant.
- Add one disposable Lamborghini work order and a Saturday date window only in that isolated environment.
- Use the same Lamborghini, Friday outage, and Saturday booking dates across every screen.
- Capture the before/after states, then remove the temporary work order and booking data after rendering.
- If the account cannot be proven isolated, stop rather than touching live tenant data.

## Shot plan
| Time | Full-screen mobile picture | Message |
|---|---|---|
| 0.0–2.0s | Fast match cut: full mobile Maintenance sheet shows **Out of Service ON**; full mobile New Booking screen immediately shows the same Lamborghini disabled for Saturday. Both screens retain the Exotiq header and vehicle identity. | **CAR DOWN FRIDAY.** / **SATURDAY BOOKING BLOCKED.** |
| 2.0–4.5s | Hold the disabled Saturday booking choice long enough to read it; no zoom. | **EXOTIQ BLOCKED IT** |
| 4.5–6.5s | Full phone screen establishes Rari inside Exotiq, then returns directly to the proof flow. | **Rari · AI fleet manager** |
| 6.5–11.0s | Replay the real mobile interaction: open the Lamborghini work order and turn on **Out of Service**. Show the explanatory copy and confirmed state. | **MARK IT ONCE** |
| 11.0–15.0s | Full mobile Fleet page filtered to that Lamborghini, with its Out of Service status readable in the card. | **FLEET UPDATED** |
| 15.0–20.0s | Full mobile New Booking flow with Saturday dates selected; open Vehicle and show the same Lamborghini disabled and unselectable. | **BOOKING BLOCKED** |
| 20.0–24.0s | Three quick full-screen match cuts: Maintenance switch → Fleet status → disabled booking choice. | **ONE STATUS. ONE ANSWER.** |
| 24.0–27.0s | Product remains visible behind payoff and CTA; compact handle lockup appears last. | **NO APOLOGY CALL.** / **COMMENT TRUTH** / **@exotiq_ai** |

## Build and verification sequence
1. Create the isolated proof data and capture still reference frames from all three mobile states.
2. Review those frames at actual phone display size. Reject and recapture any frame where the vehicle, date, status, or disabled state is not readable without zooming.
3. Capture the real mobile interaction clips and assemble a **silent proof cut** with no voice, music, or decorative transitions.
4. Export the silent cut and inspect frames at 0:00, 0:01, 0:02, 0:08, 0:13, 0:18, and 0:24. Also review the video scaled to a 390-pixel-wide phone viewport.
5. Only after the silent cut passes, generate the seven separate Rari clips, add verbatim captions, and mix a restrained music bed ducked beneath narration.
6. Render the final 9:16 MP4, verify dimensions/duration/decoding, inspect a contact sheet, and watch it once muted and once with sound before delivery.
7. Build a separately laid-out 4:5 version only after the 9:16 reel is approved.

## Non-negotiable acceptance tests
- **No-crop test:** the complete mobile viewport remains visible in every proof shot; no desktop screenshot is present.
- **Two-second test:** by 0:02, a cold viewer can say, “The car went down and Exotiq blocked Saturday’s booking.”
- **Phone test:** the Lamborghini name, Saturday date, Out of Service state, and disabled choice are readable at 390-pixel display width.
- **Continuity test:** all proof screens use the same vehicle and dates.
- **Claim test:** every spoken claim is visible in the real product at the moment it is said.
- **Muted test:** the story works without Rari or music.
- **Retention test:** a meaningful real product action or state changes every 1–2 seconds.

## Scope
- Rebuild Reel 1 only; Reels 2 and 3 remain paused.
- Preserve the approved Rari voice, Comment TRUTH mechanism, `@exotiq_ai`, and `exotiq.ai`.
- Use only Exotiq-controlled surfaces; make no Turo or external-channel claim.
- Make no application-source changes for the reel.
- Do not reuse the failed reel’s screenshot, crop component, timing, or edit.