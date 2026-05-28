# Cursor/Claude Handoff — exotiq.ai Marketing Site Pricing Update

**Document Type:** Implementation Handoff  
**Date:** May 28, 2026  
**For:** Cursor / Claude Code (exotiq.ai marketing site)  
**Priority:** HIGH — Must match what Lovable deploys on app.exotiq.ai

---

## Context

The Exotiq Command Center (app.exotiq.ai) pricing is being restructured from 4 tiers to 2 tiers + Enterprise. The marketing site at exotiq.ai must be updated to match. This document covers what needs to change on the marketing/landing site.

---

## New Pricing Model

| | **Pro** | **Business** | **Enterprise** |
|---|---------|------------|---------------|
| **Fleet size** | 1-15 vehicles | 16-50 vehicles | 51+ vehicles |
| **Monthly** | $39/vehicle/mo | $29/vehicle/mo | Custom |
| **Annual** | $390/vehicle/yr | $290/vehicle/yr | Custom |
| **Features** | All features | All features | All features + custom AI + API |
| **Support** | Chat (24hr) | Priority + phone | Dedicated success manager |
| **Locations** | Up to 2 | Up to 5 | Unlimited |
| **Marketplace** | Drive Exotiq listing | Featured listing | Premium placement |
| **Onboarding** | Self-serve + video | White-glove migration | Custom setup |

**Key messaging:**
- "All features included on every plan"
- "$39/vehicle/month — everything you need to manage and grow your exotic rental fleet"
- "14-day free trial. No credit card required."
- "Launch pricing — lock in today before rates increase in 2027"

---

## Pages to Update

### 1. Pricing Page (exotiq.ai/pricing)

**Layout:** 2 pricing cards + 1 Enterprise card, horizontally aligned

**Pro Card (highlighted as "Most Popular"):**
```
PRO
$39 /vehicle/month
(or $390/vehicle/year — save 2 months)
1-15 vehicles

✓ Complete fleet dashboard
✓ MotorIQ AI pricing engine
✓ Booking calendar & CRM
✓ Document vault with alerts
✓ Stripe Connect payments
✓ Drive Exotiq marketplace listing
✓ Analytics & reports
✓ Chat support (24hr)
✓ Up to 2 locations

[Start Free Trial]
14 days free • No credit card required
```

**Business Card:**
```
BUSINESS
$29 /vehicle/month
(or $290/vehicle/year — save 2 months)
16-50 vehicles

Everything in Pro, plus:
✓ Priority chat + phone support
✓ Up to 5 locations
✓ Featured marketplace listing
✓ White-glove onboarding & migration
✓ Advanced analytics & exports
✓ Team roles & permissions

[Start Free Trial]
14 days free • No credit card required
```

**Enterprise Card (no price, dark/premium style):**
```
ENTERPRISE
Custom pricing
51+ vehicles

Everything in Business, plus:
✓ Custom AI model training
✓ Unlimited locations
✓ Premium marketplace placement
✓ Dedicated success manager
✓ Custom integrations & API
✓ Quarterly business reviews
✓ Enterprise SLA (99.9%)

[Schedule a Demo]
```

### 2. ROI Calculator

Update the ROI calculator on the pricing page with these defaults:

**Inputs:**
- Fleet size slider: 1-50 (default: 10)
- Average daily rate: $1,500 (exotic car benchmark)
- Current utilization: 52%

**Calculations:**
```
currentAnnualRevenue = fleetSize × dailyRate × 365 × (utilization / 100)
projectedRevenue = currentAnnualRevenue × 1.18  (18% improvement from AI pricing)
revenueIncrease = projectedRevenue - currentAnnualRevenue
exotiqAnnualCost = fleetSize × (fleetSize <= 15 ? 39 : 29) × 12
roi = Math.round((revenueIncrease / exotiqAnnualCost) * 100)
paybackDays = Math.ceil((exotiqAnnualCost / revenueIncrease) * 365)
```

**Display:**
- "Your fleet generates: $X/year"
- "With AI pricing optimization: +$Y/year (18% increase)"
- "Exotiq costs: $Z/year"
- "Net annual gain: $W"
- "ROI: Xx"
- "Exotiq pays for itself in X days"

**Example for 10-car fleet at $1,500/day, 52% utilization:**
- Current revenue: $2,847,000/year
- AI improvement: +$512,460/year
- Exotiq cost: $4,680/year (10 × $39 × 12)
- ROI: 109x
- Payback: 3 days

### 3. Feature Comparison Table

Replace the 4-column feature matrix with a simpler format:

**Section 1: "Included in All Plans"** (single column checklist)
- Fleet Dashboard
- MotorIQ AI Pricing Engine
- AI Forecasting (30-day)
- Booking Calendar
- Customer CRM
- Document Vault
- Stripe Connect Payments
- Drive Exotiq Marketplace
- Analytics & Reports
- Team Management
- Mobile Responsive

**Section 2: "Plan Differences"** (3-column comparison)

| | Pro | Business | Enterprise |
|---|-----|----------|------------|
| Vehicles | 1-15 | 16-50 | 51+ |
| Locations | Up to 2 | Up to 5 | Unlimited |
| Support | Chat (24hr) | Priority + phone | Dedicated (1hr) |
| Marketplace | Listed | Featured | Premium + priority leads |
| Onboarding | Self-serve | White-glove | Custom |
| API Access | — | — | Full API |
| Custom AI | — | — | Custom model training |
| SLA | — | — | 99.9% |

### 4. FAQ Section

Replace existing FAQ with:

