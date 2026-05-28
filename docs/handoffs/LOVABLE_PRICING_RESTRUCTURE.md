# Lovable Handoff — Pricing Restructure

**Document Type:** Implementation Handoff  
**Date:** May 28, 2026  
**For:** Lovable (Command Center / app.exotiq.ai)  
**Priority:** HIGH — Must complete before first customer charges

---

## Summary

We are restructuring Exotiq's pricing from a 4-tier hybrid model to a simplified 2-tier + Enterprise model. This change affects the pricing page, Stripe products/prices, checkout flow, subscription verification, and ROI calculators.

---

## New Pricing Model

### The Tiers

| | **Pro** | **Business** | **Enterprise** |
|---|---------|------------|---------------|
| **Fleet size** | 1-15 vehicles | 16-50 vehicles | 51+ vehicles |
| **Monthly** | $39/vehicle/mo | $29/vehicle/mo | Custom (contact sales) |
| **Annual** | $390/vehicle/yr (2 months free) | $290/vehicle/yr (2 months free) | Custom |
| **Features** | All features included | All features included | All features + custom AI + API |
| **Support** | Chat (24hr response) | Priority chat + phone | Dedicated success manager |
| **Locations** | Up to 2 | Up to 5 | Unlimited |
| **Marketplace** | Drive Exotiq listing | Featured listing | Premium placement + priority leads |
| **Onboarding** | Self-serve + video guides | White-glove migration | Custom setup + training |
| **Stripe Connect** | Included | Included | Included |
| **AI (MotorIQ)** | Full suite | Full suite | Full suite + custom model training |

### Key Principles

- **All features included on both paid tiers** — no feature gates
- **Per-vehicle pricing** — scales naturally, no cliffs, no overage fees
- **Volume discount is automatic** — more cars = lower per-vehicle rate
- **Enterprise is "Contact Us"** — no public price, custom quote
- **Annual = pay for 10 months, get 12** (2 months free)
- **14-day free trial, no credit card required** — full access during trial
- **After trial: soft paywall (read-only)** — data stays, features locked until payment

### Pricing Psychology

- Only 2 real choices (eliminates decision paralysis)
- 15-vehicle breakpoint matches natural market segmentation (solo operator vs growing fleet)
- Per-vehicle model is simple mental math for the buyer
- "All features included" removes fear of missing out
- Enterprise validates that big operators exist (social proof) without cluttering the decision

---

## Stripe Changes Required

### Archive Old Products/Prices

The following existing Stripe objects should be **archived** (not deleted, in case any active subscriptions reference them):

**Old Products:**
- `prod_UIcRqJzc9qC0zh` (Starter)
- `prod_UIcRHKBhWSyMO6` (Professional)
- `prod_UIcR8tFUKCjx7i` (Business)
- `prod_UIcRnSPmFfcwWH` (Enterprise)

**Old Prices (8 total):**
- `price_1ShmMlHO7nC3pJiPxcbd7vlL` (Starter monthly)
- `price_1ShmRHHO7nC3pJiPtU6o3AMC` (Starter annual)
- `price_1ShmMmHO7nC3pJiPPYhhXT1o` (Professional monthly)
- `price_1ShmRJHO7nC3pJiP05J4DdvQ` (Professional annual)
- `price_1ShmMoHO7nC3pJiPzUH0wSP3` (Business monthly)
- `price_1ShmRKHO7nC3pJiPSxuuBWtO` (Business annual)
- `price_1ShmMqHO7nC3pJiPV04rgXRX` (Enterprise monthly)
- `price_1ShmRMHO7nC3pJiPYawYJ13O` (Enterprise annual)

### Create New Products and Prices

**Product 1: Exotiq Pro**
- Name: "Exotiq Pro"
- Description: "Fleet management for 1-15 vehicles. All features included."
- Create 2 prices:
  - Monthly: $39/unit, recurring monthly, per-vehicle (usage_type: licensed, unit_amount: 3900)
  - Annual: $390/unit, recurring yearly, per-vehicle (unit_amount: 39000)

