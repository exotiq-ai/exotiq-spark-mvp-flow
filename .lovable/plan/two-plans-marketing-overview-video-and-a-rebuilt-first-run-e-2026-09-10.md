# Two plans: marketing overview video, and a rebuilt first-run experience

---

# Plan A — 80-second "Command Center" sales video

A fast-paced, narrated overview for the marketing front page. Not a how-to: it sells the outcome (more bookings, better rates, fewer mistakes) and only shows enough screen to make it real.

## Story beats

| # | Beat | On screen | Approx. |
|---|------|-----------|---------|
| 1 | Cold open | Exotiq lockup, one line: "Run your exotic rental business from one screen." | 0:00-0:05 |
| 2 | The problem | Fast montage: spreadsheets, three booking tabs, a missed message — resolved into the dashboard | 0:05-0:14 |
| 3 | Fleet | Fleet grid, live status chips (On Rental, Returning Today, Out of Service), a hero photo card | 0:14-0:28 |
| 4 | Bookings | Calendar month view, a booking created, conflict ring preventing a double-book | 0:28-0:42 |
| 5 | Demand + pricing | Event demand data, MotorIQ rate suggestion accepted, rate updates across the fleet | 0:42-0:56 |
| 6 | Customers | CRM profile, lifetime value, history at a glance | 0:56-1:05 |
| 7 | Get paid | Stripe payment link sent, payment captured, payout confirmation — 3 quick cuts | 1:05-1:14 |
| 8 | Close | Rari line + "Exotiq. Your entire operation, in command." + URL | 1:14-1:20 |

Narration is short and benefit-led — one sentence per beat, no feature lists.

## How it gets made

1. **Capture** — a Playwright script signs into the demo workspace and records each beat as a numbered PNG frame sequence at 1920x1080. Demo fleet only, no production tenant data.
2. **Narration** — Rari voice (same Lucy voice as in-app), one clip per beat, with the existing pronunciation fixes (Exotique, Rarri, Motor I.Q.).
3. **Assembly** — a Remotion project under `remotion/` composes frames into scenes: quick cuts on the beat, subtle push-ins so nothing sits static, highlight rings on the one thing being talked about, burned-in captions, Exotiq title and end cards. Scene lengths driven by the measured audio length of each narration clip.
4. **Render** — H.264 1920x1080 30fps MP4 to `/mnt/documents/`, audio muxed in with ffmpeg.
5. **Deliverables** — the narrated MP4, plus a muted captions-only cut suitable for autoplay in the front-page hero. Embedding it on the marketing page is a follow-up once you approve the cut.

---

# Plan B — First-run experience rebuild

## What is wrong today

- **The tour stumbles on skip.** Pressing skip stops the audio but does not cancel the chapter that is still running in the background. That old chapter keeps going, so two chapters advance at once — you see the jump and the double narration.
- **"Skip, I'll set up myself" does not stick.** It only flips a value in the current page, so nothing is remembered. Reload and the welcome screen is back, tour un-started, checklist gone.
- **The signup steps stop too early.** New customers are asked for business profile and vehicles, then dropped on the dashboard. Tax rates, locations, payout setup, photos and policies all live in Settings, so nobody finishes them and accounts arrive at the marketplace half-ready.
- **The checklist is not honest.** "Set up your team" is hard-coded as never done, so the list can never reach complete.

## What best-in-class looks like, applied here

1. **Nothing is a dead end.** Every step has Skip, Back and a visible "Step 3 of 5". Skipping never loses the step — it moves to the checklist.
2. **Progress is saved server-side.** Close the laptop mid-signup, sign in on your phone, resume on the same step.
3. **One clear goal, not a chore list.** The goal is "ready to take bookings", then "ready for Drive Exotiq".
4. **Show value before asking for work.** A short interactive preview with prefilled sample data first; the real setup comes after.
5. **Ask for the least possible up front.** Everything else is offered later, in context, at the moment it matters.

## New flow

**Guided setup (all steps skippable, progress saved):**

1. **Business** — name, logo, contact email, currency/timezone.
2. **Location & tax** — first pickup location with its address, tax rate, tax label and whether prices include tax. Sensible defaults suggested from the address.
3. **Fleet** — CSV import, add from photos, add one manually, or skip.
4. **Getting paid** — connect Stripe, or skip and be reminded.
5. **You're set** — lands on the dashboard with the readiness meter.

**Readiness meter on the dashboard** — a single visible score ("Booking ready 4/6 · Marketplace ready 6/9") built from the checks the system already runs: business name, address, logo, owner email, terms accepted, Stripe charges and payouts, at least one publish-ready vehicle, photos, rates, pickup location. Each unfinished item is a one-click jump to exactly the field that fills it. The meter disappears once everything is green.

**The tour becomes optional and reliable** — skip and back work cleanly per chapter, chapter list is visible so you can jump, and the choice (took it / skipped it) is remembered on the account.

## Technical notes

- Add a run token to the tour player so a skipped chapter is genuinely cancelled before the next one starts; make Back symmetrical with Skip; expose the chapter list for direct jumps.
- Persist tour state and "set up myself" on the profile (`tour_completed` plus a new dismissal field), not in page state.
- Extend the existing onboarding progress record to cover the two new steps; keep the resume-on-load behaviour that already works.
- Reuse the location tax fields shipped for Sharp Exotics and the existing `get_marketplace_readiness` check set — no new readiness logic, just a customer-facing view of it with deep links.
- Fix the checklist's team step to reflect real invited members.
- Everything is additive and behind the existing feature-flag pattern so live tenants are unaffected until it is switched on.

## Sequencing

Plan A can be produced independently. Plan B is best done in two passes: first the reliability fixes (skip/back, persistence, broken links), then the new steps and the readiness meter.

## Open question for later

Whether existing tenants should also see the readiness meter (recommended — it is how you get current accounts marketplace-ready), or new signups only.
