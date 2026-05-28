## Goal

Make `app.exotiq.ai/pricing` (`FeatureComparison.tsx` + `PricingData.ts` tier bullets) match the source of truth at `exotiq.ai/pricing`. Public messaging is **"All Features. Every Plan."** — tiers differ only in quantity (vehicles, locations), support level, marketplace placement, onboarding, and a few Enterprise-only items (API, custom AI, SLA).

## Mismatches found

| Item | exotiq.ai (truth) | App today | Action |
|---|---|---|---|
| Positioning headline | "All Features. Every Plan." | "Find the right plan for your fleet size and needs" | Update copy |
| AI Forecasting | 30-day on all plans | 30 / 90 / 365-day | Move to "Included in All" |
| API Access | Enterprise only | Pro ❌ / Business ✓ / Enterprise ✓ | Fix → Enterprise only |
| White-label Booking Portal | Not a tiered feature (marketplace placement is) | Pro ❌ / Business ✓ | Replace row with "Marketplace Placement: Listed / Featured / Premium + priority leads" |
| Custom Integrations | Enterprise only | Pro ❌ / Business ✓ / Enterprise ✓ | Fix → Enterprise only |
| Support SLA labels | Chat (24hr) / Priority + phone / Dedicated (1hr) | Chat (24hr) / Phone (4hr) / Dedicated (1hr) | Align Business label |
| Onboarding | Self-serve / White-glove / Custom | Missing | Add row |
| SLA Guarantee | Enterprise 99.9% only | Business 99.5% / Enterprise 99.9% | Drop Business 99.5% |
| Dedicated Success Manager | Enterprise only (Business gets priority support) | Pro ❌ / Business ✓ / Enterprise ✓ | Fix → Enterprise only |
| Stripe Connect, Drive Exotiq marketplace, Analytics, Team Mgmt, Mobile | Listed as "Included in All" | Not surfaced | Add to "Included in All" intro block |
| Pro tier bullets in `PricingData` | Stripe Connect + marketplace listing + analytics missing | Generic list | Rewrite to match exotiq.ai bullets verbatim |
| Business tier bullets | Missing featured marketplace, team roles | Generic | Rewrite to match exotiq.ai |
| Enterprise tier bullets | Custom AI, unlimited locations, premium marketplace, CSM, custom integrations, QBR, 99.9% SLA | Generic | Rewrite to match exotiq.ai |

## Changes (frontend only, 2 files)

### 1. `src/components/landing/pricing/FeatureComparison.tsx`
- Replace section header: "Compare Plans" → keep, subhead → "All features included on every plan. Here's what differs."
- Add a compact "Included in All Plans" chip block above the table listing the 11 universal features (Fleet Dashboard, MotorIQ AI Pricing, AI Forecasting 30-day, Booking Calendar, Customer CRM, Document Vault, Stripe Connect Payments, Drive Exotiq Marketplace, Analytics & Reports, Team Management, Mobile Responsive).
- Rewrite the `features` array to ONLY contain true differentiators (8 rows, no need for show-more):

```
Vehicles                  1–15            16–50              51+
Locations                 Up to 2         Up to 5            Unlimited
Support                   Chat (24hr)     Priority + phone   Dedicated (1hr)
Marketplace Placement     Listed          Featured           Premium + priority leads
Onboarding                Self-serve      White-glove        Custom
API Access                —               —                  Full API
Custom AI Training        —               —                  ✓
SLA Guarantee             —               —                  99.9%
```

- Remove the expand/collapse logic (no longer needed at 8 rows).

### 2. `src/components/landing/pricing/PricingData.ts`
- Rewrite tier `features` arrays to mirror exotiq.ai bullets verbatim.
  - **Pro**: Complete fleet dashboard / MotorIQ AI pricing engine / Booking calendar & CRM / Document vault with alerts / Stripe Connect payments / Drive Exotiq marketplace listing / Analytics & reports / Chat support (24hr) / Up to 2 locations
  - **Business** (Everything in Pro, plus:): Priority chat + phone support / Up to 5 locations / Featured marketplace listing / White-glove onboarding & migration / Advanced analytics & exports / Team roles & permissions
  - **Enterprise** (Everything in Business, plus:): Custom AI model training / Unlimited locations / Premium marketplace placement / Dedicated success manager / Custom integrations & API / Quarterly business reviews / Enterprise SLA (99.9%)
- Update tier metadata fields used elsewhere:
  - `aiForecasting`: set all three to `'30-day'` (it's universal now).
  - `apiAccess`: Pro `false`, Business `false`, Enterprise `true`.
  - `supportSLA`: Business → `'Priority + phone'` (was `'Priority (4hr)'`).

## Out of scope
- ROI calculator (already aligned in prior pass).
- Pricing card prices, Stripe Price IDs, checkout flow — unchanged.
- In-app entitlements / feature flags — flagging only: the app's `apiAccess: true` on Pro/Business was never enforced in code, so the data change is cosmetic. If true API gating exists elsewhere, it should be revisited in a follow-up.

## Verification
- `rg "90-day|365-day|apiAccess: true" src/components/landing` returns no stale matches.
- Visual check: `/` pricing section's comparison table renders 8 rows, Pro column shows no false ❌ on universal features, "Included in All Plans" block visible above table.