**Product 2: Exotiq Business**
- Name: "Exotiq Business"
- Description: "Fleet management for 16-50 vehicles. All features included with priority support."
- Create 2 prices:
  - Monthly: $29/unit, recurring monthly, per-vehicle (unit_amount: 2900)
  - Annual: $290/unit, recurring yearly, per-vehicle (unit_amount: 29000)

**Total new Stripe objects:** 2 products, 4 prices.

### Important: Trial Configuration

When creating checkout sessions, add to `subscription_data`:
```typescript
subscription_data: {
  trial_period_days: 14,
  metadata: { tierId, fleetSize, isFounderPricing: 'true' }
}
```

This ensures the 14-day trial promise is actually honored in Stripe (currently missing from the code).

---

## Code Changes Required

### 1. Update `src/components/landing/pricing/PricingData.ts`

Replace the entire file with the new 2-tier model:

```typescript
export const STRIPE_PRICES = {
  pro: {
    monthly: 'price_NEW_PRO_MONTHLY_ID',   // Replace after creating in Stripe
    annual: 'price_NEW_PRO_ANNUAL_ID',
  },
  business: {
    monthly: 'price_NEW_BUSINESS_MONTHLY_ID',
    annual: 'price_NEW_BUSINESS_ANNUAL_ID',
  },
} as const;

export interface PricingTier {
  id: 'pro' | 'business' | 'enterprise';
  name: string;
  price: number;
  annualPrice: number;
  vehicleRange: string;
  maxVehicles: number;
  popular: boolean;
  isEnterprise: boolean;
  features: string[];
  support: string;
  locations: string;
  marketplace: string;
  onboarding: string;
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    annualPrice: 390,
    vehicleRange: '1-15 vehicles',
    maxVehicles: 15,
    popular: true,
    isEnterprise: false,
    features: [
      'Complete fleet dashboard',
      'MotorIQ AI pricing engine',
      'Booking calendar & CRM',
      'Document vault with alerts',
      'Stripe Connect payments',
      'Drive Exotiq marketplace listing',
      'Analytics & reports',
    ],
    support: 'Chat (24hr)',
    locations: 'Up to 2 locations',
    marketplace: 'Drive Exotiq listing',
    onboarding: 'Self-serve + video guides',
  },
  {
    id: 'business',
    name: 'Business',
    price: 29,
    annualPrice: 290,
    vehicleRange: '16-50 vehicles',
    maxVehicles: 50,
    popular: false,
    isEnterprise: false,
    features: [
      'Everything in Pro, plus:',
      'Priority chat + phone support',
      'Up to 5 locations',
      'Featured marketplace listing',
      'White-glove onboarding & migration',
      'Advanced analytics & exports',
      'Team roles & permissions',
    ],
    support: 'Priority + phone',
    locations: 'Up to 5 locations',
    marketplace: 'Featured listing',
    onboarding: 'White-glove migration',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    annualPrice: 0,
    vehicleRange: '51+ vehicles',
    maxVehicles: 999,
    popular: false,
    isEnterprise: true,
    features: [
      'Everything in Business, plus:',
      'Custom AI model training',
      'Unlimited locations',
      'Premium marketplace placement',
      'Dedicated success manager',
      'Custom integrations & API',
      'Quarterly business reviews',
      'Enterprise SLA (99.9%)',
    ],
    support: 'Dedicated (1hr)',
    locations: 'Unlimited',
    marketplace: 'Premium placement + priority leads',
    onboarding: 'Custom setup + training',
  },
];

export const faqItems = [
  {
    question: 'How does the 14-day free trial work?',
    answer: 'Sign up with just your email — no credit card required. You get full access to every feature for 14 days. Import your fleet, connect Stripe, list on the marketplace, and see AI pricing recommendations. After 14 days, your account switches to read-only until you subscribe. Your data is never deleted.',
  },
  {
    question: 'How does pricing work?',
    answer: 'Simple per-vehicle pricing. Pro is $39/vehicle/month for fleets of 1-15 vehicles. Business is $29/vehicle/month for 16-50 vehicles. All features are included on both plans — the only differences are support level, locations, and onboarding. Annual billing saves you 2 months (pay for 10, get 12).',
  },
  {
    question: 'What if I have more than 50 vehicles?',
    answer: 'Contact us for Enterprise pricing. We offer custom rates, dedicated support, custom AI model training, and unlimited everything. Most Enterprise customers pay less per vehicle than Business tier.',
  },
  {
    question: 'Are all features included?',
    answer: 'Yes. MotorIQ AI pricing, booking calendar, CRM, document vault, Stripe Connect payments, Drive Exotiq marketplace listing, and analytics are all included on every paid plan. We don\'t gate features behind higher tiers.',
  },
  {
    question: 'What happens after the trial?',
    answer: 'Your account switches to read-only mode. You can still view your fleet, bookings, and data — but you can\'t create new bookings, process payments, or use AI pricing until you subscribe. Your data is never deleted, so you can pick up right where you left off.',
  },
  {
    question: 'Can I switch plans?',
    answer: 'Yes. If your fleet grows past 15 vehicles, you automatically qualify for the lower Business rate. Upgrades and downgrades take effect at your next billing cycle.',
  },
  {
    question: 'Is there a setup fee?',
    answer: 'No setup fees on Pro. Business tier includes white-glove onboarding and data migration at no extra cost. Enterprise includes custom training and setup.',
  },
  {
    question: 'What about the Drive Exotiq marketplace?',
    answer: 'Every paid account gets listed on Drive Exotiq (exotiq.rent), our renter-facing booking platform. Business and Enterprise plans get featured placement, meaning your vehicles appear higher in search results and get priority lead routing.',
  },
];

export const roiDefaults = {
  avgDailyRate: 1500,
  avgUtilization: 52,
  revenueIncreasePercent: 18,
  avgMaintenanceCostPerVehicle: 8000,
  maintenanceSavingsPercent: 25,
};
```

