# Fix Orion showing USD instead of GBP

## Diagnosis

Orion's team is correctly configured in the backend: `country_code=GB`, `currency=GBP`, `locale=en-GB`, `tax_label=VAT`. So this is **not** a data problem — it's an incomplete Phase 1 migration.

The codebase has a tenant-aware money hook (`useMoney` → `formatMoney(value, { currency, locale })`) that pulls currency/locale from `TeamContext`. However, many components still hardcode a `$` glyph and `.toLocaleString()` instead of calling `money(value)`. The Fleet card in the screenshot is one of them:

```tsx
// src/components/fleet/FleetVehicleCard.tsx
${vehicle.current_rate.toLocaleString()}   // always renders "$1,850"
3h ${vehicle.rate_3hr}
6h ${vehicle.rate_6hr}
```

Because the glyph is a literal `$` in JSX, no team setting can change it. Same pattern exists in ~30 other files (Book, BookEnhanced, PricingCalendar, EnhancedBookingDialog, RecordPayment, RevenueBreakdown, DynamicPricingCard, MotorIQ, EntityPreview, etc.).

## Fix strategy

Replace hardcoded `$…toLocaleString()` with the tenant formatter. Scope the change to the **user-facing app modules** (Fleet, Bookings, Dashboard, Dialogs, Rari preview, Pricing tools). Do NOT touch:

- `src/components/landing/pricing/*` — public marketing pages, always USD by design.
- `src/components/super-admin/*` — platform billing (Stripe), always USD.
- Subscription / SaaS billing UI (`SubscriptionSection`, `PlanSelectionModal`) — priced in USD by Stripe.

## Steps

1. **FleetVehicleCard.tsx** (the screenshot): import `useMoney`, replace the four `$…` price renders (lines 371, 377, 380, 638, 644, 647) with `money(vehicle.current_rate)` / `money(vehicle.rate_3hr)` / `money(vehicle.rate_6hr)`. Keep `/day`, `3h`, `6h` labels.

2. **Booking surfaces** — same swap in:
   - `Book.tsx`, `BookEnhanced.tsx`
   - `NewBookingDialog.tsx`, `EnhancedBookingDialog.tsx`, `EditBookingDialog.tsx`, `ChangeVehicleDialog.tsx`, `CheckInOutDialog.tsx`
   - `RecordPaymentDialog.tsx`, `RevenueBreakdownDialog.tsx`, `PaymentExportDialog.tsx`, `PriceOptimizationDialog.tsx`
   - `PricingCalendar.tsx`, `DynamicPricingCard.tsx`, `QuickPriceEditorContent.tsx`

3. **Dashboard / insights** — `MotorIQEnhanced.tsx`, `AIAlertsFeed.tsx`, `RealAIInsights.tsx`, `DamageClaimsSection.tsx`, `CRMSection.tsx`, `CustomerProfileDialog.tsx`, `EntityPreview.tsx`, `FleetFilters.tsx` (price sliders), `ImportSummary.tsx`.

4. **Sweep guard**: after edits, `rg "\\\$\{" src/components/fleet src/components/bookings src/components/dashboard src/components/dialogs` should return only intentional non-currency uses (e.g. template literals for URLs, IDs). Anything remaining that's a price gets migrated.

5. **Verify with Playwright**: sign in as Orion, load `/fleet`, screenshot a card, confirm `£1,850` renders. Same check on `/dashboard` and the New Booking dialog.

## Out of scope

- Backend price storage (already currency-agnostic decimals).
- Stripe checkout amounts (Stripe converts on its side; tenant Connect account is region-specific).
- Tax display (VAT label already wired via `useMoney().taxLabel`).
- The USD→GBP FX conversion of stored numeric values — rates are entered by the tenant in their own currency, so `1850` for Orion is £1,850, not a converted value.

## Technical notes

Pattern per file:

```tsx
import { useMoney } from '@/hooks/useMoney';

const { money } = useMoney();
// before: ${value.toLocaleString()}
// after:  {money(value)}
```

For places that need only the symbol (e.g. an input adornment), read `currency` from `useMoney()` and derive the symbol via `(0).toLocaleString(locale, { style: 'currency', currency, minimumFractionDigits: 0 }).replace(/\d/g, '').trim()` or just render the formatted zero.
