# Fix: searching a car doesn't open that car

Worth fixing — it's a one-line param mismatch, not a design decision.

## What's actually happening

The Fleet page listens for a deep link on `?vehicle=<id>` (FleetPageEnhanced auto-opens the Vehicle Command Center when it sees it). The global search builds its link with `?vehicleId=<id>` instead, so Fleet loads, sees no `vehicle` param, and just sits on the list. Same mismatch exists in two other places:

- Global search vehicle results → `fleet?vehicleId=` (ignored)
- `goToVehicleDetails` (used by Rari entity links and the bookings module) → sends to FleetCopilot with `vehicleId`, which is why vehicle clicks land on the wrong module
- Margin's "open in fleet" is the only caller using the correct `?vehicle=` form

## The fix

1. Standardize on `?vehicle=<id>` for opening a vehicle's detail view on the Fleet page.
2. Update global search vehicle results to navigate to `/dashboard/fleet?vehicle=<id>`.
3. Point `goToVehicleDetails` at Fleet with `?vehicle=<id>` instead of FleetCopilot, so Rari links and booking vehicle links also open the right car.
4. Make the Fleet deep-link handler tolerant: also accept the legacy `vehicleId` key so any older link or bookmark still resolves, and clear the param after opening (already the behavior).
5. If the id isn't found in the currently loaded list (archived/trashed or still loading), leave the param in place until vehicles load rather than silently dropping it, so slow loads don't swallow the deep link.

## Verification

- Search a car by name from the dashboard header → Vehicle Command Center opens on that car.
- Click a vehicle from a Rari answer and from a booking → same result.
- Margin "open in fleet" still works.
- Deep link `/dashboard/fleet?vehicle=<id>` pasted directly (cold load) opens the car.
- Mobile: same check via the mobile search entry.

## Technical notes

Files touched: `src/components/common/EnhancedGlobalSearch.tsx` (line ~295), `src/hooks/useModuleNavigation.ts` (`goToVehicleDetails`), `src/components/fleet/FleetPageEnhanced.tsx` (deep-link effect, ~lines 148-159). No backend, schema, or business-logic changes.
