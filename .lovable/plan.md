## Problem

The Super Admin Marketplace tab shows names like *"Fredo D'Lima's Fleet"* instead of *"Saucy Rentals"*. Root cause confirmed in DB:

- `profiles.company_name` holds the real business name (e.g. `Saucy Rentals`, `Revel + Roam`, `Exotics By The Bay`).
- `teams.name` was set once at signup from `company_name` (or a `full_name`'s Fleet fallback) and is **never re-synced** when the owner later edits their business name in Onboarding / Settings.
- `teams.slug` was derived from that stale `teams.name`, so marketplace URLs would inherit the wrong brand (`fredo-d-lima` instead of `saucy-rentals`).

Only `hello@exotiq.ai` currently has an accurate `teams.name` (because it matched from the start). Everyone else is stale.

## Goal

`teams.name` is the single source of truth for the business/brand shown in Super Admin, marketplace listings, and slugs. Updating the business name in the app updates the team record and (when safe) the slug.

## Plan

### 1. Fix the write path (Onboarding + Settings)
- In `src/pages/Onboarding.tsx` (Step 1 save) and the business-profile save in `SystemSettingsSection`, when the owner sets/updates the business name, also update `teams.name` for `currentTeam.id` alongside `profiles.company_name`. Trim + reject empty.
- Trigger a `refreshTeam()` afterward so the header and Super Admin lists reflect it immediately.

### 2. Slug handling
- Add a lightweight server-side helper (RPC `rename_team(team_id, new_name)`) that:
  - Updates `teams.name`.
  - If the team is **not yet marketplace-approved** (`marketplace_request_status <> 'approved'` AND `marketplace_visible = false`), regenerate `teams.slug` from the new name with uniqueness suffixing.
  - If the team **is already live on the marketplace**, keep the existing slug (to avoid breaking public URLs) and log the divergence. Super Admin gets a manual "Regenerate slug" action for those cases.
- Call this RPC from Onboarding + Settings instead of a direct table update.

### 3. Backfill existing tenants (one-shot data migration)
For every team where `profiles.company_name` is non-empty AND `teams.name` still matches the `"<full_name>'s Fleet"` fallback pattern OR differs from `company_name`:
- Set `teams.name = profiles.company_name` (trimmed).
- Regenerate `teams.slug` **only** for teams that are not marketplace-approved (same guard as above).
- Leave teams with no `company_name` untouched (e.g. `Orion's Fleet`, `Gianni's Fleet` — those owners never entered a business name).
- Fix the one obvious data issue for the Exotiq team: `name = 'Exotiq '` (trailing space) → `'Exotiq'`, slug `exotiq-` → `exotiq`. This is marketplace-visible, so slug change requires explicit confirmation; I'll flag it and only run it if you approve.

### 4. Super Admin Marketplace tab
- `MarketplaceVisibilityTab` already reads `teams.name` — after the backfill it will show correct brand names. No UI change required beyond adding a small secondary line showing the owner email + slug so it's obvious which team is which when brands collide.
- Add a "Sync from business profile" action per row that calls `rename_team` using the owner's current `profiles.company_name` — for future drift.

### 5. Verification
- Re-run the `SELECT` from step 1's evidence and confirm every team with a `company_name` matches.
- Load Super Admin → Marketplace and confirm `Saucy Rentals`, `Revel + Roam`, `Exotics By The Bay`, `Denver Exotic Rental Cars`, `Open Plan Consultants, LLC`, `GM LUXE` all render correctly.
- Edit business name in Settings on a test tenant and confirm it propagates without a page reload.

## Not in scope
- No changes to public marketplace routing or the `rent-public-media` function.
- No slug rewrite for teams that are already marketplace-approved unless you explicitly opt in per team (protects live SEO/links).
- No change to `profiles.company_name` semantics — it stays the owner's editable field; `teams.name` mirrors it.
