# Exotiq Pricing System - Implementation Guide

## Overview

This document provides a comprehensive system prompt for implementing the Exotiq pricing page, including tier structures, Stripe integration, feature comparison, and ROI calculator.

---

## Pricing Tier Structure

### Tier Configuration

| Tier | ID | Founder Price | Regular Price | Vehicle Range | Min | Max |
|------|----|---------------|---------------|---------------|-----|-----|
| Starter | `starter` | $29/veh/mo | $39/veh/mo | 1-10 vehicles | 1 | 10 |
| Professional | `professional` | $24/veh/mo | $34/veh/mo | 11-30 vehicles | 11 | 30 |
| Business | `business` | $19/veh/mo | $29/veh/mo | 31-75 vehicles | 31 | 75 |
| Enterprise | `enterprise` | $16/veh/mo | $24/veh/mo | 76+ vehicles | 76 | 999 |

### Stripe Price IDs

```typescript
export const STRIPE_PRICES = {
  starter: {
    monthly: 'price_1ShjP0HO7nC3pJiP4ExcElvZ',
    annual: 'price_1ShjP6HO7nC3pJiP9QBawM60',
  },
  professional: {
    monthly: 'price_1ShjP8HO7nC3pJiPQyJ3HFB4',
    annual: 'price_1ShjPBHO7nC3pJiP6KR4QvWc',
  },
  business: {
    monthly: 'price_1ShjPCHO7nC3pJiP3e6FjmV9',
    annual: 'price_1ShjPEHO7nC3pJiPdIX5VJuc',
  },
  enterprise: {
    monthly: 'price_1ShjPFHO7nC3pJiPDFbyAUZF',
    annual: 'price_1ShjPHHO7nC3pJiPoU8XyhuH',
  },
};
```

---

## Feature Matrix by Tier

### Core Features (All Tiers)
- Fleet Dashboard
- Booking Calendar
- Document Vault
- Customer CRM

### Tier-Specific Features

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|--------------|----------|------------|
| **Vehicles** | 1-10 | 11-30 | 31-75 | 76+ |
| **AI Pricing Engine (MotorIQ)** | ❌ | ✅ | ✅ | ✅ |
| **AI Forecasting** | 7-day | 30-day | 90-day | 365-day |
| **Rari AI Copilot** | ❌ | ❌ | ✅ | ✅ |
| **Advanced Analytics** | ❌ | ✅ | ✅ | ✅ |
| **API Access** | ❌ | ✅ | ✅ | ✅ |
| **Locations** | 1 | Up to 3 | Unlimited | Unlimited + Custom |
| **White-label Booking Portal** | ❌ | ❌ | ✅ | ✅ |
| **Custom Integrations** | ❌ | ✅ | ✅ | ✅ |
| **Support SLA** | Email (48hr) | Chat (24hr) | Phone (4hr) | Dedicated (1hr) |
| **Dedicated Success Manager** | ❌ | ❌ | ✅ | ✅ |
| **Custom AI Training** | ❌ | ❌ | ❌ | ✅ |
| **Quarterly Business Reviews** | ❌ | ❌ | ❌ | ✅ |
| **SLA Guarantee** | ❌ | ❌ | 99.5% | 99.9% |

### Onboarding Offers (Annual Plans)
- **Starter**: Free white-glove setup
- **Professional**: 50% off setup
- **Business**: 50% off setup
- **Enterprise**: Custom enterprise setup

---

## Annual Billing Calculation

```typescript
// Annual pricing = 10 months (2 months free)
const getAnnualPrice = (monthlyPrice: number) => {
  return Math.round(monthlyPrice * 10);
};

// Annual savings = 2 months free
const getAnnualSavings = (monthlyPrice: number) => {
  return monthlyPrice * 2;
};
```

### Example Calculations

| Tier | Monthly | Annual (10 mo) | Annual Savings |
|------|---------|----------------|----------------|
| Starter | $29/veh | $290/veh/year | $58/veh/year |
| Professional | $24/veh | $240/veh/year | $48/veh/year |
| Business | $19/veh | $190/veh/year | $38/veh/year |
| Enterprise | $16/veh | $160/veh/year | $32/veh/year |

---

## ROI Calculator Configuration

### Default Assumptions

```typescript
export const roiDefaults = {
  avgDailyRate: 500,              // $500/day average rental rate
  avgUtilization: 65,             // 65% fleet utilization
  revenueIncreasePercent: 25,     // 25% revenue increase with AI pricing
  maintenanceSavingsPercent: 38,  // 38% maintenance cost reduction
  avgMaintenanceCostPerVehicle: 3000, // $3,000/vehicle/year maintenance
};
```

### ROI Calculation Logic

