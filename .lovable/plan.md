
# Sync billing dunning + payment links with new pricing

The Super-Admin dunning UI and payment-due banners still reference legacy tiers (`starter`, `professional`). Checkout fails with "Invalid tier" for those values. This plan aligns everything with the live 3-tier model: **Pro** ($39/veh, 1–15), **Business** ($29/veh, 16–50), **Enterprise** (contact sales, 51+).

## Changes

### 1. `src/hooks/useBillingDunning.ts`
- Narrow type: `assumedPlanTier: "pro" | "business" | "enterprise" | null`
- Add normalizer when reading from DB: `starter → pro`, `professional → business` (defensive for grandfathered rows until migration runs).

### 2. `src/components/dashboard/PaymentDueBanner.tsx`
- If `assumedPlanTier === 'enterprise'` → CTA becomes "Contact sales" → `mailto:sales@exotiq.ai` (no checkout call).
- Pro/Business → existing `create-checkout-session` call (already valid).
- Validate `assumedPlanFleetSize` against tier bounds before invoking; if mismatched, route to `/dashboard/settings?tab=billing` instead of erroring.

### 3. `src/components/guards/PaymentDueGuard.tsx`
- Same enterprise + bounds handling as the banner.

### 4. `src/components/super-admin/SuperAdminBillingTab.tsx`
- Restrict tier `<Select>` options to `pro`, `business`, `enterprise`.
- Show live per-vehicle price preview ($39 Pro / $29 Business / "Custom quote" Enterprise).
- Validate `fleetSize` against tier bounds (1–15 / 16–50 / 51+) with inline error before allowing save.
- Hide annual toggle + fleet size for `enterprise`.

### 5. Data migration (SQL)
Backfill `public.teams.assumed_plan_tier`:
```sql
UPDATE public.teams SET assumed_plan_tier = 'pro'      WHERE assumed_plan_tier = 'starter';
UPDATE public.teams SET assumed_plan_tier = 'business' WHERE assumed_plan_tier = 'professional';
```

## Out of scope
- ROI calculator, pricing page, Stripe Price IDs, `check-subscription`, `switch-subscription` (already on new model).
- Email templates / dunning copy beyond tier handling.

## Verification
- `rg "starter|professional"` in `src/components/dashboard`, `src/components/guards`, `src/components/super-admin`, `src/hooks/useBillingDunning.ts` returns no stale tier references.
- Super-Admin: set a team to `enterprise` → banner shows "Contact sales", no edge-function error.
- Super-Admin: set a team to `pro` with fleet 10 → "Choose plan" opens Stripe checkout successfully.
