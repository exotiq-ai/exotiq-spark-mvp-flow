# Stripe TODO

Status as of 2026-05-28: ✅ Live pricing migrated to 3-tier per-vehicle model.

## Active products (LIVE)
- **Pro** `prod_Ub7IM2Skj93HFS` — $39/veh/mo (`price_1Tbv4IHO7nC3pJiPH4EbyVlL`) / $390/veh/yr (`price_1Tbv4JHO7nC3pJiPqaBeoyAX`)
- **Business** `prod_Ub7IlYXU1diSY8` — $29/veh/mo (`price_1Tbv4KHO7nC3pJiPC5emMKgJ`) / $290/veh/yr (`price_1Tbv4LHO7nC3pJiParUQCB7y`)
- **Enterprise** — contact sales (manual quote / invoicing)

## Trial
- 14-day trial applied at checkout via `trial_period_days`.
- `teams.trial_start` / `teams.trial_end` populated on signup. Existing teams grandfathered (NULL → no expiry).

## Legacy / archived
- Old Starter / Growth / Professional products are archived in Stripe.
- `check-subscription` keeps legacy product IDs mapped for backward compatibility with active grandfathered subscriptions.

## Edge functions
- `create-checkout-session` — uses 4 new price IDs, per-vehicle quantity, 14d trial.
- `check-subscription` — maps new + legacy product IDs.
- `switch-subscription` — in-app proration-aware tier/quantity changes from Settings → Billing.
- `customer-portal` — unchanged.
