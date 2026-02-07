

# Cleanup & Consistency: Delete Orphaned Code, Standardize Widgets, Deploy Edge Functions

## Overview

Three focused tasks to tidy the codebase and verify new features are live -- all additive or deletion-only changes with zero risk to existing functionality.

---

## Task 1: Delete QuickOnboarding.tsx

**What:** Remove `src/components/onboarding/QuickOnboarding.tsx` -- confirmed never imported anywhere in the app.

**Risk:** None. The file has zero imports. The `RacingStripe` component it uses is still imported by `RevenueWidget`, so that file stays.

**Action:** Delete the single file.

---

## Task 2: Apply Progressive Disclosure to FleetStatusWidget and ScheduleWidget

Currently, `RevenueWidget` wraps its content in the `ProgressiveDisclosure` component (shows a preview with a "Show More" button for detailed metrics). The other two dashboard widgets (`FleetStatusWidget` and `ScheduleWidget`) render their content directly without this pattern, creating inconsistency.

### FleetStatusWidget Changes

- **Preview (always visible):** The donut chart with legend (current content from `LiveFleetStatusWidget`)
- **Expanded content:** A breakdown list showing each status count, utilization percentage, and quick-action links
- Wrap in `ProgressiveDisclosure` with title "Live Fleet Status" and a "Live" badge
- Remove the inner `Card` from `LiveFleetStatusWidget` to avoid double-card nesting (ProgressiveDisclosure already provides one)

### ScheduleWidget Changes

- **Preview (always visible):** The first 3 upcoming bookings (current content from `UpcomingScheduleWidget`)
- **Expanded content:** Additional booking details like total value, duration, and a mini calendar summary
- Wrap in `ProgressiveDisclosure` with title "Upcoming Schedule"
- Same Card-removal treatment to avoid double nesting

### Safety

- These are purely presentational changes to two widget wrapper components
- The inner components (`FleetStatusDonut`, `UpcomingScheduleWidget`) stay untouched
- The `ProgressiveDisclosure` component is already battle-tested in `RevenueWidget`

---

## Task 3: Deploy Edge Functions

Both `identify-vehicle` and `generate-hero-image` return 404 (not yet deployed). The code exists and is registered in `config.toml`.

**Action:** Trigger deployment of both functions, then verify with a test call:
- `identify-vehicle`: POST with a test image URL, confirm it returns a JSON response (not 404)
- `generate-hero-image`: POST with test metadata, confirm it boots and responds

No code changes needed -- just deployment.

---

## Files Changed

| Action | File |
|--------|------|
| Delete | `src/components/onboarding/QuickOnboarding.tsx` |
| Modify | `src/components/dashboard/widgets/FleetStatusWidget.tsx` |
| Modify | `src/components/dashboard/widgets/ScheduleWidget.tsx` |
| Modify | `src/components/dashboard/LiveFleetStatusWidget.tsx` (remove outer Card to prevent double-wrap) |
| Modify | `src/components/dashboard/UpcomingScheduleWidget.tsx` (remove outer Card to prevent double-wrap) |
| Deploy | `supabase/functions/identify-vehicle` |
| Deploy | `supabase/functions/generate-hero-image` |

## Risk Assessment

| Change | Risk | Reason |
|--------|------|--------|
| Delete QuickOnboarding | None | Zero imports confirmed |
| Progressive Disclosure | Low | Presentational only, uses proven component |
| Edge function deploy | None | Additive -- no existing code calls them yet |

