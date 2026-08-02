# Marketplace photo requirement: 5 photos -> 1 hero photo

## Goal
Drop the "at least 5 photos" gate for marketplace readiness. A vehicle qualifies with **one hero photo**, with guidance to use a front 3/4 (45-degree) angle shot.

## Current state (verified)
- `get_marketplace_readiness(p_team_id)` computes a per-vehicle check `photos_min_5` as `photo_count >= 5`, counting rows in `vehicle_photos` where `is_visible IS NOT FALSE`.
- That same check is part of the per-vehicle `ready` flag and of `ready_vehicle_count`, which feeds the team-level `has_ready_vehicle` check.
- The team-level gate trigger `enforce_marketplace_readiness()` blocks flipping `teams.marketplace_visible` on when readiness is not met (unless test mode or a super-admin override), so it inherits the same rule.
- `vehicle_photos` has `photo_type` (hero convention already used across upload/analysis code) and `detected_angle` (`front_quarter` used by generated hero images). There is a `ensure_single_hero_photo` trigger enforcing one hero per vehicle.
- Frontend label lives in `src/hooks/useMarketplaceReadiness.ts` (`photos_min_5: 'At least 5 photos'`) and is rendered by both the tenant Marketplace settings tab and the Super Admin readiness panel.

## Changes

### 1. Database migration — replace the check
Recreate `get_marketplace_readiness` with the per-vehicle check key renamed from `photos_min_5` to `hero_photo_set`:

- Pass when the vehicle has at least one visible photo whose `photo_type = 'hero'`.
- Fallback: if no photo is flagged hero but the vehicle has at least one visible photo, still pass (avoids locking out tenants whose photos were uploaded before the hero convention). This keeps the gate honest without a hard migration of existing data.
- Add a non-blocking informational field per vehicle: `hero_angle_front_quarter` (true when the hero photo's `detected_angle` is `front_quarter`). It is **not** part of `ready` — it drives a "suggested" hint in the UI only.
- `ready` and `ready_vehicle_count` use `hero_photo_set` in place of `photos_min_5`; everything else is unchanged.

No other function or trigger needs editing — `enforce_marketplace_readiness()` calls the readiness function, so it picks the new rule up automatically.

### 2. Frontend labels
In `src/hooks/useMarketplaceReadiness.ts`:
- Replace `photos_min_5: 'At least 5 photos'` with `hero_photo_set: 'Hero photo uploaded'`.
- Add `hero_angle_front_quarter: 'Hero is a front 3/4 (45 degree) shot'` labelled as a suggestion.

### 3. Suggestion UI (not a blocker)
In the tenant Marketplace settings panel and the Super Admin readiness panel:
- Render `hero_angle_front_quarter` in a separate "Recommended" group with a muted icon, never red, and never counted in the pass/fail total.
- Helper copy: "One clear hero photo is required. For best marketplace performance, use a front 3/4 angle — about 45 degrees off the front of the car, full vehicle in frame, no people or clutter."
- Update the `has_ready_vehicle` explanatory line so it stops implying multiple photos.

## Suggested improvements to the plan
1. **Keep quality as a recommendation, not a gate.** Beyond the 45-degree hint, surface soft suggestions (interior shot, rear 3/4, odometer) as "Boost your listing" items. They increase conversion without adding go-live friction.
2. **Use the existing AI hero generator as the escape hatch.** If a vehicle has zero photos, the readiness row should offer a "Generate hero image" CTA that calls the existing `generate-hero-image` function — turning a blocker into a one-click fix.
3. **Auto-promote the first photo to hero.** If a vehicle has visible photos but none marked hero, the drill-down should show a "Set as hero" action rather than only a red X, so a tenant never has to guess what changed.
4. **Grandfathering check before shipping.** Run a count of currently marketplace-visible vehicles that would fail the new `hero_photo_set` rule. Expect zero regressions (the rule is strictly looser than 5 photos), but confirm rather than assume.
5. **Don't rename the JSON key twice.** Both dashboards read the check keys directly, so the key rename and the label change must land together; any stale key would render as an unlabelled row.

## Verification
- Call `get_marketplace_readiness` for Exotiq and one tenant with sparse photos; confirm vehicles with 1 hero photo now report `ready: true`.
- Confirm no currently visible marketplace vehicle flips to not-ready.
- Tenant Settings -> Marketplace and Super Admin -> Marketplace Visibility both show "Hero photo uploaded" and the 45-degree suggestion as non-blocking.
- Typecheck and build pass.
