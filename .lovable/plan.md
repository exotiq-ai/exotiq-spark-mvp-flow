

# Fleet Inventory Management — Amended Plan

Your amendments are solid. I validated every claim against the codebase. Here's my assessment and the final merged plan.

## Validating Your Amendments

**AddVehicleDialog dead fields — Confirmed.** Lines 298-320 render mileage limit and overage rate inputs but neither has controlled state (`useState`). They use `defaultValue` which means the values are never captured. The submit payload (line 98-112) doesn't include `default_mileage_limit`, `mileage_overage_rate`, or `color`. These fields exist in the DB schema (`types.ts` lines 3088, 3097, 3085). Real bug — EditVehicleDialog would inherit this if we mirror the form.

**vehicleSchema gap — Confirmed.** `validationSchemas.ts` has no `color`, `default_mileage_limit`, `mileage_overage_rate`, or `location_id` fields. Since `createVehicle` runs `vehicleSchema.parse(vehicle)` (line 695), any of these fields passed would be **stripped by Zod** silently. Must expand.

**Revenue hardcode — Confirmed.** Line 322: `setRevenue({ today: todayRevenue, month: monthRevenue, change: 12 })`. Hardcoded `12` for percentage change. Not a blocker but misleading data.

**applyPriceOptimization team bug — Confirmed.** Line 667 uses `.eq('user_id', user.id)` while the rest of FleetContext uses team-aware filtering. In a multi-user team, a manager trying to update a vehicle owned by another user would silently fail (0 rows updated, no error).

**Double-toast on delete — Confirmed.** `deleteVehicle` (line 1267) always fires a toast. If `useUndoToast` also fires one, that's two toasts. Need the `silent` option.

**Change log indexes — Agreed.** History tab queries by `vehicle_id + created_at DESC`. Without an index on a log table that grows linearly, this degrades fast.

## One Pushback

**Status sync rules in Step 3.** You flagged this correctly but also said to keep it simple. I'd go simpler than even a lookup table: when `status` changes to `maintenance`, auto-set `ops_status` to `pending_inspection`. When `status` changes to `available`, set `ops_status` to `clean_ready` **only if** current ops_status is null. That's two `if` statements, not a state machine. Anything more complex belongs in a future PR.

## Final Build Order

### Step 0 — Fix Existing Bugs (3 files)

**`src/components/dialogs/AddVehicleDialog.tsx`**
- Add `color`, `defaultMileageLimit`, `mileageOverageRate` to component state
- Wire the existing mileage/rate inputs to controlled state
- Include all three in submit payload
- Pass `color` to `generateHero()` call (line 129, currently `undefined`)

**`src/lib/validationSchemas.ts`**
- Add to `vehicleSchema`: `color` (string, max 30, optional), `default_mileage_limit` (number, min 0, max 10000, optional nullable), `mileage_overage_rate` (number, min 0, max 100, optional nullable), `location_id` (uuid, optional nullable)

**`src/contexts/FleetContext.tsx`**
- Line 322: replace `change: 12` with `change: null` (honest until we calculate real month-over-month)
- Line 667: replace `.eq('user_id', user.id)` with team-aware filter (`.eq('id', vehicleId)` — RLS handles scoping)

### Step 1 — Migration: `vehicle_change_log` (1 migration)

```sql
CREATE TABLE public.vehicle_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vehicle_change_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vehicle_change_log_vehicle ON public.vehicle_change_log (vehicle_id, created_at DESC);
CREATE INDEX idx_vehicle_change_log_team ON public.vehicle_change_log (team_id, created_at DESC);

CREATE POLICY "Team members can view vehicle changes"
  ON public.vehicle_change_log FOR SELECT TO authenticated
  USING (is_team_member_of_record(auth.uid(), team_id));

CREATE POLICY "Users can insert vehicle change logs"
  ON public.vehicle_change_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Step 2 — Feature Flags (1 file)

**`src/lib/featureFlags.ts`** — add `vehicleEditDialog: true`, `vehicleChangeLog: true`, `deleteUndoToast: true`

### Step 3 — FleetContext.tsx (1 file, major)

- Add `updateVehicle(vehicleId, updates, options?)` function:
  - Diffs `updates` against current vehicle in local state
  - Inserts one `vehicle_change_log` row per changed field
  - Updates vehicle record (team-aware, no `user_id` filter)
  - `options: { silent?: boolean, source?: string }` — `silent` suppresses toast, `source` tags log entries
  - Simple status sync: if `status → maintenance`, set `ops_status = 'pending_inspection'`; if `status → available` and `ops_status` is null, set `ops_status = 'clean_ready'`
- Refactor `applyPriceOptimization` to call `updateVehicle(id, { current_rate: newRate, suggested_rate: null }, { source: 'ai_pricing' })`
- Add `silent` option to `deleteVehicle` — when true, skip the internal toast
- Expose `updateVehicle` in context type and value

### Step 4 — EditVehicleDialog (1 new file)

**`src/components/dialogs/EditVehicleDialog.tsx`**
- Same form layout as fixed AddVehicleDialog (with working color + mileage fields)
- Pre-populated with current vehicle data
- On save: calls `updateVehicle` with diff
- Role-gated: only usable by admin/manager (via `useUserRole`)
- Shows "Last edited by X, Y ago" from most recent change log entry

### Step 5 — FleetVehicleCard.tsx (1 file)

- Add `onEdit?: (vehicle: Vehicle) => void` prop
- Add "Edit Vehicle" dropdown item, wrapped in `<PermissionGuard minRole="manager">`
- Wrap "Delete Vehicle" item in `<PermissionGuard role="admin">`

### Step 6 — FleetPageEnhanced.tsx (1 file)

- Add `editVehicle` state + render `EditVehicleDialog`
- Pass `onEdit` to `FleetVehicleCard`
- Replace `ConfirmationDialog` delete flow with `useUndoToast` pattern:
  - On delete: optimistically remove from UI, show undo toast (5s)
  - On timeout: call `deleteVehicle(id, { silent: true })`
  - On undo: restore vehicle to local state

### Step 7 — VehicleImageDialog History Tab (1 file)

- Add "History" tab (third tab)
- Query `vehicle_change_log` for the vehicle, ordered by `created_at DESC`
- Render timeline: "Rate changed $800 → $1,200 by John, 3 days ago"
- Wrapped in `<PermissionGuard minRole="manager">`

## Files Summary

| Action | File |
|--------|------|
| Migration | `vehicle_change_log` table + RLS + indexes |
| Fix | `src/components/dialogs/AddVehicleDialog.tsx` |
| Fix | `src/lib/validationSchemas.ts` |
| Fix + Expand | `src/contexts/FleetContext.tsx` |
| Modify | `src/lib/featureFlags.ts` |
| Create | `src/components/dialogs/EditVehicleDialog.tsx` |
| Modify | `src/components/fleet/FleetVehicleCard.tsx` |
| Modify | `src/components/fleet/FleetPageEnhanced.tsx` |
| Modify | `src/components/dialogs/VehicleImageDialog.tsx` |

**Total: 1 migration, 1 new file, 7 modified files.**

