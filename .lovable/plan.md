

# Stripe Sync & Pricing Fix — Full Plan

## Current State

**What's working:**
- Price IDs in code match Stripe (all 8 prices confirmed)
- Product IDs in `check-subscription` match Stripe (4 products confirmed)
- Webhook handles `checkout.session.completed`, subscription updates, payment intents, refunds, disputes, payouts
- `check-subscription` polls Stripe on login + periodically and feeds `AuthContext`
- `payment_method_collection: 'always'` is set for trial pre-auth

**What's broken or missing:**

### 1. Checkout quantity bug (critical)
`create-checkout-session` sends `quantity: fleetSize` for ALL tiers. For flat-rate tiers this multiplies the base price (e.g. Enterprise $1,799 × 150 = $269,850/mo). Flat tiers should send `quantity: 1` with a separate overage line item only when fleet exceeds the tier max.

### 2. Fleet size default bug
`PlanSelectionModal` defaults `fleetSize` to `selectedTier.maxVehicles` for ALL tiers. Flat tiers should default to their `maxVehicles` (included capacity) but quantity sent to Stripe must be 1. Per-vehicle (Starter) correctly uses fleetSize as quantity.

### 3. Overage pricing has no Stripe prices
Professional ($22/vehicle), Business ($18/vehicle), Enterprise ($15/vehicle) overage rates exist in `PricingData.ts` but have no corresponding Stripe recurring prices. Need to create 3 overage products+prices in Stripe.

### 4. Webhook doesn't sync subscription lifecycle to DB
`customer.subscription.updated` and `customer.subscription.deleted` just log — they don't update any local state. If a user upgrades, downgrades, or cancels via the Stripe portal, the app won't know until the next `check-subscription` poll. We should write subscription status to a local table or at minimum ensure the webhook updates something queryable.

### 5. 406 errors from useTeamMessaging
Two `.single()` calls return 406 when no rows match. Change to `.maybeSingle()`.

---

## Plan

### Step 1 — Create 3 overage prices in Stripe
Use the Stripe tool to create:
- "Professional Overage" — $22/vehicle/month recurring
- "Business Overage" — $18/vehicle/month recurring  
- "Enterprise Overage" — $15/vehicle/month recurring

### Step 2 — Fix `create-checkout-session` edge function
- For **Starter** (per-vehicle): keep `quantity: fleetSize`
- For **flat tiers**: always `quantity: 1` for the base price
- If `fleetSize > maxVehicles` for a flat tier, add a **second line item** using the overage price with `quantity: fleetSize - maxVehicles`
- Add validation: reject if total exceeds Stripe's $999,999 limit
- Store `maxVehicles` per tier in the function so it knows the threshold

### Step 3 — Fix `PlanSelectionModal.tsx` default fleet size
- Per-vehicle tiers: default to `maxVehicles` (user scales down)
- Flat tiers: default to `maxVehicles` (shows included capacity), but make clear the input is "Total vehicles" and overage kicks in above the limit

### Step 4 — Add `PricingData.ts` overage price IDs
Add overage Stripe price IDs to `STRIPE_PRICES` so the edge function can reference them:
```typescript
overage: {
  professional: 'price_xxx',
  business: 'price_yyy',
  enterprise: 'price_zzz',
}
```

### Step 5 — Wire webhook subscription lifecycle events
Update `stripe-webhook` to handle:
- `customer.subscription.updated` → log tier change, could update a `subscriptions` field on teams or trigger a notification
- `customer.subscription.deleted` → log cancellation, create notification for the user
- `invoice.payment_failed` → create notification warning the user their payment failed

This ensures the app stays in sync even when changes happen in Stripe's portal or via Stripe's retry logic.

### Step 6 — Fix 406 errors in `useTeamMessaging.ts`
- Line 88: `.single()` → `.maybeSingle()`
- Line 184: `.single()` → `.maybeSingle()`

### Step 7 — Deploy and test
- Deploy `create-checkout-session` and `stripe-webhook`
- Test: Starter with 5 vehicles → $145/mo
- Test: Professional with 25 vehicles → $399/mo (no overage)
- Test: Professional with 30 vehicles → $399 + 5×$22 = $509/mo
- Test: Enterprise with 150 → $1,799/mo (no overage, quantity 1)

---

## Files Changed

| File | Change |
|------|--------|
| Stripe (via tool) | Create 3 overage recurring prices |
| `src/components/landing/pricing/PricingData.ts` | Add overage price IDs |
| `supabase/functions/create-checkout-session/index.ts` | Fix quantity logic: base qty=1 for flat + overage line item |
| `src/components/landing/pricing/PlanSelectionModal.tsx` | Minor: keep defaults, pass overage info to edge function |
| `supabase/functions/stripe-webhook/index.ts` | Wire `subscription.updated/deleted` + `invoice.payment_failed` to notifications |
| `src/hooks/useTeamMessaging.ts` | `.single()` → `.maybeSingle()` in 2 places |

## Risk
**Low-medium.** The checkout quantity fix is critical but straightforward. Overage line items use standard Stripe multi-item subscriptions. Webhook additions are additive.

