# ARK marketplace link: 404 explained, plus the empty-storefront follow-on

## What happened

Two separate things, neither of them broken data.

**1. The link pointed at the wrong app.** The address in the screenshots is `app.exotiq.ai/ark`. That's the operator app — the place you and your tenants log in to run their fleet. It has no renter-facing pages, so anything it doesn't recognise falls through to the 404 screen. Same on desktop and mobile, which is why both screenshots look identical.

ARK's renter storefront lives on the separate renter app: `book.exotiq.rent/ark`. That address loads correctly right now.

**2. The button inside the app produces that wrong address.** On the Marketplace settings screen, "Open public storefront" opens `/ark` relative to whatever site you're currently on. Since you're always on the operator app when you click it, it always lands on the operator app's 404. So this isn't a link you typed wrong — the app handed it to you that way. Any tenant who clicks it hits the same dead end.

**3. Even with the right address, ARK's storefront will look empty.** ARK's account is approved and visible, and 8 of the 9 vehicles pass the readiness checks, but zero vehicles have actually been published to the marketplace yet. Publishing the account and publishing each vehicle are two separate steps; only the first is done.

## What to change

**Fix the storefront button (operator app only)**
- Point "Open public storefront" at the renter app host with the tenant's slug, so it opens `book.exotiq.rent/<slug>` instead of a path on the current site.
- Put the host in one shared constant so every future link to a renter page uses the same value, and keep it overridable per environment so staging never sends anyone to the live renter app.
- Show the full address as copyable text next to the button, so tenants can paste it into their own site, Instagram bio, or a text message without hunting for it.
- Add the same copy/open pair to the marketplace readiness panel, where tenants land right after going live.

**Make the two publish steps obvious**
- On the marketplace status card, show a plain line: how many vehicles are eligible and how many are actually published, e.g. "8 vehicles ready, 0 published".
- When that published count is zero while the account is live, show a short note that the storefront will look empty until vehicles are published, with a link straight to the fleet list.

**Publish ARK's vehicles**
- Publish the 8 eligible ARK vehicles so the storefront is real. The Maybach stays unpublished while it's in maintenance. I'll do this as a data change after you confirm you want them live.

## Technical notes

- `src/components/dashboard/settings/MarketplaceSection.tsx:171` calls `window.open(`/${feeRow.slug}`)` — a same-origin path, hence the operator app's catch-all `NotFound` route. No `/:slug` route exists in `src/App.tsx`, and this is the only place in the codebase that builds a link that way.
- New shared helper (e.g. `src/lib/renterApp.ts`) exporting the renter base URL from a Vite env var with `https://book.exotiq.rent` as the fallback, plus a `renterStorefrontUrl(slug)` function.
- Counts come from the existing readiness data (`useMarketplaceReadiness`), which already returns eligible vs published — no new query or schema change.
- Verified: teams row for slug `ark` has `marketplace_visible = true`, `marketplace_request_status = 'approved'`, platform fee confirmed; of 9 vehicles, `marketplace_visible` is true on 0 and none are unlisted.
- Nothing on the renter app, no schema changes, no changes to existing public RPCs. Vehicle publishing is a data update on `vehicles.marketplace_visible`, done only on your confirmation.
