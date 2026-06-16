## Audit: DenverExoticRentalCars@gmail.com

**Account**
- Team: **J Davidson's Fleet** (`c71d6655…`)
- Owner: `denverexoticrentalcars@gmail.com` — last sign-in **Apr 30** (so the owner himself hasn't logged in for ~6 weeks)
- Manager: `chantaralynn@gmail.com` — last sign-in **June 12** (this is who is actually using the app)
- Billing stage: `notice` (NOT `restriction`) → guards correctly pass through, this is **not** blocking saves
- Stripe Connect: not enabled (`stripe_charges_enabled=false`) — also not a save blocker
- Last booking written to DB: **June 2** (14 days ago) — matches the report that "nothing is saving"

**Server side is healthy**
- No INSERT/UPDATE errors on `bookings` in Postgres logs for this team
- RLS INSERT policy `auth.uid() = user_id` is correct; both users satisfy it
- No 4xx/5xx from edge functions
- Only DB error in window is an unrelated `terms_acceptance_method` enum value

**Smoking gun — client side**
Runtime error captured right now in preview:
```
Failed to fetch dynamically imported module:
  /src/components/dashboard/DashboardOverviewEnhanced.tsx
```
This is a stale-build / stale-service-worker symptom. On mobile it manifests exactly as "flashy and glitchy" and "booking won't save", because:
1. `Dashboard.tsx` lazy-loads ~10 modules (`BookEnhanced`, `CoreEnhanced`, `FleetPageEnhanced`, `DashboardOverviewEnhanced`, …). When the cached `index.html` references a chunk hash that no longer exists, every navigation that touches a new module throws → component never mounts → the booking dialog's submit handler is on a tree that never finished hydrating → click does nothing.
2. `staleBuildRecovery.handleStaleAssetError` currently requires **two failures on different chunks within 20s** before reloading. On mobile the user often hits the same broken chunk repeatedly → recovery never triggers → blank/flicker forever.
3. Each failed lazy import retriggers Suspense fallback → that's the visible "flashing".

## Fixes (single PR)

### 1. Make stale-asset recovery actually fire (root cause of the flicker + save failure)
- File: `src/lib/staleBuildRecovery.ts`
  - Reduce the two-strike rule to **one failure** when the request is for a versioned asset under `/assets/*.js|css` or matches a dynamic-import filename (those are deterministic, not preload races). Keep the two-strike rule only for the noisier preload-race patterns.
  - On first stale-asset failure also clear all `caches.*` and unregister any active SW before the hard reload (today rescue only runs once per browser via `SW_RESCUE_COMPLETED`; we want a reload-time purge too).
  - Lengthen `RELOAD_COOLDOWN_MS` to 60s and add a `_cb` cache-bust to the reload so the SW shell isn't served again.

### 2. Wrap lazy modules in a retrying boundary so a single dropped chunk doesn't blank the screen
- New helper `src/lib/lazyWithRetry.ts` — wraps `React.lazy` with one transparent retry + `?v=<ts>` cache-buster on the import URL before surrendering to the error boundary.
- Replace the 10 `lazy(() => import(…))` calls in `src/pages/Dashboard.tsx` with `lazyWithRetry(() => import(…))`. No behavior change on success; on transient mobile network blips the second attempt succeeds and the user never sees a flicker.

### 3. Stop the Suspense fallback from "flashing" between modules
- `src/pages/Dashboard.tsx` currently swaps in a skeleton on every module change. Add a 150 ms delay before the skeleton renders (`useDelayedFallback`) so fast loads from cache don't flash a skeleton at all.

### 4. Guard the booking submit handler against a half-mounted tree
- `src/contexts/FleetContext.tsx createBooking`: if `supabase.from('bookings').insert(...)` rejects with a network/abort error, surface a toast with a "Retry" action instead of silently returning. Today the function `return`s on error after a toast, but only when Supabase returned an error object — a thrown fetch (offline / chunk-load mid-submit) is uncaught.
- Wrap the body in `try/catch`, log via `devError`, and re-toast on catch.

### 5. Diagnostics for this specific tenant
- Add a one-line `console.info('[Build]', __BUILD_ID__)` log on app boot (Vite `define`) so when Chantara reports "still flashing" we can immediately tell from her console screenshot whether she's on the current build or an old SW shell.

## What I'm NOT changing
- No DB / RLS / edge-function changes — server side is clean.
- No billing/dunning logic — `notice` is the correct stage and is already pass-through.
- No redesign of the booking dialog — the dialog code is fine; it just never gets to run on stale builds.

## Manual follow-up for you after the PR ships
- Ask Chantara to **fully close** the Safari/Chrome app on her phone once (not just refresh) so the new SW registers. After the fixes above she shouldn't have to do this again.
- Optional: clear `billing_dunning_stage` for this team in Super Admin → Billing if the "notice" banner is causing visual confusion (it's not blocking saves, just a banner).

## Out of scope (call out if you want it in)
- Owner hasn't logged in since April — if you want a "stale-owner" nudge in the dashboard, separate ticket.
- Reducing the number of lazy boundaries (could cut bundle splits from 10 → 4 to reduce surface area for stale-chunk failures) — bigger refactor, separate PR.
