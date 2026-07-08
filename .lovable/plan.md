## Goal

Make "out of service" a first-class, cross-module signal so a vehicle in maintenance (or with an active out-of-rotation work order) can never be booked — and make the visual difference between a **Task** (informational) and **Out of Service** (blocking) unmistakable.

## Current gaps

- `NewBookingDialog` only checks booking overlap (`hasBlockingOverlap`). It ignores `vehicles.status = 'maintenance'` and ignores active work orders flagged `out_of_rotation` (OOR).
- Fleet cards show `status` (available / booked / maintenance) but don't reflect an OOR work order unless someone manually sets vehicle status.
- Work order OOR toggle in `WorkOrderDetailSheet` warns about overlapping bookings but doesn't propagate to the vehicle's fleet status or the booking picker.
- Tasks (`useFleetTasks`) and Work Orders (`useWorkOrders`) share visual space and the abbreviation "OOR" is opaque — easy to confuse a reminder task with a blocking maintenance state.

## Plan

### 1. Single source of truth for availability

Extend `src/lib/conflictDetection.ts`:

- Add `getVehicleAvailabilityState(vehicle, window, bookings, workOrders)` returning:

  ```text
  { available: boolean, reason: 'booking'|'out_of_service'|'maintenance_status'|null,
    blocking: { workOrderId?, bookingId?, expectedReturnAt? } }
  ```
- A vehicle is unavailable if **any** of:
  - `vehicle.status === 'maintenance'` or `'retired'`
  - an active (non-completed, non-cancelled) work order has `out_of_rotation = true` AND (`expected_return_at` is null OR overlaps the requested window)
  - existing `hasBlockingOverlap` booking check
- Add unit tests in `conflictDetection.test.ts` covering OOR overlap, indefinite OOR, and completed-WO restore.

### 2. Wire work orders into the shared context

- In `FleetContext`, expose `activeOutOfServiceWorkOrders` (already-fetched OOR work orders per vehicle) so every consumer uses one list, no duplicate queries.
- `NewBookingDialog` vehicle `<Select>`:
  - Replace inline `hasBlockingOverlap` with the new helper.
  - Render unavailable items disabled with a clear pill: **"Out of service · returns Mar 12"** or **"Booked"**.
  - Block submit with a specific error if the chosen vehicle becomes unavailable.

### 3. Auto-sync vehicle status ↔ work orders

In `useWorkOrders.toggleOutOfRotation` and status transitions:

- On enable OOR → set `vehicles.status = 'maintenance'` (if currently `available`), remember prior status in `vehicles.ops_status` metadata.
- On disable OOR or work order completion, if no other active OOR work order exists for that vehicle → restore `vehicles.status = 'available'`.
- Guarded by team_id; no schema change required (fields already exist).

### 4. Fleet card surfacing

`FleetPageEnhanced` vehicle cards and `LiveFleetStatusWidget`:

- New badge **"Out of Service"** (amber, `Ban` icon) when the vehicle has any active OOR work order. Shown in addition to the status pill, with `Expected back: <date>` on hover.
- Clicking the badge opens the underlying work order sheet.
- Utilization / booked counts already exclude non-blocking bookings — no math change, just surface the state.

### 5. Booking calendar visibility

`BookingCalendar`:

- In the day pop-out and week view, render OOR windows for a vehicle as a diagonal-striped, muted block labeled **"Out of service"** so schedulers see the reason a slot is closed. Non-clickable (opens work order sheet on tap).

### 6. Clear language: Task vs Out of Service

Global rename and iconography:

| Concept | Label | Icon | Meaning |
|---|---|---|---|
| `VehicleTask` | **Task** | `CheckSquare` | Reminder / to-do. **Never blocks bookings.** |
| Work order (not OOR) | **Work Order** | `Wrench` | Being handled. Doesn't block by itself. |
| Work order with OOR | **Out of Service** | `Ban` (amber) | **Blocks new bookings** in the window. |

Changes:

- Replace every user-facing `"OOR"` string with `"Out of Service"`.
- In `MaintenanceHub` and `VehicleTasksList`, split lists into two groups with subtitles:
  - *Tasks — informational, do not block bookings*
  - *Work Orders — mark "Out of Service" to block bookings*
- Add a one-time tooltip on the Out of Service switch: *"Blocks this vehicle from new bookings until the expected return date."*
- `CreateVehicleTaskDialog`: add a helper line *"For repairs that stop the car from renting, create a Work Order instead."* with a link to the WO dialog.

### 7. Verification

- `npx vitest run src/lib/conflictDetection.test.ts` — new OOR cases pass.
- Full `npx vitest run` green.
- Manual: mark a vehicle OOR → NewBookingDialog shows it as Out of Service, fleet card gets the badge; completing the work order restores availability.

## Files touched (est.)

- `src/lib/conflictDetection.ts` + test
- `src/hooks/useWorkOrders.ts` (auto vehicle status sync + expose helpers)
- `src/contexts/FleetContext.tsx` (surface active OOR work orders)
- `src/components/dialogs/NewBookingDialog.tsx` (unified availability)
- `src/components/fleet/WorkOrderDetailSheet.tsx` (label + tooltip)
- `src/components/fleet/MaintenanceHub.tsx`, `TaskQueue.tsx`, `VehicleTasksList.tsx` (grouping + copy)
- `src/components/fleet/FleetPageEnhanced.tsx` + fleet card component (Out of Service badge)
- `src/components/dashboard/BookingCalendar.tsx` (OOR strip in day/week views)
- `src/components/dialogs/CreateVehicleTaskDialog.tsx` (disambiguation helper)

No schema/migration required — all fields already exist.
