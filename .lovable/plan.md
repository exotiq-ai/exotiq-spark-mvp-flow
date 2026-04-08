

# Fix Checkout Flow — Two Remaining Issues

## Problem Summary
The backend works. Checkout sessions create successfully. Two issues remain:

1. **Redirect blocked in preview** — `window.location.href` to Stripe gets blocked in the Lovable preview iframe. Need `window.open()` fallback.
2. **`check-subscription` ignores trial subscriptions** — After checkout with 14-day trial, Stripe sets status to `trialing`. Current code only queries `status: "active"`, so the app will report "no subscription" even after successful payment.

## Changes

### 1. `PlanSelectionModal.tsx` — Add `window.open` fallback
```typescript
if (data?.url) {
  // Try redirect first, fall back to new tab for iframe environments
  try {
    window.location.href = data.url;
  } catch {
    window.open(data.url, '_blank');
  }
}
```

### 2. `check-subscription/index.ts` — Query both `active` and `trialing`
Change the subscription list call from:
```typescript
status: "active"
```
to:
```typescript
status: "all"  // then filter in code for active OR trialing
```
Add `trialing` as a valid subscribed state. Return `status` field so the frontend knows if it's a trial.

### 3. `customer-portal/index.ts` — Fix fallback origin
Change fallback from `https://exotiq.ai` to `https://app.exotiq.ai` and return URL to `/dashboard/settings`.

## Files Changed
| File | Change |
|------|--------|
| `src/components/landing/pricing/PlanSelectionModal.tsx` | `window.open` fallback for iframe |
| `supabase/functions/check-subscription/index.ts` | Add `trialing` status support |
| `supabase/functions/customer-portal/index.ts` | Fix return URL origin |

## Testing
After these changes, go to `app.exotiq.ai`, log in, navigate to Settings > Subscription, pick a plan, and complete checkout with Stripe test card `4242 4242 4242 4242`. The redirect should work and subscription should be detected immediately.
