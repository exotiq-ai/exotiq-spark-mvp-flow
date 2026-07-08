## Goal
Officially ship the Command Center Daily Brief hero card to every tenant by flipping its feature flag to true and removing the localStorage bootstraps that were used for the soft rollout.

## Changes

1. **`src/lib/featureFlags.ts`**
   - Flip `dailyBrief: false` → `dailyBrief: true`.
   - Update the trailing comment to reflect that it's now globally on, and note that per-browser `?ff=dailyBrief:off` still works as a kill switch if a single tenant needs to disable it.

2. **Remove the localStorage auto-enable bootstraps** (no longer needed once the default is true — and they'd override any future `off` flip):
   - `src/pages/Dashboard.tsx` lines ~178–185 — the `ff_dailyBrief=1` writer.
   - `src/pages/Demo.tsx` lines ~38–45 — same writer.
   - `src/contexts/AuthContext.tsx` lines ~694–700 — same writer.

3. **Leave downstream code untouched.** `DashboardOverviewEnhanced`, `MotorIQEnhanced`, and `DailyBriefCard` already read through `isFeatureEnabled('dailyBrief')`, so flipping the default is the only switch needed. The deterministic `useDailyBrief` hook + `daily-brief-narrative` edge function (with its PII sanitizer and deterministic fallback) are already live in production paths and will simply be reached by every tenant.

## Safety checks before shipping
- Confirm `DailyBriefCard` renders safely with zero data (empty fleet, brand-new tenant): the hook's `useMemo` already returns empty `issues`/`metrics` arrays; card should show the "nothing urgent" state.
- Confirm the edge function fallback path still returns 200 with a deterministic narrative when `LOVABLE_API_KEY` is missing or the AI call fails — it already does.
- Grep for any remaining `ff_dailyBrief` references after the edits so no stale bootstrap survives.
- Run `tsgo` to make sure the flag flip and file edits don't break types.

## Rollback
If a tenant reports a regression, they can append `?ff=dailyBrief:off` once to disable it in their browser. To roll back globally, flip the flag back to `false` in `featureFlags.ts` — no other code needs to change.
