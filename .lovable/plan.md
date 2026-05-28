
# Pricing Overhaul — Build Plan (Stripe ✅)

New live Stripe IDs confirmed:

| Tier | Product | Monthly | Annual |
|---|---|---|---|
| **Pro** | `prod_Ub7IM2Skj93HFS` | `price_1Tbv4IHO7nC3pJiPH4EbyVlL` ($39) | `price_1Tbv4JHO7nC3pJiPqaBeoyAX` ($390) |
| **Business** | `prod_Ub7IlYXU1diSY8` | `price_1Tbv4KHO7nC3pJiPC5emMKgJ` ($29) | `price_1Tbv4LHO7nC3pJiParUQCB7y` ($290) |

Old 4-tier products still active in Stripe — I'll archive at the end (no live subs to break).

## 1. Edge functions

**`create-checkout-session`**
- Replace `STRIPE_PRICES` with the 4 new IDs; delete `STRIPE_OVERAGE_PRICES` and `TIER_CONFIG`.
- Validate `tierId ∈ {pro, business}` and fleet-size bounds (pro 1–15, business 16–50, >50 → 400 with "contact sales").
- Single line item: `{ price, quantity: fleetSize }` (true per-vehicle).
- Add `subscription_data.trial_period_days: 14`; drop `payment_method_collection: 'always'` so signup doesn't need a card.
- Keep success/cancel URL logic.

**`check-subscription`**
- Update `PRODUCT_TIERS` to the 2 new product IDs.
- Keep legacy IDs mapped (Starter+Pro → pro, Business+Enterprise → business) so any test subs still resolve cleanly.

## 2. Landing pricing — `src/components/landing/pricing/`

- **PricingData.ts** — rewrite `pricingTiers` to Pro / Business / Enterprise (per the handoff doc, "all features included"); refresh `STRIPE_PRICES`; FAQ rewritten for $39 / $29 / 14-day trial / no CC; ROI defaults to `avgDailyRate: 1500`, `avgUtilization: 52`, `revenueIncreasePercent: 18`. Delete `founderDeadline` / `founderSpotsRemaining`.
- **PricingCards.tsx** — 2 paid cards + Enterprise "Contact Sales" card (Calendly link). Pro = "Most Popular".
- **PlanSelectionModal.tsx** — auto-pick tier from fleet size; >50 → demo redirect; remove overage math; "14-day free trial — no credit card required" subline.
- **ROICalculator.tsx** — new per-vehicle math ($39 / $29), payback < 1 mo, new bracket logic (≤15 pro, ≤50 business, else enterprise).
- **FeatureComparison.tsx** — one "Included in all plans" list; differentiate only on support / locations / marketplace / onboarding.
- **FounderBanner.tsx** — remove countdown + spot counter; replace with "Launch pricing — rates increase in 2027. Lock in today."
- **PricingSection.tsx** (legacy `LandingData.pricingPlans`) — repoint to `pricingTiers` so it stops showing the old 4 tiers.

## 3. Settings → Billing (new — based on your screenshot)

`src/components/dashboard/settings/SubscriptionSection.tsx`:
- Render the new 3-tier grid (Pro / Business / Enterprise) from the same `pricingTiers` source. Once `PricingData.ts` is rewritten the grid auto-updates, but I'll also:
  - Keep the Monthly / Annual toggle with "Save 2mo" pill.
  - Show **current plan** highlight + "Your Plan" badge based on `check-subscription` result.
  - Replace "Get Started" CTA with context-aware action:
    - Not subscribed → "Start 14-day trial" → invokes `create-checkout-session`.
    - On trial → "Subscribe now" (skips trial param if already used).
    - Active sub same tier → disabled "Current plan".
    - Active sub different tier → "Switch to Pro/Business" → calls new edge function `switch-subscription` that does `stripe.subscriptions.update` with proration (`create_prorations`), updating both price and quantity to the new fleet size.
  - Enterprise card → "Contact sales" (Calendly).
- Add a small **trial status strip** at the top of the section: "Trial: 9 days left — subscribe to keep full access" when applicable, "Grandfathered — no trial limit" for legacy teams (per your decision).
- Surface "Manage billing" → existing `customer-portal` for invoices / cards / cancel.
- Quantity-aware copy: "Billed for N vehicles" computed from `useFleet().length` (or `subscription.items[0].quantity`).

## 4. Trial + soft paywall

- Migration: add `trial_start` (default `now()`), `trial_end` (default `now() + 14 days`) to `teams`. **Backfill existing teams with NULL** so they stay grandfathered (per your call).
- `AuthContext` / subscription state exposes `trialExpired` and `isReadOnly` (= no active sub AND `trial_end IS NOT NULL` AND past).
- Persistent banner when `isReadOnly`: "Trial ended — subscribe to unlock writes." with CTA → Billing.
- Gate write CTAs in: EnhancedBookingDialog, AI pricing actions, payment recording, marketplace listing toggle, vehicle create/edit. Reads stay open.

## 5. Cleanup

- Archive old Stripe products (`prod_Tf6*`, `prod_Tf3W*`, `prod_UIcR*` style) + their prices via Stripe API after a smoke check.
- Delete `PRICING_SYSTEM_PROMPT.md`; update `STRIPE_TODO.md` with the new IDs.
- Update memory: `mem://integrations/stripe-subscription-logic` to the new 3-tier per-vehicle model.

## Order of operations

1. Migration: trial columns (grandfather existing).
2. Update both edge functions; deploy.
3. Rewrite `PricingData.ts` (everything else cascades from this).
4. Update landing pricing components + `PricingSection.tsx`.
5. Update `SubscriptionSection.tsx` (Settings → Billing) + add `switch-subscription` edge function.
6. Wire AuthContext + read-only banner + write CTA guards.
7. Smoke check via Stripe test mode (start trial, switch tier, expire trial).
8. Archive old Stripe products/prices + docs cleanup + memory update.

Approve and I'll execute.