```typescript
// 1. Calculate current annual revenue
const currentAnnualRevenue = fleetSize * avgDailyRate * 365 * (avgUtilization / 100);

// 2. Project revenue with Exotiq (+25%)
const projectedAnnualRevenue = currentAnnualRevenue * (1 + revenueIncreasePercent / 100);
const revenueIncrease = projectedAnnualRevenue - currentAnnualRevenue;

// 3. Calculate maintenance savings (38% reduction)
const currentMaintenanceCost = fleetSize * avgMaintenanceCostPerVehicle;
const maintenanceSavings = currentMaintenanceCost * (maintenanceSavingsPercent / 100);

// 4. Calculate total gain and net ROI
const totalAnnualGain = revenueIncrease + maintenanceSavings;
const annualExotiqCost = fleetSize * tierPrice * 12;
const netGain = totalAnnualGain - annualExotiqCost;
const roi = Math.round((netGain / annualExotiqCost) * 100);

// 5. Calculate payback period
const paybackMonths = Math.ceil((annualExotiqCost / totalAnnualGain) * 12);
```

### ROI Output Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| Revenue Increase | +25% from AI pricing | `projectedAnnualRevenue - currentAnnualRevenue` |
| Maintenance Saved | 38% cost reduction | `maintenanceCost * 0.38` |
| Net Annual Gain | After Exotiq cost | `totalGain - annualExotiqCost` |
| ROI % | Return on investment | `(netGain / annualExotiqCost) * 100` |
| Payback Period | Months to break even | `(exotiqCost / totalGain) * 12` |

---

## Founder Pricing Configuration

```typescript
export const founderDeadline = new Date('2025-03-31T23:59:59');
export const founderSpotsTotal = 250;
export const founderSpotsRemaining = 73;
```

### Urgency Elements
- Countdown timer to March 31, 2025
- "Only 73 spots left" scarcity indicator
- Price locks in forever once claimed

---

## Component Architecture

### File Structure

```
src/components/landing/pricing/
├── PricingData.ts          # All pricing constants, Stripe IDs, FAQs
├── PricingCards.tsx         # Main pricing tier cards with billing toggle
├── FeatureComparison.tsx    # Feature comparison table
├── ROICalculator.tsx        # Interactive ROI calculator
├── FounderBanner.tsx        # Urgency countdown banner
├── PricingFAQ.tsx           # Accordion FAQ section
├── FreeTrialBanner.tsx      # 14-day trial CTA
├── PricingGuarantee.tsx     # Money-back guarantee section
├── FinalCTA.tsx             # Bottom CTA section
└── PlanSelectionModal.tsx   # Fleet size selection + Stripe checkout
```

### Page Composition

```tsx
// PricingSectionNew.tsx
<>
  <FounderBanner />                    {/* Urgency countdown */}
  <PricingHero />                      {/* Title + value prop */}
  <PricingCards />                     {/* 4-tier pricing grid */}
  <ROICalculator />                    {/* Interactive calculator */}
  <FeatureComparison />                {/* Full feature matrix */}
  <FreeTrialBanner />                  {/* Trial CTA */}
  <PricingGuarantee />                 {/* Trust elements */}
  <PricingFAQ />                       {/* Common questions */}
  <FinalCTA />                         {/* Final conversion push */}
  <PlanSelectionModal />               {/* Checkout flow */}
  <CalendlyModal />                    {/* Demo scheduling */}
</>
```

---

## Stripe Checkout Integration

### Edge Function: create-checkout-session

