# Code Quality Audit

**Baseline:** 848 linting problems (737 errors, 111 warnings)  
**Fixable:** 12 problems (10 errors, 2 warnings)

---

## 1. Linting Issues by Rule (Top 10)

| Rule | Count | Type | Category |
|------|-------|------|----------|
| `@typescript-eslint/no-explicit-any` | **711** | Error | Type Safety |
| `react-hooks/exhaustive-deps` | 71 | Warning | React/Hook Dependencies |
| `react-refresh/only-export-components` | 38 | Warning | React Refresh |
| `@typescript-eslint/no-unused-expressions` | 3 | Error | Code Quality |
| `prefer-const` | 10 | Error | Code Style (Auto-fixable) |
| `@typescript-eslint/no-namespace` | 2 | Error | Type Safety |
| `@typescript-eslint/no-empty-object-type` | 2 | Error | Type Safety |
| `@typescript-eslint/no-require-imports` | 1 | Error | Module Syntax |
| Other rules | 10 | Mixed | Various |

---

## 2. Top 10 Most Problematic Files

| File | Errors | Warnings | Primary Issues |
|------|--------|----------|-----------------|
| `supabase/functions/rari-universal-query/index.ts` | 78 | 0 | Heavy use of `any` types (78 instances) |
| `src/components/dashboard/RealAIInsights.tsx` | 31 | 0 | `any` types in data processing (31) |
| `src/components/rari/RariConversation.tsx` | 28 | 0 | `any` in message/context handling (28) |
| `src/components/dashboard/InspectionForm.tsx` | 24 | 0 | `any` in form state (24) |
| `src/hooks/useRariClientTools.ts` | 22 | 0 | `any` in tool definitions (22) |
| `src/components/charts/ComplianceStackedBar.tsx` | 19 | 0 | `any` in data transformation (19) |
| `src/components/common/CommandPalette.tsx` | 0 | 18 | `react-hooks/exhaustive-deps` (18), `react-refresh/only-export-components` (2) |
| `src/components/dashboard/CustomizableDashboard.tsx` | 0 | 14 | `react-hooks/exhaustive-deps` (14) |
| `src/components/rari/RariVoiceInterface.tsx` | 0 | 13 | `react-hooks/exhaustive-deps` (13) |
| `src/pages/Reset.tsx` | 16 | 0 | `any` in OAuth flow (16) |

---

## 3. Type Safety Analysis

### `: any` Type Annotations
- **Count:** 168 instances across src/
- **Hotspot Files:**
  - `supabase/functions/rari-universal-query/index.ts`: 40+ instances
  - `src/components/dashboard/RealAIInsights.tsx`: 15+
  - `src/components/rari/RariConversation.tsx`: 12+
  - `src/pages/Reset.tsx`: 8+
- **Category:** JUDGMENT — Mostly in event handlers, API responses, and dynamic data processing

### `as any` Casts
- **Count:** 165 instances across src/
- **Most Common:** DOM element casting, Supabase type conversions, third-party library adapters
- **Category:** JUDGMENT — Often necessary for library interop (Supabase SDK, charts library)

### `@ts-ignore` / `@ts-expect-error`
- **Count:** 0 instances
- **Status:** Clean — no suppressions used

### Non-Null Assertions (`!`)
- **Count:** 62 instances  
  - `variable!.property`: 12 (e.g., `receipt_url!`, `vehicle_id!`)
  - In function calls: 50+ (e.g., `format(new Date(message.created_at!))`)
- **Category:** MECHANICAL-FIX — Many are defensible (after null checks), but could be replaced with optional chaining
- **Examples:**
  - `/margin/ReviewTab.tsx:228`: `createSignedUrl(row.receipt_url!, 600)`
  - `/margin/VehiclePnLTable.tsx:49`: `const id = b.vehicle_id!`
  - `/messaging/ReadReceipts.tsx:41-44`: `profile!.id`, `profile!.avatar_url`, `profile!.name`

---

## 4. Console Logging Issues

### Direct Console Usage in src/
- **Total Count:** 357 instances
- **Bypass of Logger:** Yes — components directly use `console.log/warn/error` instead of `src/lib/logger.ts`

### Hotspot Files (Component Logging)
| File | Count | Type | Status |
|------|-------|------|--------|
| `src/components/rari/RariVoiceInterface.tsx` | 26 | mixed (log, warn, error) | Direct console use |
| `src/components/rari/RariWidgetInterface.tsx` | 23 | mixed | Debug prefix `[Rari Widget]` |
| `src/hooks/useRariConversationPersistence.ts` | 20 | mixed | Direct console use |
| `src/pages/Reset.tsx` | 18 | mixed | OAuth debugging |
| `src/hooks/useRariClientTools.ts` | 10 | mixed | Tool registration logging |
| `src/components/auth/AuthRedirectHandler.tsx` | 10 | error | Auth flow debugging |
| `src/lib/photoUpload.ts` | 8 | mixed | Upload progress tracking |
| `src/hooks/useWorkOrders.ts` | 7 | mixed | Work order mutations |
| `src/hooks/useNotifications.ts` | 7 | mixed | Notification handlers |