### 2. Update `supabase/functions/create-checkout-session/index.ts`

Major changes:
- Replace STRIPE_PRICES with new price IDs
- Remove STRIPE_OVERAGE_PRICES (no more overages)
- Remove TIER_CONFIG complexity
- Simplify to: quantity = fleet size, price = selected tier's price
- ADD `trial_period_days: 14` to subscription_data
- Remove old tier-specific logic (minPrice, perVehicleRate, overage calculation)

New logic:
```typescript
const STRIPE_PRICES = {
  pro: {
    monthly: 'price_NEW_PRO_MONTHLY_ID',
    annual: 'price_NEW_PRO_ANNUAL_ID',
  },
  business: {
    monthly: 'price_NEW_BUSINESS_MONTHLY_ID',
    annual: 'price_NEW_BUSINESS_ANNUAL_ID',
  },
};

// Validate tier
if (!['pro', 'business'].includes(tierId)) {
  throw new Error(`Invalid tier: ${tierId}. Use 'pro' or 'business'.`);
}

// Validate fleet size
if (tierId === 'pro' && fleetSize > 15) {
  throw new Error('Pro tier supports up to 15 vehicles. Please select Business tier.');
}
if (tierId === 'business' && (fleetSize < 16 || fleetSize > 50)) {
  throw new Error('Business tier supports 16-50 vehicles.');
}

const priceId = isAnnual
  ? STRIPE_PRICES[tierId].annual
  : STRIPE_PRICES[tierId].monthly;

const lineItems = [{
  price: priceId,
  quantity: fleetSize,
}];

// Create session with trial
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  customer_email: customerId ? undefined : customerEmail,
  line_items: lineItems,
  mode: "subscription",
  subscription_data: {
    trial_period_days: 14,
    metadata: {
      tierId,
      fleetSize: String(fleetSize),
      isFounderPricing: 'true',
    },
  },
  success_url: `${origin}${returnPath || '/welcome'}?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}${cancelPath || '/pricing?cancelled=true'}`,
  allow_promotion_codes: true,
});
```

### 3. Update `supabase/functions/check-subscription/index.ts`

