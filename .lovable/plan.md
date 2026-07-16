
# Marketplace Launch Hardening Plan

Four workstreams to ship before flipping the marketplace on for teams beyond Exotiq. Everything is additive — no changes to existing booking, pricing, or payout code paths.

---

## 1. Public SEO & Metadata

**Goal:** Every marketplace-visible vehicle is discoverable and shares cleanly on social.

- Add `react-helmet-async` provider at app root (already in dep list — verify).
- New public route wrapper on the existing marketplace vehicle detail page injects per-vehicle:
  - `<title>` = `{Year} {Make} {Model} — Rent from {Team Name}`
  - `<meta name="description">` = first 155 chars of vehicle description or generated fallback (`Rent this {year} {make} {model} in {city}. From ${daily_rate}/day.`)
  - `<link rel="canonical">` = `https://exotiq.ai/rent/{team-slug}/{vehicle-slug}`
  - `og:title`, `og:description`, `og:url`, `og:type=product`, `og:image` = hero photo signed URL (long-TTL public variant — see §4)
  - `twitter:card=summary_large_image`
  - JSON-LD `Vehicle` + `Offer` schema (price, availability, brand, model, vehicleModelDate, image[])
- Team landing page (`/rent/{team-slug}`) gets `LocalBusiness` + `ItemList` JSON-LD.
- New `scripts/generate-sitemap.ts` (predev/prebuild) queries the anon `rent_public_*` RPC for all visible teams + vehicles and writes `public/sitemap.xml`. Static routes + one entry per marketplace vehicle.
- `public/robots.txt` allow `/rent/*`, disallow `/dashboard/*`, `/super-admin`, `/auth/*`; add `Sitemap:` directive.
- Update root `index.html` with a marketplace-appropriate default title/description (currently generic).

## 2. Marketplace Go-Live Checklist (enforced gate)

**Goal:** A team's `marketplace_visible` toggle cannot flip on until every check passes. Super admin sees the same checklist and can force-override with a logged reason.

New DB function `public.get_marketplace_readiness(team_id uuid)` returns a jsonb of check results. Server-side trigger on `teams` blocks `UPDATE ... SET marketplace_visible = true` unless readiness returns all-green OR the caller is a super_admin with `override_reason` set in a session GUC.

Checks per team:
- Stripe Connect account = `charges_enabled` AND `payouts_enabled`
- Team profile: logo, business name, primary location, contact email
- Legal: current terms version accepted by owner
- ≥1 marketplace-visible vehicle that itself passes vehicle checks

Checks per vehicle (used by team gate + shown on vehicle row):
- ≥5 photos, hero photo assigned
- Daily rate set (>0), rate tiers not all null
- Description ≥120 chars
- Location assigned
- `status = 'available'`, not archived/trashed
- No open critical maintenance work order

New UI: `MarketplaceReadinessPanel.tsx` inside the existing `MarketplaceVisibilityTab` — expands above each team row. Green/red pill per check with a "Fix" deep-link to the exact settings page. "Publish to marketplace" button replaces the raw switch and is disabled until green. Super admin sees an "Override & publish" secondary button that opens a reason modal and calls the RPC with the override GUC set; logged via `log_admin_action`.

## 3. Public Listing Analytics

**Goal:** Teams and super admin can see traffic on public listings.

New table `public.marketplace_listing_events` (event_type, team_id, vehicle_id, session_hash, referrer, user_agent_family, country, created_at). RLS: insert via a new anon-callable edge function `rent-track-event` (validates event shape, salts+hashes IP → session_hash, drops raw IP); select restricted to team members for their team + super admins for all. GRANTs per public-schema rules.

Client: tiny `useMarketplaceTracking` hook fires `view` on vehicle detail mount, `click_contact` / `click_book` on CTA click. Debounced, no PII.

New RPC `get_marketplace_listing_stats(team_id, range)` returns per-vehicle views/clicks/CTR + sparkline. Surfaced in:
- Super Admin → Marketplace tab: aggregate strip (views 7d, top 5 vehicles, worst-performing).
- Team owner Marketplace settings page: per-vehicle table.

## 4. Abuse & Rate-Limit Hardening

**Goal:** Anon endpoints can't be scraped or DoS'd cheaply.

- `rent-public-media`, `rent-public-catalog`, `rent-track-event` edge functions: add lightweight in-function rate limiter keyed on `IP + route` using a new `public.edge_rate_buckets` table (upsert token count with window reset). Return 429 with `Retry-After`. Limits: media 60/min/IP, catalog 120/min/IP, track 30/min/IP.
- Global kill-switch: `public.platform_flags` row `marketplace_public_enabled` (bool). All three functions short-circuit to 503 when false. Toggle lives in Super Admin → Marketplace tab header.
- Signed URL TTL split: hero image variant gets 24h TTL for OG scraping; gallery keeps 1h.
- Audit log: every anon hit writes a minimal row (route, status, session_hash, ms) to a `marketplace_access_log` partitioned by day, 30-day retention via existing retention sweep pattern.
- Robots for known bad bots (AhrefsBot, SemrushBot, MJ12bot) → disallow, keep GoogleBot/Bingbot/social scrapers allowed.

---

## Technical notes

- Migration order: (1) tables + GRANTs + RLS, (2) readiness function + trigger, (3) analytics RPC, (4) rate-limit table + kill-switch flag. Trigger uses `SECURITY DEFINER` with `SET search_path = public`.
- Existing `rent-public-media` already returns signed URLs; extend to accept `?variant=hero|gallery` for TTL split.
- No new npm deps beyond `react-helmet-async` (already used elsewhere per grep — verify in build step).
- Feature-flag the enforced gate behind `featureFlags.marketplaceGateEnforced` so we can ship UI first, enforce in a follow-up if any current visible team fails checks.
- All new admin actions call `log_admin_action`.

## Out of scope (flag for later)

- Email/SMS notifications to teams when a check regresses.
- A/B testing framework for listing copy.
- Marketplace-side reviews / ratings.
- Per-vehicle SEO A/B (title variants).
