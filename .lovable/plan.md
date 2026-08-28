# Exotiq Revenue (Take Rate) view in Super Admin

## Short answer

Yes, build it — but the first thing it will tell you is that **nothing was owed on Exotics by the Bay's test booking**. Before building a dashboard, it's worth being clear on why your Stripe account is empty, because a chart that says "$0" without explaining why is worse than no chart.

## What I verified in the data

- Across the whole platform there have been **57 marketplace bookings ever, and exactly 3 that were actually paid** (all on the Exotiq internal account, in July and mid-August). Those 3 are the only ones that ever created an Exotiq fee charge.
- **Exotics by the Bay has zero paid marketplace bookings.** Their marketplace attempts (BK-03485 through BK-03510) are all `cancelled` and none ever reached a payment intent.
- Their most recent bookings this week (BK-03519, BK-03520, BK-03521, Aug 24–25) were created as **direct** bookings from inside their own dashboard, not through the public booking app. Direct bookings carry **no fee snapshot at all** (`platform_fee_cents` is empty) and by design charge 0% — so nothing was ever supposed to hit Exotiq's account for them.

So: not a Stripe bug, not a missing webhook. The test never went through the renter checkout, and even if it had, it was cancelled before payment.

## How the money actually flows (worth knowing before reading any dashboard)

A paid marketplace booking creates **two separate Stripe charges**:

1. **Operator leg** — the rental amount, taken on the platform account and transferred out to the operator's connected account.
2. **Exotiq leg** — platform fee + protection + state fee + processing, charged off-session to the renter's saved card a moment later. **This is Exotiq's revenue** and it is the one that shows up in your own Stripe balance.

The Exotiq leg can silently fail (card declines off-session), which is the single most important thing a take-rate dashboard should surface.

## Proposed feature: "Revenue" tab in Super Admin

A new tab alongside Tenants / Billing, with three parts.

### 1. Headline strip
- Exotiq revenue collected (period-selectable: 7d / 30d / 90d / all)
- Split into platform fee, protection, state fee, processing fee
- Gross booking volume routed through the marketplace, plus effective take rate (Exotiq revenue ÷ gross volume)
- Refunded / clawed-back amount

### 2. Exposure & failure panel — the part that earns its keep
- **Fee owed but not collected**: bookings where the operator leg captured but the Exotiq leg is missing, failed, or still retrying. These are dollars you earned and don't have.
- **Retry state** per booking, with the existing retry action.
- **Zero-fee paid bookings**: paid marketplace bookings whose fee snapshot was 0 or absent — catches misconfiguration like a missing platform fee confirmation.

### 3. Per-tenant table + booking drill-down
- Rows: tenant, paid marketplace bookings, gross volume, Exotiq revenue, effective take rate, uncollected fees, last paid booking date.
- Click a row → bookings for that tenant with each fee component, both payment intent IDs, and a link out to the Stripe payment.
- Explicit column separating **direct** bookings (0% by design, informational) from **marketplace** bookings (fee-bearing), so a tenant doing volume outside the booking app reads as "no fees expected" rather than looking like a leak.

### 4. Empty-state honesty
When a tenant has zero paid marketplace bookings, say exactly that — "no completed marketplace checkouts yet; N direct bookings this period carry no platform fee" — instead of rendering $0.

## Pushback / scope notes

- **Don't reconcile against Stripe live in the page.** Reading the Stripe API on every load is slow and rate-limited. Source of truth is the booking fee snapshot plus stored payment intent IDs; add a "verify against Stripe" button on the drill-down for a single booking when you need certainty.
- **Two tabs would be redundant.** This belongs next to the existing Billing tab (which covers SaaS subscription revenue). Marketplace take rate is a different revenue line, so a separate tab — but they should link to each other.
- **The real near-term win is the exposure panel, not the pretty chart.** With 3 paid bookings platform-wide, trend lines are noise. Build the exposure/failure panel first; the charts get useful once volume exists.

## Technical approach

- One security-definer RPC, `get_super_admin_marketplace_revenue(_from date, _to date)`, gated on the existing super-admin check, returning per-tenant aggregates plus platform totals. Read-only, aggregates from `bookings` (`platform_fee_cents`, `protection_total_cents`, `state_fee_cents`, `processing_fee_cents`, `exotiq_charge_cents`, `operator_payment_intent_id`, `exotiq_payment_intent_id`, `exotiq_leg_attempt`, `paid_at`, `status`) joined to `teams`.
- A second RPC for the booking-level drill-down for one tenant.
- New `src/components/super-admin/MarketplaceRevenueTab.tsx`, plus a tab entry in `SuperAdminDashboard.tsx`. Reuses the card/table/badge patterns from `TenantHealthTab.tsx` and the tile pattern from `PlatformPulseStrip.tsx`.
- Uncollected-fee rows link to the existing `rent-retry-exotiq-leg` function so you can act, not just look.
- Access logged the same way tenant detail opens are logged.

## Separate follow-up (not part of this tab)

Exotics by the Bay still hasn't completed a real marketplace checkout. Worth walking them through one live end-to-end booking on the public app so the whole two-leg flow is proven for their account — this dashboard will then have something real to show.
