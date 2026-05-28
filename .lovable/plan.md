# Update Public Pricing Page to New 3-Tier Launch Pricing

The screenshot is the pre-login pricing page (`/` → `PricingSectionNew`). The 3-tier cards (`Pro / Business / Enterprise`) are already wired up in `PricingData.ts` and `PricingCards.tsx`, but several surrounding components still render the old "Founder Pricing" framing (countdown, "73 of 250 spots", "Lock in founder rates"). This plan removes that stale copy and aligns the rest of the page with the new model.

## Changes

### 1. `PricingSectionNew.tsx` (hero copy)
- Replace headline subtext "Lock in founder rates today. Your price stays the same forever..." with launch-pricing wording (e.g. "Simple per-vehicle pricing. 14-day free trial — no credit card required.").
- Keep `<FounderBanner />` mounted (it's already rewritten to "Launch pricing · From $29/vehicle/mo").

### 2. `FinalCTA.tsx`
- Remove the `founderSpotsRemaining / founderSpotsTotal` chip (currently "Only 0 of 0 founder spots remaining").
- Change primary CTA label "Lock in Founder Pricing" → "Start Free Trial".
- Drop the `founderSpots*` imports.

### 3. `PricingGuarantee.tsx`
- Reword the "Price lock" guarantee: replace "Your founder rate never increases..." with "Your per-vehicle rate is locked for the lifetime of your subscription. Planned increases only apply to new customers."

### 4. `PricingData.ts` cleanup
- Delete the legacy `founderDeadline`, `founderSpotsTotal`, `founderSpotsRemaining` exports (no remaining consumers after step 2).
- Remove the unused `overageRate` field from `PricingTier`.

### 5. `PricingFAQ.tsx` / `FreeTrialBanner.tsx` sanity pass
- Read both and strip any remaining "founder" / "spots" / "Starter / Professional" wording. Update to Pro / Business / Enterprise where needed.

### 6. Optional rename
- Rename `FounderBanner.tsx` → `LaunchPricingBanner.tsx` and update the import in `PricingSectionNew.tsx`. (Cosmetic — file currently renders launch-pricing copy under the old name.)

## Out of scope
- No Stripe price changes — IDs in `PricingData.STRIPE_PRICES` are already the new live prices.
- No changes to in-app `Settings → Billing` (already on new tiers).
- No DB / edge function changes.

## Verification
- Load `/#pricing-cards` in preview at desktop + mobile widths; confirm: no countdown, no "spots remaining", 3 cards (Pro / Business / Enterprise), monthly/annual toggle still works, Final CTA reads "Start Free Trial", FAQ + Guarantee copy reads cleanly.
- `rg -n "founder|Founder|Starter|Professional|spots" src/components/landing` returns no user-visible matches.
