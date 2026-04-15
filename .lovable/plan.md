

## Fix Subscription Date Parsing Bug + Remove Trial Period

### Part 1: Fix (immediate code change)

**File:** `supabase/functions/check-subscription/index.ts`

The `"Invalid time value"` error occurs when constructing a `Date` from `subscription.current_period_end`. In the Stripe SDK v18.5.0 with API version `2025-08-27.basil`, this value may arrive as a string or be `null` in trialing subscriptions. The fix wraps the date conversion with a safety check:

```typescript
// Before (crashes):
subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

// After (safe):
const endTimestamp = subscription.current_period_end;
if (endTimestamp && !isNaN(Number(endTimestamp))) {
  subscriptionEnd = new Date(Number(endTimestamp) * 1000).toISOString();
}
```

This also needs to handle `trialing` status — the function already queries all statuses and checks for `active` or `trialing`, so that part is correct.

### Part 2: Remove 14-day Trial from Checkout (plan)

**File:** `supabase/functions/create-checkout-session/index.ts`

Remove the `trial_period_days: 14` from the `subscription_data` object in the `stripe.checkout.sessions.create()` call. This means:

- New signups will **not** get a trial period
- The card will still be collected but **charged immediately** on the first billing cycle
- Existing trialing subscriptions are unaffected

No other files need to change — the `check-subscription` function already handles both `active` and `trialing` statuses, and the frontend subscription gate works off the `subscribed` boolean regardless of status.

**What stays the same:** Users can still log in and use the app without a subscription (your existing auth flow doesn't hard-gate on subscription status for all routes). The subscription section in settings will show "no active subscription" and prompt them to subscribe.

### Summary

| Step | File | Change |
|------|------|--------|
| 1 | `check-subscription/index.ts` | Safe date parsing with `Number()` coercion and null check |
| 2 | `create-checkout-session/index.ts` | Remove `trial_period_days: 14` from `subscription_data` |