1. **How does the 14-day free trial work?**
   Sign up with just your email — no credit card required. You get full access to every feature for 14 days. After the trial, your account switches to read-only until you subscribe. Your data is never deleted.

2. **How does pricing work?**
   Simple per-vehicle pricing. Pro is $39/vehicle/month (1-15 vehicles). Business is $29/vehicle/month (16-50 vehicles). All features are included on both plans. Annual billing saves you 2 months.

3. **What if I have more than 50 vehicles?**
   Contact us for Enterprise pricing with custom rates, dedicated support, and custom AI model training.

4. **Are all features really included?**
   Yes. MotorIQ AI pricing, booking calendar, CRM, document vault, Stripe Connect payments, marketplace listing, and analytics — all included on every paid plan. No feature gates.

5. **What happens after the trial ends?**
   Read-only mode. You can still view your fleet and data, but can't create bookings, process payments, or use AI pricing until you subscribe.

6. **Can I switch plans?**
   If your fleet grows past 15 vehicles, you automatically qualify for the lower Business rate at your next billing cycle.

7. **Is there a long-term contract?**
   No. Monthly plans cancel anytime. Annual plans are prepaid with 2 months free.

8. **What about Drive Exotiq marketplace?**
   Every paid account is listed on Drive Exotiq (exotiq.rent). Business and Enterprise get featured placement with priority lead routing.

### 5. Remove Outdated Elements

- Remove founder pricing countdown/urgency banner (deadline has passed)
- Replace with subtle: "Launch pricing — lock in before 2027 increase"
- Remove "73 spots remaining" scarcity language
- Remove crossed-out "regular price" displays
- Remove 4-tier grid entirely
- Remove overage pricing language

### 6. CTA Updates

Primary CTA everywhere: **"Start Free Trial"**  
Secondary CTA: **"Schedule a Demo"** (for Enterprise / undecided)

CTA button text on pricing cards:
- Pro: "Start Free Trial" (primary button style)
- Business: "Start Free Trial" (primary button style)
- Enterprise: "Schedule a Demo" (outline/secondary button style)

Below all CTAs: "14 days free • No credit card • All features included"

---

## Stripe MCP Fallback Instructions

If Lovable cannot handle Stripe product/price creation, use the Stripe MCP (or Stripe API via CLI) to:

### Step 1: Create Products

```
stripe products create \
  --name="Exotiq Pro" \
  --description="Fleet management for 1-15 vehicles. All features included."

stripe products create \
  --name="Exotiq Business" \
  --description="Fleet management for 16-50 vehicles. All features with priority support."
```

### Step 2: Create Prices

```
# Pro Monthly ($39/vehicle/month)
stripe prices create \
  --product=prod_NEW_PRO_ID \
  --unit-amount=3900 \
  --currency=usd \
  --recurring[interval]=month \
  --billing-scheme=per_unit

# Pro Annual ($390/vehicle/year)
stripe prices create \
  --product=prod_NEW_PRO_ID \
  --unit-amount=39000 \
  --currency=usd \
  --recurring[interval]=year \
  --billing-scheme=per_unit

# Business Monthly ($29/vehicle/month)
stripe prices create \
  --product=prod_NEW_BUSINESS_ID \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month \
  --billing-scheme=per_unit

# Business Annual ($290/vehicle/year)
stripe prices create \
  --product=prod_NEW_BUSINESS_ID \
  --unit-amount=29000 \
  --currency=usd \
  --recurring[interval]=year \
  --billing-scheme=per_unit
```

### Step 3: Archive Old Prices

```
stripe prices update price_1ShmMlHO7nC3pJiPxcbd7vlL --active=false
stripe prices update price_1ShmRHHO7nC3pJiPtU6o3AMC --active=false
stripe prices update price_1ShmMmHO7nC3pJiPPYhhXT1o --active=false
stripe prices update price_1ShmRJHO7nC3pJiP05J4DdvQ --active=false
stripe prices update price_1ShmMoHO7nC3pJiPzUH0wSP3 --active=false
stripe prices update price_1ShmRKHO7nC3pJiPSxuuBWtO --active=false
stripe prices update price_1ShmMqHO7nC3pJiPV04rgXRX --active=false
stripe prices update price_1ShmRMHO7nC3pJiPYawYJ13O --active=false
```

### Step 4: Archive Old Products

```
stripe products update prod_UIcRqJzc9qC0zh --active=false
stripe products update prod_UIcRHKBhWSyMO6 --active=false
stripe products update prod_UIcR8tFUKCjx7i --active=false
stripe products update prod_UIcRnSPmFfcwWH --active=false
```

### Step 5: Update Code

After creating new products/prices, paste the new IDs into:
- `src/components/landing/pricing/PricingData.ts` → `STRIPE_PRICES`
- `supabase/functions/create-checkout-session/index.ts` → `STRIPE_PRICES`
- `supabase/functions/check-subscription/index.ts` → `PRODUCT_TIERS`

---

## Verification Checklist

After all changes:
- [ ] Pricing page shows 2 tiers + Enterprise correctly
- [ ] Monthly/annual toggle works and shows correct prices
- [ ] ROI calculator updates dynamically with fleet size
- [ ] "Start Free Trial" buttons redirect to signup (not Stripe checkout yet)
- [ ] Feature comparison table shows "all included" model
- [ ] FAQ answers match new pricing model
- [ ] No references to old tiers (Starter, Professional, old Business, old Enterprise)
- [ ] No founder countdown or expired urgency elements
- [ ] Enterprise card shows "Schedule a Demo" → Calendly
- [ ] Mobile responsive at all breakpoints
