# Why ARK's storefront is empty — and removing the hidden publish step

## Your question, answered

Yes, there is a per-vehicle publish step today, and no, it shouldn't be a separate hunt after the account is marketplace-ready.

Here's the exact state of things:

- Every vehicle is created hidden from renters. That's the stored default, and nothing changes it when the account goes live.
- ARK's account is fully live: approved, visible, platform fee confirmed. But all 9 vehicles are still hidden, so `book.exotiq.rent/ark` correctly renders an empty lineup.
- The only place a tenant can change it is inside each vehicle's Edit screen, under "Public booking site" — Listed / Link only / Hidden. Nine cars means opening nine dialogs, and nothing in the app tells them this step exists.
- The readiness panel makes it worse by saying they're ready, because "ready" measures the account and whether vehicles *could* be listed — not whether any actually are.

The 404 was the separate thing: `app.exotiq.ai/ark` is the operator app, which has no renter pages. `book.exotiq.rent/ark` is the storefront. I'm fixing the in-app button that generates that wrong address too, since it's what a tenant would click.

## The plan

**1. Going live publishes the eligible fleet automatically**

When an account becomes marketplace-visible, every vehicle that already passes its own checks (photo, rate, location, available status) gets listed in the same step. Vehicles that fail a check, or are in maintenance or retired, stay hidden until they're fixed — then they list automatically as well. Hidden stays a deliberate tenant choice: if someone sets a car to Hidden or Link only, that decision is never overwritten.

This makes "marketplace-ready" mean what tenants read it as: cars are on the storefront.

**2. Fleet-wide publish controls, no dialog-by-dialog work**

- Fleet page header shows the live truth: "7 of 9 cars on your booking site" with a link to the storefront.
- A "Publish all eligible" action for tenants who want to do it by hand or after fixing a blocker.
- Publish/hide from each vehicle card's menu, so it's one click rather than opening the edit dialog.
- Cars that can't publish yet show the specific reason on the card — missing photo, no rate, in maintenance.

**3. Fix the storefront link**

- "Open public storefront" points at the renter site (`book.exotiq.rent/<slug>`), not a path on the operator app. One shared setting, overridable per environment so staging never links to the live renter site.
- The full address shown as copyable text next to the button and in the readiness panel, so tenants can paste it into their site or Instagram bio.

**4. Bring ARK live now**

Publish ARK's 8 eligible cars so the storefront is real today. The Maybach stays hidden while it's in maintenance and will list itself once it's back. I'll run this once you approve.

## Technical notes

- `vehicles.marketplace_visible` and `marketplace_unlisted` both default to `false`, `NOT NULL`; all 9 ARK vehicles have `marketplace_visible = false`. The team row has `marketplace_visible = true`, `marketplace_request_status = 'approved'`, platform fee confirmed.
- Auto-publish goes in an `AFTER UPDATE` trigger on `teams` (fires when `marketplace_visible` flips to true) plus an `AFTER UPDATE` trigger on `vehicles` for the fix-a-blocker case. Both skip rows where the tenant explicitly chose hidden/link-only, which needs a nullable `marketplace_visibility_set_by_tenant` timestamp so "never touched" is distinguishable from "deliberately hidden" — additive column, no existing column altered.
- Existing guard triggers (`enforce_marketplace_readiness`, `enforce_platform_fee_on_marketplace_visible`, `enforce_deposit_source_on_marketplace_visible`) stay untouched and still gate every write, so auto-publish cannot bypass fee or deposit confirmation.
- `src/components/dashboard/settings/MarketplaceSection.tsx:171` calls `window.open(`/${feeRow.slug}`)`, a same-origin path that hits the operator app's catch-all `NotFound`. New `src/lib/renterApp.ts` exports the base URL from a Vite env var defaulting to `https://book.exotiq.rent`, plus `renterStorefrontUrl(slug)`. This is the only place in the codebase building a link that way.
- Fleet counts come from the existing vehicle query; per-card blocker reasons reuse the hints already in `useMarketplaceReadiness`.
- No renter-app changes, no changes to existing public RPCs, no columns removed or renamed. Edit Vehicle keeps its Listed / Link only / Hidden radio as the manual override.
