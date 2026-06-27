# MotorIQ Demand Forecast — Stop the crash for good

## Root cause recap
The production bundle on `app.exotiq.ai` is from **2026-06-26 17:11Z** — it predates the `safeFormat` patch that's already sitting in `src/components/dashboard/DemandForecastCard.tsx`. So the crash you're seeing is real, but the code fix exists; prod just hasn't been republished.

On top of that, the underlying trigger is the `ai-demand-forecast` edge function occasionally returning `pred.date` / `event.date` / `opp.date` values that aren't valid ISO dates. `safeFormat` swallows that gracefully, but we should also stop the bad data at the source and make sure one bad card never blanks the whole MotorIQ panel again.

## Plan (3 steps)

### 1. Harden `supabase/functions/ai-demand-forecast`
- After the model returns, validate every `date` field on `dailyPredictions[]`, `opportunities[]`, and `events[]` with `new Date(x).getTime()`.
- Drop entries with unparseable dates; for `dailyPredictions`, fall back to sequential `addDays(from, i)` so the daily grid stays complete.
- Coerce all surviving dates to `YYYY-MM-DD` strings before returning. No schema/contract change for the client.

### 2. Add a local ErrorBoundary around `DemandForecastCard`
- In `src/components/dashboard/MotorIQEnhanced.tsx`, wrap the `<DemandForecastCard />` render with a small boundary (reuse the existing `RariErrorBoundary` pattern or a tiny dedicated one) that shows a compact "Forecast temporarily unavailable — retry" tile instead of bubbling up to the page-level boundary.
- Keeps the rest of MotorIQ (pricing, revenue, recommendations) visible even if forecast data is malformed.

### 3. Republish frontend
- Backend (edge function) deploys automatically on save.
- Frontend needs an explicit Publish to push the already-merged `safeFormat` fix + new boundary to `app.exotiq.ai`. I'll handle the publish step once 1 & 2 are in.

## What this does NOT change
- No business logic, no UI redesign, no currency/localization work.
- US tenants unaffected — pure resilience hardening.
- DemandForecastCard's existing `safeFormat` stays as the last line of defense.

## Verification
- Edge function: invoke with a forced bad-date payload, confirm response now has only valid `YYYY-MM-DD` strings.
- UI: load `/dashboard/motoriq` as Orion → MotorIQ panel renders; if forecast ever fails it shows the small inline fallback, not the full-page "Something went wrong".
- Console: no `RangeError: Invalid time value`.
