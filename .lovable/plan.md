

# Priority 3: Lazy Realtime Subscriptions

## Goal
Remove `damage_claims`, `customers`, `vehicle_inspections`, and `maintenance_schedules` from the global FleetContext WebSocket channel. Create a reusable `useRealtimeTable` hook. Wire it into the specific page components that consume that data.

## What Changes

### 1. Create `src/hooks/useRealtimeTable.ts` (new file)
A reusable hook that subscribes to a single table's `postgres_changes` and calls a refresh callback on change. Accepts `tableName`, `teamId`, `onUpdate` callback, and an `enabled` flag. Manages its own channel lifecycle (mount/unmount).

```text
useRealtimeTable(tableName, { teamId, onUpdate, enabled })
  → creates channel on mount (if enabled)
  → filters by team_id on payload
  → calls onUpdate() debounced
  → removes channel on unmount
```

### 2. Edit `src/contexts/FleetContext.tsx`
- Remove the 4 `.on('postgres_changes', ...)` listeners for `damage_claims`, `customers`, `vehicle_inspections`, `maintenance_schedules` from the multiplexed channel (lines 629-663)
- Keep `bookings`, `payments`, `vehicles` in the global channel (these are the most operationally critical)
- Keep `refreshFnsRef` entries for all tables (the refresh functions themselves stay — they're called by page-level hooks and by `refreshData`)
- Expose `refreshInspections` and `refreshMaintenance` in the context type and provider value so page-level hooks can call them

### 3. Add page-level subscriptions to consuming components

| Table | Component | File |
|-------|-----------|------|
| `damage_claims` | `DamageClaimsSection` | `src/components/dashboard/DamageClaimsSection.tsx` |
| `customers` | `CRMSection` | `src/components/dashboard/CRMSection.tsx` |
| `vehicle_inspections` | `InspectionsTab` | `src/components/dashboard/InspectionsTab.tsx` |
| `maintenance_schedules` | `VaultEnhanced` | `src/components/dashboard/VaultEnhanced.tsx` |
| `maintenance_schedules` | `DashboardOverviewEnhanced` | `src/components/dashboard/DashboardOverviewEnhanced.tsx` |
| `maintenance_schedules` | `AttentionRequired` / `AttentionRequiredTab` | Pulse components |

Each component adds a single `useRealtimeTable()` call that triggers the existing FleetContext refresh function when data changes. The hook subscribes on mount and unsubscribes on unmount — so the subscription only exists while the user is viewing that page/tab.

### 4. Update `CLOUD_OPTIMIZATION_TODO.md`
Mark Priority 3 tasks as completed.

## What Does NOT Change
- All data is still fetched on initial load via `refreshDataCore` (FleetContext still loads all 7 tables on login)
- The `refreshData(force)` manual refresh still refreshes everything
- Dashboard counters still work because data is loaded initially — it just won't live-update in the background for moved tables
- No API or type changes — same FleetContext shape

## Risk Mitigation
- `bookings`, `vehicles`, `payments` remain globally live (highest operational priority)
- Data for moved tables is still loaded on every full refresh and page navigation
- The `notifications` table has its own subscription and DB triggers for damage claims and payments, so the notification bell still works globally

## Files Modified
1. **New**: `src/hooks/useRealtimeTable.ts`
2. **Edit**: `src/contexts/FleetContext.tsx` — remove 4 table listeners from channel, expose 2 more refresh fns
3. **Edit**: `src/components/dashboard/DamageClaimsSection.tsx` — add `useRealtimeTable`
4. **Edit**: `src/components/dashboard/CRMSection.tsx` — add `useRealtimeTable`
5. **Edit**: `src/components/dashboard/InspectionsTab.tsx` — add `useRealtimeTable`
6. **Edit**: `src/components/dashboard/VaultEnhanced.tsx` — add `useRealtimeTable` for maintenance
7. **Edit**: `CLOUD_OPTIMIZATION_TODO.md` — mark Priority 3 done

