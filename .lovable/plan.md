
# Pricing Overhaul Plan

Based on the GitHub handoff doc `LOVABLE_PRICING_RESTRUCTURE.md`. Goal: collapse the current 4-tier hybrid (Starter / Pro / Business / Enterprise) into **Pro / Business / Enterprise (contact)**, all features included, per-vehicle pricing, 14-day no-CC trial, soft paywall after.

## New Model

| | Pro | Business | Enterprise |
|---|---|---|---|
| Fleet | 1–15 | 16–50 | 51+ |
| Monthly | $39/veh | $29/veh | Custom |
| Annual | $390/veh (2 mo free) | $290/veh (2 mo free) | Custom |
| Features | All included | All + priority support, 5 locs, white-glove | All + custom AI, API, dedicated CSM |

## Execution Steps

### 1. Stripe (live mode)
- Create **Exotiq Pro** product with 2 per-seat prices: monthly $39 (3900), annual $390 (39000).
- Create **Exotiq Business** product with 2 per-seat prices: monthly $29 (2900), annual $290 (29000).
- Archive the 4 old products + 8 old prices (`prod_UIcR*`, `price_1Shm*`). Don't delete — preserves existing subs.

### 2. Frontend — `src/components/landing/pricing/`
- **PricingData.ts**: replace `pricingTiers` array with Pro/Business/Enterprise per doc; new `STRIPE_PRICES` map; updated FAQ + ROI defaults (avgDailyRate 1500, util 52%, +18% revenue).
- **PricingCards.tsx**: render 2 paid cards + Enterprise "Contact Sales" card (Calendly). Pro flagged "Most Popular".
- **PlanSelectionModal.tsx**: auto-pick tier from fleetSize (>50 → demo redirect), drop overage/min-price math, show "14-day free trial — no credit card required".
- **ROICalculator.tsx**: use $39/$29 per vehicle, new defaults, show payback <1 mo.
- **FeatureComparison.tsx**: single "Included in all plans" list; differentiate only on support/locations/marketplace/onboarding.
- **FounderBanner.tsx**: remove countdown; replace with "Launch pricing — rates increase in 2027".
- Delete obsolete constants (`founderDeadline`, spot counters).

### 3. Edge functions
- **`create-checkout-session`**: replace `STRIPE_PRICES`, remove `STRIPE_OVERAGE_PRICES`/`TIER_CONFIG`, validate tier ∈ {pro,business} + fleet-size bounds, line item = `{price, quantity: fleetSize}`, add `subscription_data.trial_period_days: 14`.
- **`check-subscription`**: update `PRODUCT_TIERS` map to new prod IDs; keep old IDs mapped (Starter+Pro→pro, Business+Enterprise→business) for migration grace.

### 4. Trial + Soft Paywall
- Signup: no CC required (already current behavior). Persist `trial_start` / `trial_end` on `teams` (add columns if missing) at team creation — default 14 days.
- `AuthContext` / subscription state: expose `trialExpired` + `isReadOnly` (= no active sub AND trial past end).
- Gate write actions: new `ReadOnlyGuard` wrapper + disable CTAs in BookingDialog, AI pricing actions, payment recording, marketplace listing toggle, vehicle create/edit. Reads stay open.
- Persistent banner when read-only: "Trial ended — subscribe to unlock writes."

### 5. Cleanup
- Delete/rewrite `PRICING_SYSTEM_PROMPT.md` (old 4-tier model).
- Update `STRIPE_TODO.md` to reflect new product IDs.

## Open Questions / Risks
1. **Existing live subs** on old prices: none yet on live (per earlier debug, only test charges) — confirm before archive? I'll assume safe to archive after creating new prices.
2. **Soft paywall scope**: doc lists which actions to block; I'll instrument the highest-impact ones (bookings, AI pricing, payments, marketplace, vehicle writes). Other writes can fall back to a generic guard.
3. **Trial columns**: if `teams.trial_start/trial_end` don't exist, I'll add via migration + backfill existing teams with `trial_end = created_at + 14d` (already-expired teams without a sub become read-only immediately — flag if you'd rather grandfather them).

## Order of Operations
1. Create new Stripe products/prices (capture IDs).
2. Schema migration for trial columns (if needed).
3. Update edge functions with new IDs.
4. Update frontend pricing components.
5. Wire soft paywall + read-only banner.
6. Archive old Stripe products.
7. Delete old docs.

Reply with: (a) confirm safe to archive old Stripe objects, (b) whether to grandfather existing teams past 14 days, and I'll execute.
