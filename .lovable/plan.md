# Default Payment-Due Banner Checkout to Annual

Make the pay button default to the annual price (which already bakes in 2 months free per the tier pricing) while keeping the existing fleet-size → tier routing intact. Super-admin can still override to monthly per tenant.

## What changes

**`src/components/dashboard/PaymentDueBanner.tsx`**
- `handlePay`: change `isAnnual: assumedPlanIsAnnual ?? false` → `isAnnual: assumedPlanIsAnnual ?? true`.
- Update `COPY` CTAs:
  - `reminder.cta`: `Choose plan` → `Start annual plan`
  - `notice.cta`: `Complete payment` → `Complete plan`
  - `restriction.cta`: `Complete payment now` → `Complete plan now`
- No other logic touched — fleet size, tier bounds, enterprise → sales mailto all stay the same.

**`src/components/guards/PaymentDueGuard.tsx`**
- Same one-line default flip in its `handlePay` (`assumedPlanIsAnnual ?? true`).
- Button label `Complete payment` → `Complete plan now` to match the restriction-stage banner.

**`src/components/super-admin/SuperAdminBillingTab.tsx`**
- `useState<boolean>(tenant.assumed_plan_is_annual ?? false)` → `?? true` so the admin form is pre-checked for annual. Super-admin can still untick it for any tenant that wants monthly.

## What doesn't change

- No DB migration. `assumed_plan_is_annual` already exists on `teams`.
- No edge function change. `create-checkout-session` already accepts `isAnnual` and resolves to the correct annual price.
- Fleet-size → tier mapping (`TIER_BOUNDS`) is unchanged — J Davidson at 10 vehicles still resolves to Pro tier annual.
- Enterprise tier still routes to `sales@exotiq.ai` (no Stripe price).
- Existing tenants with `assumed_plan_is_annual = false` explicitly set remain monthly. Only NULL falls through to the new annual default.

## J Davidson flow after this ships

1. Super-admin opens the billing tab for J Davidson.
2. Sets stage to Reminder/Notice (annual is pre-checked, fleet size already 10).
3. Saves → banner appears in J Davidson's dashboard.
4. Owner clicks **Start annual plan** / **Complete plan** → Stripe Checkout opens on Pro tier, annual price, 10 vehicles. Done.

## Out of scope

- Tier pricing or the 2-months-free math (already encoded in the annual price IDs).
- Renaming/refactoring `assumed_plan_is_annual`.
- Trial / dunning lifecycle logic.
