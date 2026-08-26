# Rari fleet-tools: vehicle bookings, multi-word search, and question routing

Three fixes in `supabase/functions/_shared/fleet-tools/executor.ts`. No auth, token, or registry schema changes (the only registry-adjacent change is dropping the unused `includeBookings` flag from the handler).

## 1. getVehicleDetails always returns bookings

Confirmed today: the handler reads `includeBookings` from args, but `registry.ts` only declares `vehicle` for this tool, so the flag is never set and `bookings` is always `null` — which is why Rari called the 488 "available, no bookings".

Change: remove the flag entirely and always attach bookings to the detail record.

- Current + upcoming bookings (end date today or later, excluding cancelled/declined), sorted soonest-first.
- Plus the last 2 completed/past bookings, most recent first.
- Cap at 5 entries total, upcoming taking priority.
- Each entry keeps the existing shape (customer, dates, status, amount) and adds the booking reference.
- The `summary` string mentions the next booking when one exists, so a voice answer can't say "no bookings" while data says otherwise.

Also tokenize the vehicle lookup itself (same rule as below) so "Ferrari 488 Spider" resolves — today it runs one ILIKE with the whole phrase against `name`/`make`/`model` and misses.

## 2. searchBookings matches multi-word vehicle phrases

Today the join fallback runs `make ILIKE '%Ferrari 488 Spider%' OR model ILIKE '%...%'`, which can never match a row where make="Ferrari" and model="488 Spider". It also only runs when the first pass returns zero rows.

Change:

- Split the query on whitespace into tokens.
- Always run both passes: the booking-column pass and the vehicle-join pass. Merge results, dedupe by booking id.
- Candidate rows are fetched team-scoped with the existing status/date filters, then matched in code: a booking matches when **every** token appears (case-insensitive substring) in at least one of `booking_ref`, `customer_name`, `customer_email`, `vehicle_name`, or joined `vehicles.make` / `vehicles.model` / `vehicles.year`.
- Existing `location`, `status`, `daysRange`, and `limit` behaviour is unchanged.

`bookings.vehicle_name` is not backfilled — linked bookings keep resolving names through the vehicle join.

## 3. ask_fleet routes vehicle questions to the vehicle

Before keyword-intent matching, check the question against the caller's own team vehicles (make, model, name — team-scoped query, no hardcoded lists). If a token in the question matches one vehicle, route to `getVehicleDetails` with that vehicle instead of `getFleetMetrics`. Ambiguous or no match falls through to the existing intent table unchanged.

## Verification (Tampa tenant, live)

- `getVehicleDetails({vehicle:"488"})` → Aug 28–30 booking present in the record.
- `searchBookings({query:"Ferrari 488 Spider"})` → finds that booking.
- `searchBookings({query:"Gregory"})` → finds that booking.
- `ask_fleet({question:"what's going on with the 488?"})` → `routed_to: getVehicleDetails`.
- Full vitest suite (including the registry/executor parity test) green; redeploy `elevenlabs-tools` and `rari-mcp-server`.
