# Clean up the app.exotiq.ai home page

Turn the signed-out home page into a clean, honest, conversion-focused story: real product video instead of a fake demo link, no invented customers, no launch-hype bars, brand typography throughout, and no gradient decoration.

## 1. Real video where the play button is

- Replace the "Try the interactive demo" text link (it currently just sends people to the login screen — a dead promise) with a real player showing the 78-second narrated platform overview.
- The player sits directly under the hero buttons: a wide rounded frame with a still image from the video, a single centered play button and the label "Watch the 78-second tour". Clicking plays in place with sound and normal video controls; on small screens it opens full width.
- The video file is 40 MB, too heavy to ship inside the app bundle, so it gets uploaded to our own media storage and streamed from there. A still frame is captured for the poster image so nothing looks blank before play.
- Muted autoplay is deliberately not used — the narration is the value.

## 2. Remove the launch-hype elements

- Delete the "Launching now in Denver, Scottsdale, and Miami — Join the movement!" line from the hero.
- Delete the sticky black "Launch pricing · lock in your rate" bar above pricing.
- Pricing keeps its own honest line: launch pricing, 30-day free trial, card required, nothing charged for 30 days.

## 3. Remove the invented customer quotes

- Remove the three placeholder testimonials and the "Testimonials" nav links (desktop and mobile).
- In their place, a short factual proof section that only states what the product actually does: AI pricing that recounts every renewal, out-of-service cars that never get double-booked, payments and payouts tracked through Stripe, one command center across locations. No numbers we cannot stand behind.
- The section is written so real quotes can drop straight in when you have them.

## 4. Typography and gradient cleanup

- Headings use the brand font Dfaalt everywhere on the page; body copy uses Montserrat. Both are already installed, so nothing needs uploading.
- Remove the gradient text on the headline ("Minimize Effort.") and set it in solid brand color.
- Remove the decorative background gradient blobs behind the hero and the gradient washes on the trial banner, ROI section and final call-to-action; those become flat surfaces with a single quiet accent.
- Tighten the heading scale so the page reads as one system rather than three sizes competing.

## 5. Conversion and story pass over the whole page

- One primary action, repeated: "Start free trial". "Schedule demo" stays as the quieter second option. Removing the third competing demo link makes the choice obvious.
- Hero subheadline states plainly who this is for: operators renting out exotic and luxury cars.
- Fix the "Explore All Features" button, which currently links back to the section it already sits in. It becomes a real jump to pricing, or is removed if the section already says enough.
- The six module cards get one concrete outcome line each instead of a two-word label, so a stranger understands the product without a call.
- Page order becomes: hero and video, what it does, proof, pricing, questions, final call to action.
- Update the page title and description so search results describe the product, not generic AI language.

## Things I want to flag

- **The ROI calculator makes strong money claims.** It is the single biggest legal and credibility risk on the page. I would move it below pricing and add a plain "estimate, not a guarantee" line. Say the word if you want it removed instead.
- **"Six Intelligent Modules"** is internal language. Renters and operators don't know what Pulse or Vault mean. I plan to keep the names but lead each with what it does.
- **Marketing page overlap.** Since exotiq.ai is the real marketing site, this page should stay short and factual and never drift into a second marketing site. I am keeping it to one screen of story plus pricing.
- **No screenshots of the product anywhere on the page.** The video helps, but two or three real interface stills would raise trust a lot. I can capture them from a live account if you want that added.

## Technical notes

- Files touched: `HeroSection.tsx` (video, hero copy, gradients), new `HomeVideo.tsx` player, `Landing.tsx` (section order, SEO), `Navigation.tsx` (remove testimonials link), `FeaturesSection.tsx` (copy, CTA fix), delete usage of `TestimonialsSection.tsx` and `testimonials` in `LandingData.ts`, `PricingSectionNew.tsx` (drop `FounderBanner`), `FreeTrialBanner.tsx` / `ROICalculator.tsx` / `FinalCTA.tsx` (de-gradient).
- Video hosted in a public Cloud storage bucket (`marketing-media`), served with `preload="none"` and a poster JPEG in `src/assets` so the page stays fast. Source file: `exotiq-platform-overview.mp4`.
- The content security policy in `index.html` currently limits video sources; the storage origin is already allowed, so no policy change is expected. If it turns out to block playback, that one line gets the storage host added.
- Typography enforced via existing `font-brand` / `font-body` tokens, no new font loading.
- No backend, billing or booking logic is touched.