Update the PRODUCT_TIERS mapping to use new product IDs:
```typescript
const PRODUCT_TIERS: Record<string, { tier: string; name: string }> = {
  'prod_NEW_PRO_ID': { tier: 'pro', name: 'Pro' },
  'prod_NEW_BUSINESS_ID': { tier: 'business', name: 'Business' },
  // Keep old IDs for existing subscribers during transition:
  'prod_UIcRqJzc9qC0zh': { tier: 'pro', name: 'Pro' },      // was Starter
  'prod_UIcRHKBhWSyMO6': { tier: 'pro', name: 'Pro' },      // was Professional
  'prod_UIcR8tFUKCjx7i': { tier: 'business', name: 'Business' }, // was Business
  'prod_UIcRnSPmFfcwWH': { tier: 'business', name: 'Business' }, // was Enterprise
};
```

### 4. Update `src/components/landing/pricing/PricingCards.tsx`

Rebuild to display 2 tier cards + 1 Enterprise "Contact Us" card:
- Pro card (highlighted as "Most Popular")
- Business card (positioned for growing fleets)
- Enterprise card (no price shown, "Contact Sales" CTA, schedule demo via Calendly)

### 5. Update `src/components/landing/pricing/ROICalculator.tsx`

Update defaults to match new pricing:
- Default daily rate: $1,500 (exotic car industry average)
- Default utilization: 52%
- Revenue increase: 18% (conservative, credible)
- Use $39/vehicle for Pro, $29/vehicle for Business in calculations
- Show: "Exotiq costs $X/month. AI pricing generates $Y/month in additional revenue. ROI: Zx."
- Payback period should show < 1 month for most fleet sizes

### 6. Update `src/components/landing/pricing/PlanSelectionModal.tsx`

Simplify:
- Remove overage calculation
- Remove min-price logic
- Simple: fleet size × per-vehicle rate
- Auto-select tier based on fleet size (1-15 = Pro, 16-50 = Business, 51+ = redirect to demo)
- Add "14-day free trial — no credit card required" messaging

### 7. Update Feature Comparison Table

All features are included on both paid tiers. The comparison should show:
- A single "Included in all plans" checklist
- Differentiation only on: support level, locations, marketplace positioning, onboarding

### 8. Remove/Update Founder Pricing Elements

- Remove `FounderBanner.tsx` countdown (deadline passed)
- Replace with: "Launch pricing — rates increase in 2027. Lock in today."
- Remove `founderDeadline`, `founderSpotsTotal`, `founderSpotsRemaining` constants
- Keep `isFounderPricing: 'true'` in Stripe metadata (for future reference when prices increase)

### 9. Update `PRICING_SYSTEM_PROMPT.md`

Delete or completely rewrite this file — it contains the old 4-tier per-vehicle model with outdated Stripe price IDs.

---

## Trial & Soft Paywall Implementation

### Signup Flow (No Credit Card)

1. User signs up with email/password only
2. Account created with `trial_start: now()`, `trial_end: now() + 14 days`
3. Full access to all features during trial
4. No subscription created in Stripe until they choose to pay

### After Trial (Read-Only Mode)

Add to `AuthContext` / subscription check:
```typescript
if (!subscription.isActive && trialExpired) {
  // Show "read-only" banner
  // Disable: create booking, AI pricing, payments, marketplace
  // Allow: view dashboard, view data, export
}
```

### Activation Tracking

Track these milestones during trial (for conversion optimization later):
- Fleet imported (# vehicles added)
- Stripe Connected
- First AI pricing recommendation viewed
- First booking created
- Marketplace listing activated

---

## Summary Checklist

- [ ] Create 2 new Stripe products (Pro, Business)
- [ ] Create 4 new Stripe prices (Pro monthly/annual, Business monthly/annual)
- [ ] Archive old 4 products and 8 prices
- [ ] Update `PricingData.ts` with new model
- [ ] Update `create-checkout-session` edge function
- [ ] Update `check-subscription` edge function (keep old IDs for backwards compat)
- [ ] Rebuild `PricingCards.tsx` for 2 tiers + Enterprise
- [ ] Update `ROICalculator.tsx` with new defaults
- [ ] Simplify `PlanSelectionModal.tsx`
- [ ] Update Feature Comparison table
- [ ] Remove/update Founder pricing elements
- [ ] Add `trial_period_days: 14` to checkout session
- [ ] Implement soft paywall (read-only mode after trial)
- [ ] Delete or rewrite `PRICING_SYSTEM_PROMPT.md`
- [ ] Test full checkout flow end-to-end
