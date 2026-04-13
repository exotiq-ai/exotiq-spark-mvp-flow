

# Remaining QA Gaps and Improvement Plan

## What's been completed

| Area | Status |
|------|--------|
| SOW-04 Sections 7-8 (RLS, CLV trigger) | Verified via SQL |
| SOW-04 Sections 1-6 | Code-path analysis done; live UI testing deferred to your Playwright suite |
| Cloud optimization Priority 2 (subscription polling) | Done and verified |
| Cloud optimization cron jobs (notification purge, photo cleanup) | Migration deployed |
| RBAC hierarchy and sidebar gating | Code-verified |

## What still needs work

### 1. Edge Function Security (P0 — Ship Blocker)

Four edge functions have **zero authentication**. Anyone with the URL can call them:

| Function | Risk | Fix |
|----------|------|-----|
| `ai-pricing` | Burns AI credits, exposes fleet pricing data | Add JWT check |
| `generate-report` | Exposes revenue/booking/customer data | Add JWT check |
| `ai-demand-forecast` | Burns AI credits, exposes fleet utilization | Add JWT check |
| `predicthq-events` | Burns PredictHQ API quota | Add JWT check |

**Work**: Add the standard auth pattern (already used in `voice-to-text`, `analyze-vehicle-photo`, etc.) to all four. Verify frontend callers pass `Authorization` header.

### 2. Presence Heartbeat Optimization (Priority 1 — Not Started)

`CLOUD_OPTIMIZATION_TODO.md` lists this as the biggest single saving (~120 DB writes/hour/user), but the `setInterval` heartbeat has already been removed from `usePresence.ts`. Need to verify the visibility-change-only pattern is fully in place and the staleness threshold is raised to 5 minutes.

**Work**: Audit `usePresence.ts`, confirm event-driven pattern, adjust staleness threshold if still at 2 min.

### 3. `data-testid` Attributes for Playwright

Zero `data-testid` attributes exist in the codebase. Your external Playwright suite will be fragile without them.

**Work**: Add `data-testid` to ~25 critical interactive elements:
- Sidebar nav items (each module button)
- Tab triggers (Fleet, Maintenance, Photos, Calendar, CRM)
- Dialog triggers (Add Vehicle, Add Customer, Check-In)
- Search input and result items
- Filter chips (booking calendar)
- Role-specific UI (PermissionGuard children)

### 4. Feature Flag Gaps

Missing flags for features that are incomplete or "coming soon":
- `telematicsIntegration` — Telematics tab shows "Coming Soon" but has no feature flag
- No flag guards the 8 disabled features from showing "coming soon" toasts vs being truly hidden

**Work**: Add `telematicsIntegration: false` to `featureFlags.ts`. Audit each `false` flag to confirm zero UI leakage.

### 5. Error Tracking (P2 — Not Started)

No Sentry or equivalent is installed. Production errors will be invisible.

**Work**: Install `@sentry/react`, initialize in `main.tsx`, wrap `App` with error boundary, configure source maps.

### 6. Accessibility Audit (P3 — Not Started)

Never been audited. Key risks: color contrast on role badges, keyboard navigation through sidebar modules, focus management in dialogs.

**Work**: Run Lighthouse accessibility audit, fix critical findings (likely focus indicators and ARIA labels on icon-only buttons).

### 7. Console Log Cleanup

`src/lib/logger.ts` exists with `devLog/devWarn/devError` but adoption is only ~8 files. Production will leak debug logs.

**Work**: Search-and-replace remaining `console.log/warn/error` calls in `src/` with logger equivalents.

## Execution Order

```text
Phase A (Immediate — before production)
  1. Secure 4 edge functions          ~30 min
  2. Verify presence optimization     ~10 min
  3. Add telematicsIntegration flag   ~5 min

Phase B (Before Playwright suite)
  4. Add data-testid attributes       ~45 min

Phase C (Production hardening)
  5. Install Sentry error tracking    ~30 min
  6. Console log cleanup              ~20 min
  7. Accessibility quick fixes        ~30 min
```

## Deliverable

After implementation, I will update `QA_ROADMAP.md` with current status and generate a final `QA-REMAINING-GAPS.md` artifact your team can use as the acceptance checklist alongside the Playwright results.

