

# SPA Routing for Dashboard Modules — Comprehensive Fix Plan

## Prompt Accuracy Assessment

The Opus 4.6 prompt is **mostly accurate** but has these gaps:

| Area | Prompt Says | Reality | Action |
|------|------------|---------|--------|
| Route mapping | Lists 9 modules | `fleet` module missing from map | Add `/dashboard/fleet` |
| Files to change | 6 files | Misses 8 additional files | Include all below |
| `useModuleNavigation.ts` | Switch to path-based | Uses query params for entity deep-links (`?customerId=`, `?bookingId=`) | Keep query params for entities, only change module routing to path |
| `DashboardSidebar.tsx` | Not mentioned | Legacy sidebar also uses `onModuleChange` | Update it too |
| `DashboardOverviewEnhanced.tsx` | Not mentioned | Calls `onModuleClick('motoriq')`, `onModuleClick('book')` etc. | Must use navigate |
| `DashboardOverview.tsx` | Not mentioned | Same pattern | Update |
| `CustomizableDashboard.tsx` | Not mentioned | Same pattern | Update |
| Tour hooks | Not mentioned | `useTourNavigation.ts`, `useDemoOrchestrator.ts` call `onModuleChange` | These can stay — they receive the callback from Dashboard which will now navigate |
| Session init logic | Not mentioned | Dashboard line 81-87 resets to `dashboard` on new session | Remove — URL becomes the source of truth |

## Architecture

```text
Current:  /dashboard + localStorage("activeModule") + ?module= query param
Proposed: /dashboard/:module + query params for entity deep-links only

/dashboard           → Dashboard overview
/dashboard/bookings  → BookEnhanced
/dashboard/fleet     → FleetPageEnhanced
/dashboard/pulse     → PulseEnhanced
/dashboard/motoriq   → MotorIQEnhanced
/dashboard/fleetcopilot → CoreEnhanced
/dashboard/vault     → VaultEnhanced
/dashboard/settings  → SettingsLayout
/dashboard/team-hub  → TeamHub
```

## Route-to-Module ID Mapping

```text
URL segment  →  internal moduleId (used by localStorage fallback, tours, etc.)
(none)       →  "dashboard"
bookings     →  "book"
fleet        →  "fleet"
pulse        →  "pulse"
motoriq      →  "motoriq"
fleetcopilot →  "core"
vault        →  "vault"
settings     →  "settings"
team-hub     →  "team-hub"
```

## Implementation Steps

### 1. Create route mapping utility (`src/lib/moduleRoutes.ts`)

Central mapping between module IDs and URL segments. Two functions:
- `moduleIdToPath(moduleId: string): string` — e.g. `"book"` → `"/dashboard/bookings"`
- `pathToModuleId(segment: string): string` — e.g. `"bookings"` → `"book"`
- `MODULE_TITLES: Record<string, string>` — e.g. `"book"` → `"Bookings | Exotiq.ai"`

### 2. Update `src/App.tsx`

Change `/dashboard` route to `/dashboard/*` to allow nested path matching:
```tsx
<Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
```

### 3. Rewrite `src/pages/Dashboard.tsx`

- Replace `useLocalStorage("activeModule")` as primary nav state with `useLocation()` + `pathToModuleId()`
- Keep `useLocalStorage` as write-only for backwards compat (tour system reads it)
- Remove the session init logic (lines 81-96) — URL is source of truth
- `handleModuleChange` now calls `navigate(moduleIdToPath(moduleId))` instead of `setActiveModule`
- Remove `searchParams.get('module')` effect (lines 111-116) — add a one-time redirect: if `?module=X` is present, redirect to the path equivalent and strip the param (backwards compat for bookmarks)
- Update `SEOHead` to use `MODULE_TITLES[activeModule]`
- `renderModuleContent()` stays as-is (switch on derived `activeModule`)

### 4. Update `src/components/dashboard/DashboardSidebarEnhanced.tsx`

- Import `useNavigate` from react-router-dom
- Change `onModuleChange` prop to optional (keep for tour compat) OR have sidebar call `navigate()` directly
- Sidebar buttons: `onClick={() => navigate(moduleIdToPath(item.id))}` instead of `onModuleChange(item.id)`
- Active state: derive from `useLocation().pathname` instead of `activeModule` prop

### 5. Update `src/components/mobile/MobileMoreMenu.tsx`

Same pattern — use `navigate()` + `moduleIdToPath()` in `handleItemClick`. Keep `activeModule` derived from URL.

### 6. Update `src/hooks/useKeyboardShortcuts.ts`

Replace all `navigate("/dashboard?module=X")` with `navigate(moduleIdToPath("X"))`.

### 7. Update `src/components/common/CommandPalette.tsx`

Replace all `navigate('/dashboard?module=X')` calls (roughly 10 occurrences) with `navigate(moduleIdToPath('X'))`.

### 8. Update `src/components/common/EnhancedGlobalSearch.tsx`

Replace all `navigate("/dashboard?module=X")` calls (roughly 12 occurrences) with path-based equivalents.

### 9. Update `src/hooks/useModuleNavigation.ts`

Change `setSearchParams({ module: 'book', ... })` to `navigate('/dashboard/bookings?bookingId=...')`. The entity query params (`customerId`, `bookingId`, `vehicleId`, `tab`, `view`) stay as query params — only the module selection moves to the path.

### 10. Update `src/components/dashboard/DashboardSidebar.tsx` (legacy)

Same pattern as Enhanced sidebar — use `navigate()`.

### 11. Update overview components

`DashboardOverviewEnhanced.tsx`, `DashboardOverview.tsx`, `CustomizableDashboard.tsx` — their `onModuleClick` callbacks will automatically work because Dashboard's `handleModuleChange` will now navigate. No changes needed in these files — they just call the callback.

### 12. Mobile bottom nav in Dashboard.tsx (lines 392-428)

The inline buttons that call `handleModuleChange(item.id)` — these will work automatically since `handleModuleChange` will navigate.

## What Stays Unchanged

- Provider tree (Auth, Team, Fleet contexts) — untouched
- `ProtectedRoute` wrapper — untouched
- Tour system — receives `handleModuleChange` callback which now navigates
- Entity deep-links — remain as query params on the new paths
- All module components (BookEnhanced, PulseEnhanced, etc.) — untouched

## Files Changed

| File | Change |
|------|--------|
| **NEW** `src/lib/moduleRoutes.ts` | Central route mapping + titles |
| `src/App.tsx` | `/dashboard` → `/dashboard/*` |
| `src/pages/Dashboard.tsx` | URL-driven module state, dynamic SEO title, backwards-compat redirect |
| `src/components/dashboard/DashboardSidebarEnhanced.tsx` | `navigate()` instead of callback |
| `src/components/dashboard/DashboardSidebar.tsx` | Same |
| `src/components/mobile/MobileMoreMenu.tsx` | `navigate()` instead of callback |
| `src/hooks/useKeyboardShortcuts.ts` | Path-based navigation |
| `src/hooks/useModuleNavigation.ts` | Path-based module + query params for entities |
| `src/components/common/CommandPalette.tsx` | Path-based navigation |
| `src/components/common/EnhancedGlobalSearch.tsx` | Path-based navigation |

## Risk

**Low**. This is a navigation refactor — no data model, RLS, or provider changes. The central mapping utility makes it easy to adjust paths. Backwards compat redirect handles old bookmarked URLs with `?module=` params.

