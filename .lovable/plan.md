

# Post-Checkout Redirect Logic

## The Two Flows

### Flow A — Logged-in user (from Dashboard Settings)
1. User is on `/dashboard/settings` → clicks upgrade → Stripe checkout
2. After payment → redirect to `/dashboard/settings?subscription=success`
3. Settings page detects the query param → fires celebration animation + refreshes subscription status
4. User stays in their dashboard — no disruption

### Flow B — Landing page visitor (from pricing section, may not be logged in)
1. Visitor on `/` → clicks "Start Trial" → Stripe checkout (may or may not have auth token)
2. After payment → redirect to `/welcome?session_id={CHECKOUT_SESSION_ID}`
3. Welcome page collects business info → redirects to `/auth` to sign up/log in
4. First dashboard load → celebration

## What Changes

### Step 1 — Pass `returnPath` from frontend to edge function
`PlanSelectionModal` already knows where it's being rendered. Add a `returnPath` prop:
- From `SubscriptionSection` (dashboard): pass `returnPath: '/dashboard/settings?subscription=success'`
- From `PricingSectionNew` (landing): pass `returnPath: '/welcome'` (current behavior)

The edge function uses this to set `success_url`.

### Step 2 — Update `create-checkout-session` edge function
Accept optional `returnPath` in the request body. Use it to build `success_url`:
```
success_url = origin + returnPath + (includes ? already ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}'
```
Fall back to `/welcome?session_id={CHECKOUT_SESSION_ID}` if not provided.

### Step 3 — Update `cancel_url` similarly
- From dashboard: cancel returns to `/dashboard/settings`
- From landing: cancel returns to `/#pricing`

### Step 4 — Add celebration trigger on Settings page
Detect `?subscription=success` query param in `SubscriptionSection`. When present:
- Fire confetti/celebration animation (reuse existing `Celebration` component)
- Show success toast
- Clear the param from URL
- Auto-refresh subscription status via `check-subscription`

## Files Changed

| File | Change |
|------|--------|
| `PlanSelectionModal.tsx` | Add `returnPath` and `cancelPath` props, pass to edge function |
| `PricingSectionNew.tsx` | Pass landing-page return paths |
| `SubscriptionSection.tsx` | Pass dashboard return paths + add celebration on `?subscription=success` |
| `create-checkout-session/index.ts` | Accept `returnPath`/`cancelPath` from body, use for URLs |

## Risk
**Low.** Additive changes only. Existing behavior preserved as the default fallback.