```typescript
// supabase/functions/create-checkout-session/index.ts

// Key parameters:
{
  customer: customerId,                          // Existing Stripe customer
  customer_email: user.email,                    // For new customers
  line_items: [{
    price: priceId,                              // From STRIPE_PRICES
    quantity: fleetSize,                         // Number of vehicles
  }],
  mode: "subscription",                          // Recurring billing
  subscription_data: {
    trial_period_days: 14,                       // Free trial
    metadata: { tier, isAnnual, userId },
  },
  success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/pricing`,
  allow_promotion_codes: true,
}
```

### Checkout Flow

1. User selects tier and billing cycle
2. User enters fleet size
3. Frontend invokes `create-checkout-session` edge function
4. Edge function creates Stripe Checkout Session
5. User redirects to Stripe Checkout
6. After payment → redirect to `/welcome` page
7. Welcome page collects onboarding data

---

## FAQ Content

```typescript
export const faqItems = [
  {
    question: 'What happens after the 14-day free trial?',
    answer: 'Your trial converts to a paid subscription at the founder rate you locked in. You can cancel anytime during the trial with no charges. Credit card is required upfront to lock in founder pricing, but you will not be charged until day 15.',
  },
  {
    question: 'Is this pricing per vehicle or per account?',
    answer: 'Pricing is per vehicle per month. For example, a 15-vehicle fleet on the Professional plan would be $24 x 15 = $360/month. Volume discounts are built into the tier structure.',
  },
  {
    question: 'What is founder pricing and how long does it last?',
    answer: 'Founder pricing is our early-adopter discount, available until March 31, 2025 or until 250 spots are filled. Once you lock in founder pricing, your rate stays the same forever, even as we add new features and raise prices for new customers.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Absolutely! You can upgrade or downgrade at any time. When upgrading, you get immediate access to new features. When downgrading, changes take effect at your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and ACH bank transfers for annual plans. Enterprise customers can also pay via invoice with NET-30 terms.',
  },
  {
    question: 'Is there a setup fee?',
    answer: 'Annual prepay customers with 1-10 vehicles get free white-glove onboarding. Larger fleets on annual plans get 50% off setup. Monthly billing includes a standard $2,500 onboarding fee, which covers data migration, training, and dedicated setup support.',
  },
  {
    question: 'What if I need custom features or integrations?',
    answer: 'Our Business and Enterprise plans include custom integrations. Contact our sales team to discuss your specific needs. We have built integrations with major rental platforms, accounting systems, and telematics providers.',
  },
];
```

---

## Core Features Content

```typescript
export const coreFeatures = [
  {
    title: 'Core Fleet Dashboard',
    description: 'Real-time fleet overview with vehicle status, availability, and key metrics at a glance',
  },
  {
    title: 'Pulse Analytics',
    description: 'Revenue tracking, utilization reports, and performance insights across your entire fleet',
  },
  {
    title: 'Book Calendar',
    description: 'Drag-and-drop booking management with conflict detection and customer notifications',
  },
  {
    title: 'Vault Document Management',
    description: 'Secure storage for insurance, registration, and maintenance documents with expiry alerts',
  },
  {
    title: 'Customer CRM',
    description: 'Complete customer profiles with booking history, preferences, and communication logs',
  },
  {
    title: 'MotorIQ AI Engine',
    description: 'AI-powered pricing recommendations that optimize your rates based on demand and competition',
  },
];
```

---

## UI/UX Design Patterns

### Pricing Cards

- **Popular badge**: Professional tier highlighted with "Most Popular" badge
- **Founder pricing**: Crossed-out regular price with "Founder Price" badge
- **Annual toggle**: Switch with "2 months free" badge when annual selected
- **Feature list**: Checkmarks with descriptive features
- **AI badge**: Sparkle icon showing AI forecasting window (7/30/90/365 days)
- **Dual CTAs**: Primary "Lock in Founder Pricing" + Secondary "Start 14-Day Free Trial"

### Feature Comparison Table

- **Expandable**: Shows first 8 rows, "Show All Features" button reveals rest
- **Visual indicators**: ✅ CheckCircle2 (green) for included, ❌ XCircle (muted) for excluded
- **Text values**: Display actual limits (e.g., "Up to 3" locations)
- **Popular column**: Light primary background highlight on Professional column

### ROI Calculator

- **Fleet size slider**: 1-100 vehicles with labeled intervals
- **Dynamic tier display**: Shows current tier and price based on fleet size
- **Metric cards**: Color-coded cards for Revenue, Maintenance, Net Gain, ROI
- **Payback summary**: "Exotiq pays for itself in X months"

---

## Subscription Status Checking

### AuthContext Integration

```typescript
interface SubscriptionInfo {
  isActive: boolean;
  tier: 'starter' | 'professional' | 'business' | 'enterprise' | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// Available methods:
checkSubscription(): Promise<void>       // Refresh subscription status
openCustomerPortal(): Promise<void>      // Open Stripe billing portal
isFeatureAvailable(feature: string): boolean  // Check tier access
```

### Feature Gating

```typescript
// Features mapped to minimum tier required
const featureAccessMap = {
  'ai-pricing': ['professional', 'business', 'enterprise'],
  'rari-copilot': ['business', 'enterprise'],
  'api-access': ['professional', 'business', 'enterprise'],
  'white-label': ['business', 'enterprise'],
  'custom-ai': ['enterprise'],
};
```

---

## Implementation Checklist

- [x] Create Stripe products and prices (8 total: 4 tiers × 2 billing cycles)
- [x] Build PricingData.ts with all constants
- [x] Build PricingCards component with billing toggle
- [x] Build FeatureComparison table with expand/collapse
- [x] Build ROICalculator with dynamic tier selection
- [x] Build FounderBanner with countdown timer
- [x] Build PlanSelectionModal with fleet size input
- [x] Create create-checkout-session edge function
- [x] Create check-subscription edge function
- [x] Create customer-portal edge function
- [x] Update AuthContext with subscription state
- [x] Add Welcome page for post-checkout onboarding
- [x] Update Navigation with "Schedule Demo" CTA
- [x] Update HeroSection with dual CTAs
- [x] Integrate CalendlyModal for demo scheduling

---

## Testing Scenarios

1. **Billing toggle**: Verify prices update when switching monthly/annual
2. **Fleet size slider**: Verify tier changes at boundaries (10→11, 30→31, 75→76)
3. **ROI calculation**: Verify metrics update correctly with fleet size
4. **Checkout flow**: Test full flow from plan selection to Stripe
5. **Subscription check**: Verify tier detection after successful payment
6. **Customer portal**: Verify redirect to Stripe billing portal
7. **Feature gating**: Verify isFeatureAvailable returns correct access