### Logger Module Status
- **File:** `src/lib/logger.ts` exists
- **Adoption:** ~30% of codebase uses structured logger; 70% uses direct `console`
- **Category:** JUDGMENT — Consider gradual migration to centralized logger

---

## 5. TODO/FIXME/HACK Comments

- **Count:** 0 instances found in src/
- **Status:** Clean — no outstanding tech debt markers

---

## 6. Empty Catch Blocks

- **Count:** 0 instances
- **Status:** Clean — all catch blocks handle or re-throw errors

---

## 7. React Hook Dependencies

### `react-hooks/exhaustive-deps` Violations
- **Count:** 71 warnings
- **Primary Cause:** Arrays/objects created inline passed as dependencies
- **Top 3 Files:**
  1. `src/components/common/CommandPalette.tsx`: 18 warnings
  2. `src/components/dashboard/CustomizableDashboard.tsx`: 14 warnings
  3. `src/components/rari/RariVoiceInterface.tsx`: 13 warnings

### Pattern Example
```typescript
// CommandPalette.tsx:262-301
const allItems = [...items1, ...items2]; // Created inline
useMemo(() => {
  // allItems dependency changes every render!
}, [allItems]); // ← violation
```

### Category:** MECHANICAL-FIX — Wrap inline arrays in `useMemo()` at definition

---

## 8. React Refresh Violations

### `react-refresh/only-export-components` 
- **Count:** 38 warnings
- **Pattern:** Files exporting both components and constants/utilities
- **Primary Files:**
  - `src/components/common/CommandPalette.tsx`: 2 exports (component + constants)
  - `src/components/landing/LandingData.ts`: Utilities + data
  - Various dashboard components with helper functions

### Category:** JUDGMENT — Acceptable if constants are tightly coupled; split into separate files if reusable

---

## 9. Suspected Dead/Unused Files

### Spot-Check Unused Imports (Sample of 20)
- **`canvas-confetti`** — Actually USED: 9 files import it (confetti on user milestones)
- **`react-grid-layout`** — Actually USED: `CustomizableDashboard.tsx`, `useDashboardLayout.ts`
- **`xlsx`** — Actually USED: CRM CSV export, import utilities
- **`@react-google-maps/api`** — Actually USED: Fleet map, address autocomplete

### Dead Component Files (Spot-Check)
No obvious unused components found. All major components in `/components/` are imported somewhere.

---

## 10. Miscellaneous Issues

### `prefer-const` Violations
- **Count:** 10 errors
- **Primary File:** `supabase/functions/rari-universal-query/index.ts` (2 instances)
- **Issue:** `let bookingsQuery = ...` should be `const`
- **Category:** MECHANICAL-FIX — Auto-fixable with `eslint --fix`

### `@typescript-eslint/no-require-imports`
- **Count:** 1 error
- **Location:** `tailwind.config.ts:281`
- **Issue:** `require()` in Tailwind config for plugins
- **Category:** JUDGMENT — CommonJS required by Tailwind; exception is reasonable

### `@typescript-eslint/no-unused-expressions`
- **Count:** 3 errors
- **Likely:** Incomplete statements in Supabase functions
- **Category:** MECHANICAL-FIX — Review and remove

---

## Summary Table

| Category | Count | Type | Effort |
|----------|-------|------|--------|
| Type Safety (`any`) | 711 | Error | HIGH (strategic refactor) |
| Hook Dependencies | 71 | Warning | MEDIUM (mechanical fix) |
| React Refresh | 38 | Warning | MEDIUM (architectural review) |
| Code Style (`prefer-const`) | 10 | Error | LOW (auto-fixable) |
| Other | 18 | Mixed | LOW-MEDIUM |
| **TOTAL** | **848** | — | — |

---

## Recommendations

### High Priority (Type Safety)
1. **Gradual TypeScript Hardening:** Create strict types for:
   - Supabase query responses (rari-universal-query especially)
   - Chat/message data structures
   - Form state objects
2. **Library Wrappers:** Wrap Supabase SDK calls to provide typed interfaces

### Medium Priority (React)
1. **Dependency Array Cleanup:** Use `useMemo()` for inline array/object dependencies
2. **Component/Utility Separation:** Move export constants to separate files where relevant

### Low Priority (Quick Wins)
1. **Run `eslint --fix`** to resolve 10 `prefer-const` violations
2. **Remove unused `@ts-ignore`** comments (none found — clean)
3. **Console logging migration:** Gradually replace with `src/lib/logger.ts`
