# Fix Rari tool parameter drift (registry ↔ executor)

## The problem, confirmed

`registry.ts` and `executor.ts` name the same inputs differently, so single-entity lookups get `undefined`:

| Tool | Registry declares | Handler reads |
| --- | --- | --- |
| `getVehicleDetails` | `vehicle` | `vehicleName` |
| `getVehicleSpecs`, `getVehicleProfitLoss`, `getPricingRecommendation`, `checkAvailability` | `vehicle` | `vehicleName` |
| `get_vehicle_status` | `vehicle` | `vehicle_name` |
| `getCustomerProfile`, `getCustomerLifetimeValue` | `customer` | `customerName` |
| `getIdleVehicles` | `days` | `daysIdle` |
| `create_booking_hold` | `vehicle`, `customer`, `startDate`, `endDate` | `vehicle_id`, `customer_name`, `start_date`, `end_date` |
| `searchBookings` | `query` | (never read — only `status`/`daysRange`/`location`) |
| `getVaultDocuments` | `vehicle` | (never read — only `category`/`status`) |
| `logFeedback` | `feedback` | (never read — reads `feedbackType`/`userQuery`/…) |

Registry schemas stay exactly as they are (already synced to ElevenLabs). Auth is untouched.

## The fix

### 1. One normalization step before the dispatch switch

In `executeFunction`, immediately after the entry log and before `switch (functionName)`, run a per-tool alias map that copies registry names onto the handler names when the handler name is absent. Both spellings keep working, so MCP/chat callers already using the handler names don't break.

Aliases: `vehicle → vehicleName` (and `→ vehicle_name` for `get_vehicle_status`), `customer → customerName`, `days → daysIdle`. Applied to a normalized copy of `args`; the recursive `ask_fleet` call passes through the same path.

### 2. `create_booking_hold` name resolution

Map `customer → customer_name`, `startDate → start_date`, `endDate → end_date`, and resolve `vehicle` (free text) to `vehicle_id` by querying `vehicles` filtered by `team_id` — never across teams. If nothing matches, return a clear "no vehicle matching X in your fleet" result; if several match, ask which one rather than guessing.

### 3. Implement the three genuinely missing params

- `searchBookings(query)` — free-text filter across `booking_ref`, `customer_name`, and joined vehicle make/model, team-scoped, combined with the existing status/location filters. Honour `limit`.
- `getVaultDocuments(vehicle)` — resolve the vehicle within the team and filter documents to that `vehicle_id`.
- `logFeedback(feedback)` — accept `feedback` as the free-text body, stored in `user_query` when no explicit `userQuery` is supplied.

### 4. Null-year display names

`${vehicle.year} ${make} ${model}` appears ~23 times and renders "null Rolls-Royce Cullinan". Add one shared `vehicleDisplayName(v)` helper in the executor that omits a missing year (and trims), and use it at every one of those sites.

### 5. Parity test so this can't recur

New `src/test/fleet-tools.parity.test.ts`: reads `FLEET_TOOLS` and the raw text of `executor.ts`, and for each tool asserts that every declared param name is either read directly by its handler case body or covered by the alias map. Any future registry param that no handler reads fails the suite.

## Verification

- `getVehicleDetails({ vehicle: "488" })` returns the team's Ferrari 488 Spider.
- `getCustomerProfile({ customer: "Gregory" })` resolves.
- `create_booking_hold` round-trip creates the hold from a vehicle *name*.
- `searchBookings({ query: "BK-" })` and `getVaultDocuments({ vehicle: ... })` return filtered results.
- Full vitest suite green, executor bundles, `elevenlabs-tools` and `rari-mcp-server` redeployed.

## Not in scope

No registry schema renames, no ElevenLabs re-sync, no auth changes, no changes to the tool sync script.
