

# Dashboard Module Loading Performance — Fix Plan

## Opus Prompt Accuracy Check

| Claim | Actual | Verdict |
|-------|--------|---------|
| All modules eagerly imported | ✅ Lines 34-48: 10 heavy components imported at top | Correct |
| No code splitting | ✅ Confirmed — no `React.lazy` anywhere | Correct |
| `AnimatePresence mode="wait"` causes blank gap | ✅ Line 255: `mode="wait"` + exit animation delays new content | Correct |
| TeamContext fetches sequentially | **Partially** — `team_members` must run first (needs `team_id`), but `teams`, `locations`, `location_staff` can run in parallel after that | Prompt overstates — can't fully parallelize |
| ProtectedRoute shows plain spinner | ✅ Line 100-105: `<LoadingSpinner fullScreen>` | Correct |
| FleetContext already parallel | ✅ Uses `Promise.all` | Correct — leave alone |

**Key correction**: TeamContext can't use a single `Promise.all` for everything because `team_id` comes from the first query. The fix is: query `team_members` first, then `Promise.all` the remaining three queries that depend on `team_id`.

## Changes

### 1. Lazy-load dashboard modules (`src/pages/Dashboard.tsx`)

Replace lines 34-48 (10 eager imports) with `React.lazy()`:

```typescript
const MotorIQEnhanced = lazy(() => import('@/components/dashboard/MotorIQEnhanced'));
const PulseEnhanced = lazy(() => import('@/components/dashboard/PulseEnhanced'));
const BookEnhanced = lazy(() => import('@/components/dashboard/BookEnhanced'));
const VaultEnhanced = lazy(() => import('@/components/dashboard/VaultEnhanced'));
const CoreEnhanced = lazy(() => import('@/components/dashboard/CoreEnhanced'));
const FleetPageEnhanced = lazy(() => import('@/components/fleet/FleetPageEnhanced'));
const DashboardOverviewEnhanced = lazy(() => import('@/components/dashboard/DashboardOverviewEnhanced'));
const SettingsLayout = lazy(() => import('@/components/dashboard/settings/SettingsLayout'));
const TeamHub = lazy(() => import('@/components/dashboard/TeamHub'));
const TeamMessaging = lazy(() => import('@/components/messaging/TeamMessaging'));
```

Each of these files must add `export default` alongside their named export (one-liner per file).

### 2. Add Suspense fallback + fix animation mode (`src/pages/Dashboard.tsx`)

- Wrap `renderModuleContent` return in `<Suspense fallback={<ModuleSkeleton />}>` using existing skeleton components
- Change `AnimatePresence mode="wait"` → `mode="popLayout"` to eliminate the blank gap (old content stays visible while new fades in)
- Remove the manual `isModuleTransitioning` overlay (lines 241-253) — Suspense handles the loading state now

### 3. Parallelize TeamContext queries (`src/contexts/TeamContext.tsx`)

After the first `team_members` query (must be sequential — provides `team_id` and `role`), run the remaining 3 queries in parallel:

```typescript
const [teamResult, locationsResult, staffResult] = await Promise.all([
  supabase.from('teams').select('*').eq('id', teamMember.team_id).maybeSingle(),
  supabase.from('locations').select('*').eq('team_id', teamMember.team_id).eq('is_active', true).order('is_default', { ascending: false }).order('name'),
  supabase.from('location_staff').select('location_id').eq('user_id', user.id),
]);
```

This cuts ~2 round trips from the initial load.

### 4. Dashboard-shaped skeleton in ProtectedRoute (`src/components/common/ProtectedRoute.tsx`)

Replace the `<LoadingSpinner fullScreen>` (line 100-105) with a layout skeleton showing a sidebar placeholder + content area, so users see the app shell immediately instead of a centered spinner.

### 5. Add default exports to lazy-loaded modules

Add `export default ComponentName;` at the bottom of each of these 10 files (no other changes):
- `MotorIQEnhanced.tsx`, `PulseEnhanced.tsx`, `BookEnhanced.tsx`, `VaultEnhanced.tsx`, `CoreEnhanced.tsx`, `FleetPageEnhanced.tsx`, `DashboardOverviewEnhanced.tsx`, `SettingsLayout.tsx`, `TeamHub.tsx`, `TeamMessaging.tsx`

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | `React.lazy` imports, `Suspense` wrapper, `AnimatePresence mode="popLayout"`, remove transition overlay |
| `src/contexts/TeamContext.tsx` | `Promise.all` for team + locations + staff queries |
| `src/components/common/ProtectedRoute.tsx` | Dashboard-shaped skeleton instead of spinner |
| 10 module component files | Add `export default` one-liner each |

## Not Changing

- FleetContext `Promise.all` batch (already optimal)
- QueryClient config (staleTime is fine)
- Provider hierarchy (Auth → Demo → Team → Fleet)
- Route structure (just refactored to path-based)

